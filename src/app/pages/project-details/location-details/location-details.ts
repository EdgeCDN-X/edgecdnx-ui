import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { HEALTHCHECK_POLL_INTERVAL_MS, LocationHealthcheckStore } from '../../projects/store/location-healthcheck.store';
import { HealthcheckResult, HealthcheckSeries, NodeHealthStatus } from '../../projects/store/location-healthcheck.types';
import { LocationStore } from '../../projects/store/location.store';
import { HealthcheckBars } from './healthcheck-bars';
import { LocationLabels } from '../locations/location-labels';

@Component({
  selector: 'app-location-details',
  imports: [RouterLink, DatePipe, DecimalPipe, HealthcheckBars, LocationLabels],
  providers: [LocationStore, LocationHealthcheckStore],
  templateUrl: './location-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationDetails {
  readonly locationStore = inject(LocationStore);
  readonly healthStore = inject(LocationHealthcheckStore);
  private readonly route = inject(ActivatedRoute);

  readonly projectId = toSignal(this.route.parent!.paramMap.pipe(map((params) => params.get('name') ?? '')), { initialValue: '' });
  readonly locationName = toSignal(this.route.paramMap.pipe(map((params) => params.get('locationName') ?? '')), { initialValue: '' });
  readonly selectedLabels = toSignal(this.route.queryParamMap.pipe(map((params) => [...new Set(params.getAll('label'))])), { initialValue: [] });
  readonly location = computed(() => this.locationStore.locations().find((item) => item.metadata.name === this.locationName()) ?? null);
  readonly geoAttributes = computed(() => Object.entries(this.location()?.spec?.geoLookup?.attributes ?? {})
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([name, attribute]) => ({ name, ...attribute })));
  readonly nodes = computed(() => this.healthStore.healthchecks()?.nodes ?? []);
  readonly summary = computed(() => {
    const nodes = this.nodes();
    return {
      total: nodes.length,
      healthy: nodes.filter((node) => node.status === 'Healthy').length,
      unhealthy: nodes.filter((node) => node.status === 'Unhealthy').length,
      unknown: nodes.filter((node) => node.status === 'Unknown').length,
    };
  });
  readonly windowMinutes = computed(() => {
    const data = this.healthStore.healthchecks();
    return data ? Math.round((Date.parse(data.to) - Date.parse(data.from)) / 60_000) : 0;
  });
  readonly pollSeconds = HEALTHCHECK_POLL_INTERVAL_MS / 1000;

  constructor() {
    effect((onCleanup) => {
      const projectId = this.projectId();
      const locationName = this.locationName();
      if (!projectId || !locationName) return;
      const location = this.locationStore.load(projectId).subscribe({ error: () => {} });
      const polling = this.healthStore.poll(projectId, locationName).subscribe();
      onCleanup(() => { location.unsubscribe(); polling.unsubscribe(); });
    });
  }

  refresh(): void {
    this.healthStore.load(this.projectId(), this.locationName()).subscribe({ error: () => {} });
  }

  latest(series: Pick<HealthcheckSeries, 'results'>): HealthcheckResult | undefined {
    return series.results[series.results.length - 1];
  }

  uptime(series: Pick<HealthcheckSeries, 'results'>): number {
    if (series.results.length === 0) return 0;
    return (series.results.filter((result) => result.alive).length / series.results.length) * 100;
  }

  averageDuration(series: Pick<HealthcheckSeries, 'results'>): number | null {
    const durations = series.results.map((result) => result.durationMs).filter((value): value is number => value !== undefined);
    return durations.length === 0 ? null : durations.reduce((total, value) => total + value, 0) / durations.length;
  }

  statusClass(status: NodeHealthStatus): string {
    switch (status) {
      case 'Healthy': return 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500';
      case 'Unhealthy': return 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-500';
      default: return 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-400';
    }
  }
}
