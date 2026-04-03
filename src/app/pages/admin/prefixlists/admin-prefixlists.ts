import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Placeholder } from '../../../shared/components/common/placeholder/placeholder';
import { AdminStore } from '../store/admin.store';
import { PrefixList } from '../store/admin.types';

type PrefixListFilterMode = 'all' | 'controller-only' | 'exclude-controller';

@Component({
  selector: 'app-admin-prefixlists',
  imports: [Placeholder],
  templateUrl: './admin-prefixlists.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPrefixlists implements OnInit, OnDestroy {
  private readonly adminStore = inject(AdminStore);
  private refreshIntervalId: number | null = null;

  readonly filterMode = signal<PrefixListFilterMode>('all');
  readonly state = this.adminStore.prefixlistsState;
  readonly prefixlists = computed(() => this.state().items as PrefixList[]);
  readonly filteredPrefixlists = computed(() => {
    const mode = this.filterMode();
    const items = this.prefixlists();

    if (mode === 'controller-only') {
      return items.filter((item) => item.spec?.source === 'Controller');
    }

    if (mode === 'exclude-controller') {
      return items.filter((item) => item.spec?.source !== 'Controller');
    }

    return items;
  });
  readonly staticCount = computed(
    () => this.prefixlists().filter((item) => item.spec?.source === 'Static').length
  );
  readonly bgpCount = computed(() => this.prefixlists().filter((item) => item.spec?.source === 'Bgp').length);
  readonly controllerCount = computed(
    () => this.prefixlists().filter((item) => item.spec?.source === 'Controller').length
  );

  setFilterMode(mode: PrefixListFilterMode): void {
    this.filterMode.set(mode);
  }

  filterButtonClass(mode: PrefixListFilterMode): string {
    const isActive = this.filterMode() === mode;

    if (isActive) {
      return 'rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800 shadow-theme-xs';
    }

    return 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50';
  }

  prefixListName(prefixList: PrefixList): string {
    return prefixList.metadata?.name ?? 'Unnamed prefix list';
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
    this.adminStore.loadPrefixlists();

    this.refreshIntervalId = window.setInterval(() => {
      this.adminStore.loadPrefixlists(true);
    }, 10000);
  }

  refreshPrefixlists(): void {
    this.adminStore.loadPrefixlists(true);
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId !== null) {
      window.clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }
}
