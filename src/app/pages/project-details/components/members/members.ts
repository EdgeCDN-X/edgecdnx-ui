import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, distinctUntilChanged, EMPTY, switchMap, tap } from 'rxjs';
import { MembersStore } from '../../../projects/store/members.store';
import { ProjectMember } from '../../../projects/store/members.types';

export const INVITE_NEW_USER = '__invite__';

@Component({
  selector: 'app-members',
  imports: [ReactiveFormsModule],
  providers: [MembersStore],
  templateUrl: './members.html',
  styleUrl: './members.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Members {
  readonly projectId = input.required<string>();
  readonly store = inject(MembersStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly inviteOption = INVITE_NEW_USER;
  readonly formOpen = signal(false);
  readonly removeTarget = signal<ProjectMember | null>(null);
  readonly success = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);

  readonly form = new FormGroup({
    user: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true }),
    role: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly selectedUser = toSignal(this.form.controls.user.valueChanges, { initialValue: '' });
  readonly inviting = computed(() => this.selectedUser() === INVITE_NEW_USER);

  readonly users = computed(() =>
    Array.from(new Set(this.store.members().map((member) => member.user))).sort((a, b) => a.localeCompare(b)),
  );

  readonly groups = computed(() => {
    const byRole = new Map<string, string[]>();
    for (const member of this.store.members()) {
      const users = byRole.get(member.role) ?? [];
      users.push(member.user);
      byRole.set(member.role, users);
    }
    return Array.from(byRole.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupName, users]) => ({ groupName, users: users.sort((a, b) => a.localeCompare(b)) }));
  });

  constructor() {
    this.form.controls.user.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((user) => {
      const email = this.form.controls.email;
      if (user === INVITE_NEW_USER) {
        email.setValidators([Validators.required, Validators.email, Validators.maxLength(254)]);
      } else {
        email.clearValidators();
        email.setValue('', { emitEvent: false });
        email.markAsUntouched();
      }
      email.updateValueAndValidity({ emitEvent: false });
    });

    toObservable(this.projectId)
      .pipe(
        distinctUntilChanged(),
        tap(() => {
          this.formOpen.set(false);
          this.removeTarget.set(null);
          this.success.set(null);
          this.store.error.set(null);
        }),
        switchMap((projectId) => this.store.load(projectId).pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  openForm(): void {
    this.form.reset({
      user: this.users().length > 0 ? '' : INVITE_NEW_USER,
      email: '',
      role: '',
    });
    this.formOpen.set(true);
    this.removeTarget.set(null);
    this.success.set(null);
    this.validationError.set(null);
    this.store.error.set(null);
    this.store.loadRoles(this.projectId())
      .pipe(catchError(() => EMPTY), takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  closeForm(): void {
    if (this.store.saving()) return;
    this.formOpen.set(false);
    this.validationError.set(null);
    this.store.error.set(null);
  }

  chooseExistingUser(): void {
    this.form.controls.user.setValue('');
  }

  assign(): void {
    if (this.store.saving()) return;
    this.form.markAllAsTouched();
    this.validationError.set(null);
    const emailControl = this.form.controls.email;
    if (emailControl.value !== emailControl.value.trim()) emailControl.setValue(emailControl.value.trim());
    if (this.form.invalid) {
      this.validationError.set(this.inviting() ? 'Enter a valid email address and select a role.' : 'Select a user and a role.');
      return;
    }
    const { user, email, role } = this.form.getRawValue();
    const inviting = user === INVITE_NEW_USER;
    const member: ProjectMember = { user: inviting ? email.trim() : user, role };
    if (this.store.members().some((m) => m.user === member.user && m.role === member.role)) {
      this.validationError.set(`${member.user} is already assigned to ${member.role}.`);
      return;
    }

    const projectId = this.projectId();
    this.store.assign(projectId, member).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.projectId() !== projectId) return;
        this.formOpen.set(false);
        this.success.set(inviting ? `Invited ${member.user} as ${member.role}.` : `Assigned ${member.user} to ${member.role}.`);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 409) this.validationError.set('This user is already assigned to the selected role.');
      },
    });
  }

  confirmRemove(member: ProjectMember): void {
    this.removeTarget.set(member);
    this.formOpen.set(false);
    this.success.set(null);
    this.store.error.set(null);
  }

  cancelRemove(): void {
    this.removeTarget.set(null);
  }

  remove(): void {
    const member = this.removeTarget();
    if (!member || this.store.removing()) return;
    const projectId = this.projectId();
    this.store.remove(projectId, member).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.projectId() !== projectId) return;
        this.removeTarget.set(null);
        this.success.set(`Removed ${member.user} from ${member.role}.`);
      },
      error: () => {},
    });
  }
}
