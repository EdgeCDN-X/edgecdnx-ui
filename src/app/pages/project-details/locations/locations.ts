import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { LocationStore } from '../../projects/store/location.store';
import { CreateLocationDto, ProjectLocation, UpdateLocationDto } from '../../projects/store/location.types';
import { LocationForm } from './location-form';
import { HealthCheckProfileStore } from '../../projects/store/healthcheckprofile.store';
import { LocationLabels } from './location-labels';

@Component({
  selector: 'app-project-locations',
  imports: [LocationForm, RouterLink, LocationLabels],
  providers: [LocationStore, HealthCheckProfileStore],
  templateUrl: './locations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Locations {
  readonly store = inject(LocationStore);
  readonly profileStore = inject(HealthCheckProfileStore);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly projectId = toSignal(this.route.parent!.paramMap.pipe(map((params) => params.get('name') ?? '')), { initialValue: '' });
  readonly selectedLabels = toSignal(this.route.queryParamMap.pipe(map((params) => [...new Set(params.getAll('label'))])), { initialValue: [] });
  readonly visibleLocations = computed(() => this.store.locations().filter((location) =>
    this.selectedLabels().every((label) => {
      const separator = label.indexOf('=');
      return separator > 0 && location.metadata.labels?.[label.slice(0, separator)] === label.slice(separator + 1);
    }),
  ));

  withoutLabel(label: string): string[] | null {
    const labels = this.selectedLabels().filter((item) => item !== label);
    return labels.length ? labels : null;
  }
  readonly editorOpen = signal(false);
  readonly editing = signal<ProjectLocation | null>(null);
  readonly deleteTarget = signal<ProjectLocation | null>(null);
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
      const profiles = this.profileStore.load(projectId).subscribe({ error: () => {} });
      onCleanup(() => { subscription.unsubscribe(); profiles.unsubscribe(); });
    });
  }

  refresh(): void { this.refreshVersion.update((version) => version + 1); }

  openEditor(location: ProjectLocation | null = null): void {
    this.editing.set(location);
    this.editorOpen.set(true);
    this.deleteTarget.set(null);
    this.store.error.set(null);
    this.success.set(null);
    this.focus('#location-name');
  }

  closeEditor(): void {
    if (this.store.saving()) return;
    this.editorOpen.set(false);
    this.editing.set(null);
    this.store.error.set(null);
    this.focus('#new-location');
  }

  save(dto: CreateLocationDto | UpdateLocationDto): void {
    const projectId = this.projectId();
    const location = this.editing();
    const request = location
      ? this.store.update(projectId, location.metadata.name, dto)
      : this.store.create(projectId, dto as CreateLocationDto);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.projectId() !== projectId) return;
        this.editorOpen.set(false);
        this.editing.set(null);
        this.success.set(location ? 'Location updated.' : 'Location created.');
        this.focus('#new-location');
      },
      error: () => {},
    });
  }

  confirmDelete(location: ProjectLocation): void {
    this.deleteTarget.set(location);
    this.store.error.set(null);
    this.success.set(null);
    this.focus('#cancel-location-delete');
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
    this.focus('#new-location');
  }

  deleteLocation(): void {
    const location = this.deleteTarget();
    if (!location || this.store.deleting()) return;
    const projectId = this.projectId();
    this.store.delete(projectId, location.metadata.name).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.projectId() !== projectId) return;
        this.deleteTarget.set(null);
        this.success.set('Location deleted.');
        this.focus('#new-location');
      },
      error: () => {},
    });
  }

  nodeCount(location: ProjectLocation): number {
    return (location.spec?.nodeGroups ?? []).reduce((total, group) => total + (group.nodes?.length ?? 0), 0);
  }

  private focus(selector: string): void {
    afterNextRender(() => {
      const element = this.host.nativeElement.querySelector<HTMLElement>(selector);
      if (element instanceof HTMLInputElement && element.disabled) {
        this.host.nativeElement.querySelector<HTMLElement>('#location-weight')?.focus();
      } else element?.focus();
    }, { injector: this.injector });
  }
}