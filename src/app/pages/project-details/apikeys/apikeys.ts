import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { ApiKeyStore } from '../../projects/store/apikey.store';
import { ApiKey, CreatedApiKey } from '../../projects/store/apikey.types';
import { RolesStore } from '../../projects/store/roles.store';

const DEFAULT_LIFETIME_DAYS = 90;

/** Formats a date for an <input type="datetime-local"> in the user's local time zone. */
export function toLocalDateTimeInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

@Component({
  selector: 'app-apikeys',
  imports: [ReactiveFormsModule, DatePipe],
  providers: [ApiKeyStore, RolesStore],
  templateUrl: './apikeys.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeys {
  readonly store = inject(ApiKeyStore);
  readonly rolesStore = inject(RolesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = toSignal(this.route.parent!.paramMap.pipe(map((params) => params.get('name') ?? '')), { initialValue: '' });
  readonly editorOpen = signal(false);
  readonly editing = signal<ApiKey | null>(null);
  readonly deleteTarget = signal<ApiKey | null>(null);
  /** Held only in component memory; cleared on dismiss, project change, or navigation away. */
  readonly createdKey = signal<CreatedApiKey | null>(null);
  readonly copied = signal(false);
  readonly success = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);
  readonly selectedRoles = signal<string[]>([]);
  readonly availableRoles = computed(() => this.rolesStore.roles().map((role) => role.name).sort());
  readonly busy = computed(() => this.store.loading() || this.store.saving() || this.store.deleting());

  readonly form = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(128), Validators.pattern(/\S/)],
    }),
    neverExpires: new FormControl(false, { nonNullable: true }),
    expiresAt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private loadedProject = '';

  constructor() {
    this.form.controls.neverExpires.valueChanges.pipe(takeUntilDestroyed()).subscribe((never) => {
      if (never) this.form.controls.expiresAt.disable({ emitEvent: false });
      else this.form.controls.expiresAt.enable({ emitEvent: false });
    });

    effect((onCleanup) => {
      const projectId = this.projectId();
      if (!projectId) return;
      if (this.loadedProject !== projectId) {
        this.resetState();
        this.loadedProject = projectId;
      }
      const keys = this.store.load(projectId).subscribe({ error: () => {} });
      const roles = this.rolesStore.load(projectId).subscribe({ error: () => {} });
      onCleanup(() => {
        keys.unsubscribe();
        roles.unsubscribe();
      });
    });
  }

  isExpired(key: ApiKey): boolean {
    return key.expiresAt !== null && new Date(key.expiresAt).getTime() <= Date.now();
  }

  openEditor(key: ApiKey | null = null): void {
    this.editing.set(key);
    const neverExpires = key !== null && key.expiresAt === null;
    const expiresAt = key?.expiresAt
      ? new Date(key.expiresAt)
      : new Date(Date.now() + DEFAULT_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
    this.form.reset({
      displayName: key?.displayName ?? '',
      neverExpires,
      expiresAt: toLocalDateTimeInput(expiresAt),
    });
    if (key) this.form.controls.displayName.disable();
    else this.form.controls.displayName.enable();
    this.selectedRoles.set([...(key?.roles ?? [])]);
    this.editorOpen.set(true);
    this.deleteTarget.set(null);
    this.createdKey.set(null);
    this.store.error.set(null);
    this.validationError.set(null);
    this.success.set(null);
  }

  closeEditor(): void {
    if (this.store.saving()) return;
    this.editorOpen.set(false);
    this.editing.set(null);
    this.validationError.set(null);
    this.store.error.set(null);
  }

  toggleRole(role: string, checked: boolean): void {
    this.selectedRoles.update((roles) =>
      checked ? [...new Set([...roles, role])].sort() : roles.filter((current) => current !== role),
    );
  }

  save(): void {
    if (this.store.saving()) return;
    this.form.markAllAsTouched();
    this.validationError.set(null);
    if (this.form.invalid) {
      this.validationError.set('Enter a name and an expiry date.');
      return;
    }

    let expiresAt: string | null = null;
    if (!this.form.controls.neverExpires.value) {
      const expiry = new Date(this.form.controls.expiresAt.value);
      if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
        this.validationError.set('Expiry must be in the future.');
        return;
      }
      expiresAt = expiry.toISOString();
    }

    const projectId = this.projectId();
    const key = this.editing();
    const roles = this.selectedRoles();

    if (key) {
      this.store.update(projectId, key.id, { expiresAt, roles })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            if (this.projectId() !== projectId) return;
            this.editorOpen.set(false);
            this.editing.set(null);
            this.success.set('API key updated.');
          },
          error: () => {},
        });
      return;
    }

    this.store.create(projectId, {
      displayName: this.form.controls.displayName.value.trim(),
      expiresAt,
      roles,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          if (this.projectId() !== projectId) return;
          this.editorOpen.set(false);
          this.copied.set(false);
          this.createdKey.set(created);
        },
        error: () => {},
      });
  }

  copyToken(): void {
    const token = this.createdKey()?.token;
    if (!token || !navigator.clipboard) return;
    navigator.clipboard.writeText(token).then(
      () => this.copied.set(true),
      () => this.copied.set(false),
    );
  }

  dismissToken(): void {
    this.createdKey.set(null);
    this.copied.set(false);
    this.success.set('API key created.');
  }

  confirmDelete(key: ApiKey): void {
    this.deleteTarget.set(key);
    this.editorOpen.set(false);
    this.createdKey.set(null);
    this.store.error.set(null);
    this.success.set(null);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  deleteKey(): void {
    const key = this.deleteTarget();
    if (!key || this.store.deleting()) return;
    const projectId = this.projectId();
    this.store.delete(projectId, key.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.projectId() !== projectId) return;
        this.deleteTarget.set(null);
        this.success.set('API key revoked.');
      },
      error: () => {},
    });
  }

  private resetState(): void {
    this.editorOpen.set(false);
    this.editing.set(null);
    this.deleteTarget.set(null);
    this.createdKey.set(null);
    this.copied.set(false);
    this.success.set(null);
    this.validationError.set(null);
  }
}
