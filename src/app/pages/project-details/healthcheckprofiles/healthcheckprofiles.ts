import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, Injector, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { HealthCheckProfileStore } from '../../projects/store/healthcheckprofile.store';
import { CreateHealthCheckProfileDto, HealthCheckProfile, UpdateHealthCheckProfileDto } from '../../projects/store/healthcheckprofile.types';
import { HealthCheckProfileForm } from './healthcheckprofile-form';

@Component({
  selector: 'app-healthcheckprofiles',
  imports: [HealthCheckProfileForm],
  providers: [HealthCheckProfileStore],
  templateUrl: './healthcheckprofiles.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthCheckProfiles {
  readonly store = inject(HealthCheckProfileStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly projectId = toSignal(this.route.parent!.paramMap.pipe(map((params) => params.get('name') ?? '')), { initialValue: '' });
  readonly editorOpen = signal(false);
  readonly editing = signal<HealthCheckProfile | null>(null);
  readonly deleteTarget = signal<HealthCheckProfile | null>(null);
  readonly success = signal<string | null>(null);
  private readonly refreshVersion = signal(0);
  private loadedProject = '';

  constructor() {
    effect((onCleanup) => {
      const projectId = this.projectId();
      this.refreshVersion();
      if (!projectId) return;
      if (this.loadedProject !== projectId) {
        this.editorOpen.set(false);
        this.editing.set(null);
        this.deleteTarget.set(null);
        this.success.set(null);
        this.loadedProject = projectId;
      }
      const subscription = this.store.load(projectId).subscribe({ error: () => {} });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  refresh(): void { this.refreshVersion.update((version) => version + 1); }

  openEditor(profile: HealthCheckProfile | null = null): void {
    this.editing.set(profile);
    this.editorOpen.set(true);
    this.deleteTarget.set(null);
    this.store.error.set(null);
    this.success.set(null);
    this.focus(profile ? '#probe-name-0' : '#profile-name');
  }

  closeEditor(): void {
    if (this.store.saving()) return;
    this.editorOpen.set(false);
    this.editing.set(null);
    this.store.error.set(null);
    this.focus('#new-profile');
  }

  save(dto: CreateHealthCheckProfileDto | UpdateHealthCheckProfileDto): void {
    const projectId = this.projectId();
    const profile = this.editing();
    const request = profile
      ? this.store.update(projectId, profile.metadata.name, dto)
      : 'name' in dto ? this.store.create(projectId, dto) : null;
    if (!request) {
      this.store.error.set('A profile name is required.');
      return;
    }
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.projectId() !== projectId) return;
        this.editorOpen.set(false);
        this.editing.set(null);
        this.success.set(profile ? 'Health check profile updated.' : 'Health check profile created.');
        this.focus('#new-profile');
      },
      error: () => {},
    });
  }

  confirmDelete(profile: HealthCheckProfile): void {
    this.deleteTarget.set(profile);
    this.store.error.set(null);
    this.success.set(null);
    this.focus('#cancel-profile-delete');
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
    this.focus('#new-profile');
  }

  deleteProfile(): void {
    const profile = this.deleteTarget();
    if (!profile || this.store.deleting()) return;
    const projectId = this.projectId();
    this.store.delete(projectId, profile.metadata.name).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.projectId() !== projectId) return;
        this.deleteTarget.set(null);
        this.success.set('Health check profile deleted.');
        this.focus('#new-profile');
      },
      error: () => {},
    });
  }

  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), { injector: this.injector });
  }
}
