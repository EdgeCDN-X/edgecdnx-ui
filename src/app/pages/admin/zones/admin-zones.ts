import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { Placeholder } from '../../../shared/components/common/placeholder/placeholder';
import { AdminStore } from '../store/admin.store';
import { Zone } from '../store/admin.types';

@Component({
  selector: 'app-admin-zones',
  imports: [Placeholder],
  templateUrl: './admin-zones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminZones implements OnInit, OnDestroy {
  private readonly adminStore = inject(AdminStore);
  private refreshIntervalId: number | null = null;

  readonly state = this.adminStore.zonesState;
  readonly zones = computed(() => this.state().items as Zone[]);
  readonly healthyCount = computed(() => this.zones().filter((item) => item.status?.status === 'Healthy').length);
  readonly progressingCount = computed(
    () => this.zones().filter((item) => item.status?.status === 'Progressing').length
  );
  readonly degradedCount = computed(() => this.zones().filter((item) => item.status?.status === 'Degraded').length);

  zoneName(zone: Zone): string {
    return zone.metadata?.name ?? zone.spec?.zone ?? 'Unnamed zone';
  }

  statusBadgeClass(status?: string): string {
    if (status === 'Healthy') {
      return 'inline-flex items-center rounded-full border border-success-200 bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-800';
    }
    if (status === 'Progressing') {
      return 'inline-flex items-center rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-semibold text-warning-900';
    }
    if (status === 'Degraded') {
      return 'inline-flex items-center rounded-full border border-error-200 bg-error-50 px-2.5 py-1 text-xs font-semibold text-error-800';
    }

    return 'inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700';
  }

  ngOnInit() {
    this.adminStore.loadZones();

    this.refreshIntervalId = window.setInterval(() => {
      this.adminStore.loadZones(true);
    }, 10000);
  }

  refreshZones(): void {
    this.adminStore.loadZones(true);
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId !== null) {
      window.clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }
}
