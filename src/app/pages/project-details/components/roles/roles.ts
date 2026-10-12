import { HttpErrorResponse } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, distinctUntilChanged, EMPTY, switchMap, tap } from 'rxjs';
import { RolesStore } from '../../../projects/store/roles.store';
import { CreateRoleDto, ProjectRole, RolePermission, UpdateRoleDto } from '../../../projects/store/roles.types';

type PermissionForm = FormGroup<{
  resource: FormControl<string>;
  create: FormControl<boolean>;
  read: FormControl<boolean>;
  update: FormControl<boolean>;
  delete: FormControl<boolean>;
}>;

const permissionActions = ['create', 'read', 'update', 'delete'] as const;

@Component({
  selector: 'app-roles',
  imports: [ReactiveFormsModule, TitleCasePipe],
  providers: [RolesStore],
  templateUrl: './roles.html',
  styleUrl: './roles.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Roles {
  readonly projectId = input.required<string>();
  readonly store = inject(RolesStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly editorOpen = signal(false);
  readonly editing = signal<ProjectRole | null>(null);
  readonly deleteTarget = signal<ProjectRole | null>(null);
  readonly success = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);
  readonly actions = permissionActions;
  readonly roles = computed(() => this.store.roles().map((role) => ({
    role: role.name,
    rules: role.permissions,
  })));

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(63),
        Validators.pattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/),
      ],
    }),
    permissions: new FormArray<PermissionForm>([]),
  });

  constructor() {
    this.store.loadResourceTypes()
      .pipe(catchError(() => EMPTY), takeUntilDestroyed(this.destroyRef))
      .subscribe();

    toObservable(this.projectId)
      .pipe(
        distinctUntilChanged(),
        tap(() => {
          this.editorOpen.set(false);
          this.editing.set(null);
          this.deleteTarget.set(null);
          this.success.set(null);
          this.store.error.set(null);
        }),
        switchMap((projectId) =>
          this.store.load(projectId).pipe(catchError(() => EMPTY)),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  openEditor(role: ProjectRole | null = null): void {
    if (role?.name === 'admin') return;
    this.editing.set(role);
    this.form.controls.name.setValue(role?.name ?? '');
    this.form.controls.name.setErrors(null);
    if (role) this.form.controls.name.disable();
    else this.form.controls.name.enable();
    this.setPermissionMatrix(role);
    this.editorOpen.set(true);
    this.deleteTarget.set(null);
    this.store.error.set(null);
    this.validationError.set(null);
    this.success.set(null);
  }

  closeEditor(): void {
    if (this.store.saving()) return;
    this.editorOpen.set(false);
    this.editing.set(null);
    this.store.error.set(null);
    this.validationError.set(null);
  }

  save(): void {
    if (this.store.saving()) return;
    this.form.markAllAsTouched();
    this.validationError.set(null);
    if (this.form.invalid) {
      this.validationError.set('Enter a valid role name and complete every permission.');
      return;
    }
    const projectId = this.projectId();
    const role = this.editing();
    const permissions: RolePermission[] = this.form.controls.permissions.getRawValue().flatMap((row) =>
      permissionActions
        .filter((action) => row[action])
        .map((action) => ({ resource: row.resource, action })),
    );
    const request = role
      ? this.store.update(projectId, role.name, { permissions } satisfies UpdateRoleDto)
      : this.store.create(projectId, {
          name: this.form.controls.name.getRawValue().trim(),
          permissions,
        } satisfies CreateRoleDto);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.projectId() !== projectId) return;
        this.editorOpen.set(false);
        this.editing.set(null);
        this.success.set(role ? 'Role updated.' : 'Role created.');
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 409) this.validationError.set('A role with this name already exists or the project changed. Refresh and try again.');
      },
    });
  }

  confirmDelete(role: ProjectRole): void {
    if (role.name === 'admin') return;
    this.deleteTarget.set(role);
    this.store.error.set(null);
    this.success.set(null);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  deleteRole(): void {
    const role = this.deleteTarget();
    if (!role || this.store.deleting()) return;
    const projectId = this.projectId();
    this.store.delete(projectId, role.name).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.projectId() !== projectId) return;
        this.deleteTarget.set(null);
        this.success.set('Role deleted.');
      },
      error: () => {},
    });
  }

  private setPermissionMatrix(role: ProjectRole | null): void {
    const permissionsByResource = new Map<string, Set<string>>();
    const resources = new Set(this.store.resourceTypes());
    for (const permission of role?.permissions ?? []) {
      resources.add(permission.resource);
      const actions = permissionsByResource.get(permission.resource) ?? new Set<string>();
      actions.add(permission.action);
      permissionsByResource.set(permission.resource, actions);
    }
    resources.add('project');

    const orderedResources = [
      ...this.store.resourceTypes(),
      ...Array.from(resources).filter((resource) => !this.store.resourceTypes().includes(resource)).sort(),
    ];
    const rows = this.form.controls.permissions;
    rows.clear();
    for (const resource of orderedResources) {
      const selectedActions = permissionsByResource.get(resource) ?? new Set<string>();
      if (!role) selectedActions.add('read');
      if (resource === 'project') selectedActions.add('read');
      const row = new FormGroup({
        resource: new FormControl(resource, { nonNullable: true }),
        create: new FormControl(selectedActions.has('create'), { nonNullable: true }),
        read: new FormControl(selectedActions.has('read'), { nonNullable: true }),
        update: new FormControl(selectedActions.has('update'), { nonNullable: true }),
        delete: new FormControl(selectedActions.has('delete'), { nonNullable: true }),
      });
      if (resource === 'project') row.controls.read.disable();
      rows.push(row);
    }
  }
}
