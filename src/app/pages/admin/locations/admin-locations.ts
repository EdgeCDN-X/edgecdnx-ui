import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Placeholder } from '../../../shared/components/common/placeholder/placeholder';
import { AdminStore } from '../store/admin.store';
import { GeoLookupAttribute, Location, Node, NodeGroup } from '../store/admin.types';

type GeoAttributeEntry = {
  key: string;
  attribute: GeoLookupAttribute;
};

type KeyValueEntry = {
  key: string;
  value: string;
};

@Component({
  selector: 'app-admin-locations',
  imports: [Placeholder],
  templateUrl: './admin-locations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLocations implements OnInit, OnDestroy {
  private readonly adminStore = inject(AdminStore);
  private refreshIntervalId: number | null = null;

  readonly nameFilter = signal('');
  readonly showSublocationsOnly = signal(false);
  readonly openLocations = signal<Record<string, boolean>>({});
  readonly openGeoDetails = signal<Record<string, boolean>>({});
  readonly openNodeGroupDetails = signal<Record<string, boolean>>({});
  readonly openStandaloneNodes = signal<Record<string, boolean>>({});
  readonly openNodeGroupItemDetails = signal<Record<string, boolean>>({});

  readonly state = this.adminStore.locationsState;
  readonly locations = computed(() => this.state().items as Location[]);
  readonly filteredLocations = computed(() => {
    const filter = this.nameFilter().trim().toLowerCase();
    const sublocationsOnly = this.showSublocationsOnly();

    return this.locations().filter((location) => {
      if (sublocationsOnly && !location.spec?.parent?.trim()) {
        return false;
      }

      if (!filter) {
        return true;
      }

      return this.matchesNameFilter(this.locationName(location), filter);
    });
  });
  readonly totalNodes = computed(() => this.locations().reduce((sum, item) => sum + (item.spec?.nodes?.length ?? 0), 0));
  readonly totalNodeGroups = computed(() => this.locations().reduce((sum, item) => sum + (item.spec?.nodeGroups?.length ?? 0), 0));
  readonly maintenanceCount = computed(
    () => this.locations().filter((item) => item.spec?.maintenanceMode).length
  );

  locationName(location: Location): string {
    return location.metadata?.name ?? 'Unnamed location';
  }

  setNameFilter(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.nameFilter.set(target?.value ?? '');
  }

  toggleShowSublocationsOnly(): void {
    this.showSublocationsOnly.update((current) => !current);
  }

  locationKey(location: Location): string {
    return location.metadata?.uid ?? location.metadata?.name ?? this.locationName(location);
  }

  nodeGroupKey(location: Location, nodeGroup: NodeGroup, index: number): string {
    return `${this.locationKey(location)}::${nodeGroup.name}::${nodeGroup.flavor || ''}::${index}`;
  }

  isLocationOpen(location: Location): boolean {
    return this.openLocations()[this.locationKey(location)] ?? false;
  }

  isGeoDetailsOpen(location: Location): boolean {
    return this.openGeoDetails()[this.locationKey(location)] ?? false;
  }

  isNodeGroupDetailsOpen(location: Location): boolean {
    const key = this.locationKey(location);
    const explicit = this.openNodeGroupDetails()[key];
    if (explicit !== undefined) {
      return explicit;
    }

    return (location.spec?.nodeGroups?.length ?? 0) === 1;
  }

  isStandaloneNodesOpen(location: Location): boolean {
    return this.openStandaloneNodes()[this.locationKey(location)] ?? false;
  }

  isNodeGroupItemOpen(location: Location, nodeGroup: NodeGroup, index: number): boolean {
    const key = this.nodeGroupKey(location, nodeGroup, index);
    const explicit = this.openNodeGroupItemDetails()[key];
    if (explicit !== undefined) {
      return explicit;
    }

    return index === 0;
  }

  onLocationToggle(location: Location, event: Event): void {
    this.setOpenState(this.openLocations, this.locationKey(location), this.extractOpen(event));
  }

  onGeoDetailsToggle(location: Location, event: Event): void {
    this.setOpenState(this.openGeoDetails, this.locationKey(location), this.extractOpen(event));
  }

  onNodeGroupDetailsToggle(location: Location, event: Event): void {
    this.setOpenState(this.openNodeGroupDetails, this.locationKey(location), this.extractOpen(event));
  }

  onStandaloneNodesToggle(location: Location, event: Event): void {
    this.setOpenState(this.openStandaloneNodes, this.locationKey(location), this.extractOpen(event));
  }

  onNodeGroupItemToggle(location: Location, nodeGroup: NodeGroup, index: number, event: Event): void {
    this.setOpenState(
      this.openNodeGroupItemDetails,
      this.nodeGroupKey(location, nodeGroup, index),
      this.extractOpen(event)
    );
  }

  sublocationFilterButtonClass(): string {
    if (this.showSublocationsOnly()) {
      return 'rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800 shadow-theme-xs';
    }

    return 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50';
  }

  private matchesNameFilter(name: string, filter: string): boolean {
    const normalizedName = name.toLowerCase();
    if (normalizedName.includes(filter)) {
      return true;
    }

    return this.isSubsequenceMatch(normalizedName, filter);
  }

  private isSubsequenceMatch(value: string, query: string): boolean {
    let queryIndex = 0;

    for (let i = 0; i < value.length && queryIndex < query.length; i += 1) {
      if (value[i] === query[queryIndex]) {
        queryIndex += 1;
      }
    }

    return queryIndex === query.length;
  }

  geoAttributeEntries(location: Location): GeoAttributeEntry[] {
    const attributes = location.spec?.geoLookup?.attributes;
    if (!attributes) {
      return [];
    }

    return Object.entries(attributes).map(([key, attribute]) => ({ key, attribute }));
  }

  nodeGroups(location: Location): NodeGroup[] {
    return location.spec?.nodeGroups ?? [];
  }

  nodeSelectorEntries(nodeGroup: NodeGroup): KeyValueEntry[] {
    const selector = nodeGroup.nodeSelector;
    if (!selector) {
      return [];
    }

    return Object.entries(selector).map(([key, value]) => ({ key, value }));
  }

  nodeGroupNodes(nodeGroup: NodeGroup): Node[] {
    return nodeGroup.nodes ?? [];
  }

  locationNodes(location: Location): Node[] {
    return location.spec?.nodes ?? [];
  }

  isLocationInMaintenance(location: Location): boolean {
    return !!location.spec?.maintenanceMode;
  }

  isNodeInMaintenance(node: Node): boolean {
    return !!node.maintenanceMode;
  }

  locationMaintenanceNodesCount(location: Location): number {
    const standalone = this.locationNodes(location).filter((node) => this.isNodeInMaintenance(node)).length;
    const grouped = this.nodeGroups(location)
      .flatMap((group) => this.nodeGroupNodes(group))
      .filter((node) => this.isNodeInMaintenance(node)).length;

    return standalone + grouped;
  }

  nodeGroupFlavor(nodeGroup: NodeGroup): string | null {
    const flavor = nodeGroup.flavor?.trim();
    return flavor ? flavor : null;
  }

  nodeGroupDisplayName(nodeGroup: NodeGroup): string {
    const flavor = this.nodeGroupFlavor(nodeGroup);
    return flavor ? `${nodeGroup.name}/${flavor}` : nodeGroup.name;
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
    this.adminStore.loadLocations();

    this.refreshIntervalId = window.setInterval(() => {
      this.adminStore.loadLocations(true);
    }, 10000);
  }

  refreshLocations(): void {
    this.adminStore.loadLocations(true);
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId !== null) {
      window.clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  private extractOpen(event: Event): boolean {
    const target = event.target as HTMLDetailsElement | null;
    return !!target?.open;
  }

  private setOpenState(
    store: {
      update: (updater: (value: Record<string, boolean>) => Record<string, boolean>) => void;
    },
    key: string,
    isOpen: boolean
  ): void {
    store.update((current) => ({
      ...current,
      [key]: isOpen,
    }));
  }
}
