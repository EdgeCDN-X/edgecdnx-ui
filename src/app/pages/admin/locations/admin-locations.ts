import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Placeholder } from '../../../shared/components/common/placeholder/placeholder';
import { AdminStore } from '../store/admin.store';
import { GeoLookupAttribute, Location, LocationHealthAlert, LocationHealthItem, LocationHealthNode, LocationHealthSource, Node, NodeGroup, PrometheusAlertMatcher } from '../store/admin.types';

type GeoAttributeEntry = {
  key: string;
  attribute: GeoLookupAttribute;
};

type KeyValueEntry = {
  key: string;
  value: string;
};

type AlertDisplayEntry = {
  key: string;
  alertName: string;
  labels: KeyValueEntry[];
  isFiring: boolean;
  timestamp?: number;
};

const PROMETHEUS_ALERTS_SOURCE = 'prometheus-alerts';

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
  readonly selectedSource = signal('all');
  readonly showSublocationsOnly = signal(false);
  readonly showUnhealthyNodesOnly = signal(false);
  readonly openLocations = signal<Record<string, boolean>>({});
  readonly openGeoDetails = signal<Record<string, boolean>>({});
  readonly openNodeGroupDetails = signal<Record<string, boolean>>({});
  readonly openStandaloneNodes = signal<Record<string, boolean>>({});
  readonly openNodeGroupItemDetails = signal<Record<string, boolean>>({});

  readonly state = this.adminStore.locationsState;
  readonly healthState = this.adminStore.locationHealthsState;
  readonly locations = computed(() => this.state().items as Location[]);
  readonly availableSources = computed(() => {
    const sources = new Set<string>();
    for (const location of this.locations()) {
      for (const source of this.displayLocationHealthSources(location)) {
        sources.add(source.source);
      }
    }

    return Array.from(sources).sort((left, right) => left.localeCompare(right));
  });
  readonly isRefreshing = computed(() => this.state().loading || this.healthState().loading);
  readonly locationHealthByName = computed(() => {
    const index = new Map<string, LocationHealthItem>();
    for (const item of this.healthState().items) {
      index.set(item.name, item);
    }

    return index;
  });
  readonly filteredLocations = computed(() => {
    const filter = this.nameFilter().trim().toLowerCase();
    const sublocationsOnly = this.showSublocationsOnly();
    const selectedSource = this.selectedSource();
    const unhealthyOnly = this.showUnhealthyNodesOnly();

    return this.locations().filter((location) => {
      if (sublocationsOnly && !location.spec?.parent?.trim()) {
        return false;
      }

      if (!filter) {
        return this.matchesHealthFilters(location, selectedSource, unhealthyOnly);
      }

      if (!this.matchesNameFilter(this.locationName(location), filter)) {
        return false;
      }

      return this.matchesHealthFilters(location, selectedSource, unhealthyOnly);
    });
  });
  readonly totalNodes = computed(() => this.locations().reduce((sum, item) => sum + (item.spec?.nodes?.length ?? 0), 0));
  readonly totalNodeGroups = computed(() => this.locations().reduce((sum, item) => sum + (item.spec?.nodeGroups?.length ?? 0), 0));
  readonly maintenanceCount = computed(
    () => this.locations().filter((item) => item.spec?.maintenanceMode).length
  );
  readonly unhealthyNodeCount = computed(() => {
    return this.filteredLocations().reduce((sum, location) => {
      return sum + this.displayLocationHealthSources(location).reduce((sourceSum, source) => sourceSum + source.unhealthyNodes, 0);
    }, 0);
  });
  readonly firingLocationAlertCount = computed(() => {
    return this.filteredLocations().reduce((sum, location) => sum + this.locationAlerts(location).length, 0);
  });
  readonly locationsWithHealthIssuesCount = computed(() => {
    return this.filteredLocations().filter((location) => this.locationHasUnhealthyNodes(location)).length;
  });
  readonly unmatchedMetricsCount = computed(() => {
    return this.visibleUnmatchedMetrics().length;
  });

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

  selectSource(source: string): void {
    this.selectedSource.set(source);
  }

  toggleShowUnhealthyNodesOnly(): void {
    this.showUnhealthyNodesOnly.update((current) => !current);
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
      return 'rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300';
    }

    return 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]';
  }

  sourceFilterButtonClass(source: string): string {
    if (this.selectedSource() === source) {
      return 'rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300';
    }

    return 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]';
  }

  unhealthyNodesFilterButtonClass(): string {
    if (this.showUnhealthyNodesOnly()) {
      return 'rounded-lg border border-error-300 bg-error-50 px-3 py-2 text-xs font-semibold text-error-900 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300';
    }

    return 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.05]';
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

  locationHealth(location: Location): LocationHealthItem | undefined {
    return this.locationHealthByName().get(this.locationName(location));
  }

  allLocationHealthSources(location: Location): LocationHealthSource[] {
    return this.locationHealth(location)?.sources ?? [];
  }

  displayLocationHealthSources(location: Location): LocationHealthSource[] {
    return this.allLocationHealthSources(location).filter((source) => !this.isRedundantLocationAlertSource(source));
  }

  locationAlerts(location: Location): LocationHealthAlert[] {
    return this.locationHealth(location)?.alerts ?? [];
  }

  hasLocationAlerts(location: Location): boolean {
    return this.locationAlerts(location).length > 0;
  }

  configuredLocationAlerts(location: Location): AlertDisplayEntry[] {
    return this.buildAlertDisplayEntries(location.spec?.alerts ?? [], this.locationAlerts(location));
  }

  visibleLocationHealthSources(location: Location): LocationHealthSource[] {
    const sources = this.displayLocationHealthSources(location);
    if (sources.length === 0) {
      return [];
    }

    const selectedSource = this.selectedSource();
    const unhealthyOnly = this.showUnhealthyNodesOnly();

    return sources
      .filter((source) => selectedSource === 'all' || source.source === selectedSource)
      .map((source) => this.filterHealthSource(source, unhealthyOnly))
      .filter((source) => source.nodes.length > 0);
  }

  locationHealthTotalNodes(location: Location): number {
    return this.visibleLocationHealthSources(location).reduce((sum, source) => sum + source.totalNodes, 0);
  }

  locationHealthHealthyNodes(location: Location): number {
    return this.visibleLocationHealthSources(location).reduce((sum, source) => sum + source.healthyNodes, 0);
  }

  locationHealthUnhealthyNodes(location: Location): number {
    return this.visibleLocationHealthSources(location).reduce((sum, source) => sum + source.unhealthyNodes, 0);
  }

  locationHealthUnknownNodes(location: Location): number {
    return this.visibleLocationHealthSources(location).reduce((sum, source) => sum + source.unknownNodes, 0);
  }

  locationHasUnhealthyNodes(location: Location): boolean {
    return this.hasLocationAlerts(location) || this.displayLocationHealthSources(location).some((source) => source.unhealthyNodes > 0);
  }

  showCollapsedHealthWarning(location: Location): boolean {
    return !this.isLocationOpen(location) && this.locationHasUnhealthyNodes(location);
  }

  locationHealthStatusText(location: Location): string {
    const sources = this.displayLocationHealthSources(location);
    const alertCount = this.locationAlerts(location).length;
    if (sources.length === 0 && alertCount === 0) {
      return 'No health data';
    }
    if (alertCount > 0) {
      return alertCount === 1 ? 'Location alert firing' : `${alertCount} location alerts firing`;
    }
    if (sources.some((source) => source.unhealthyNodes > 0)) {
      return 'Issues detected';
    }

    return 'Healthy across sources';
  }

  locationHealthStatusBadgeClass(location: Location): string {
    const sources = this.displayLocationHealthSources(location);
    if (sources.length === 0 && !this.hasLocationAlerts(location)) {
      return 'inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-white/[0.06] dark:text-gray-300';
    }

    if (this.hasLocationAlerts(location) || sources.some((source) => source.unhealthyNodes > 0)) {
      return 'inline-flex items-center rounded-full border border-error-200 bg-error-100 px-2.5 py-1 text-xs font-semibold text-error-900 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300';
    }

    return 'inline-flex items-center rounded-full border border-success-200 bg-success-100 px-2.5 py-1 text-xs font-semibold text-success-900 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-300';
  }

  sourceCardClass(source: LocationHealthSource): string {
    if (source.unhealthyNodes > 0) {
      return 'rounded-2xl border border-error-200 bg-white p-4 shadow-sm dark:border-error-500/30 dark:bg-white/[0.03] dark:ring-1 dark:ring-error-500/20';
    }

    return 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]';
  }

  nodeHealthCardClass(node: LocationHealthNode): string {
    if (!node.matched) {
      return 'rounded-xl border border-warning-200 bg-warning-50 p-3 dark:border-warning-500/30 dark:bg-warning-500/12';
    }
    if (!node.healthy) {
      return 'rounded-xl border border-error-200 bg-error-50 p-3 dark:border-error-500/30 dark:bg-error-500/12';
    }

    return 'rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]';
  }

  nodeHealthBadgeClass(node: LocationHealthNode): string {
    if (!node.healthy) {
      return 'rounded-full border border-error-200 bg-error-100 px-2 py-0.5 text-xs font-semibold text-error-900 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300';
    }

    return 'rounded-full border border-success-200 bg-success-100 px-2 py-0.5 text-xs font-semibold text-success-900 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-300';
  }

  nodeHealthText(node: LocationHealthNode): string {
    return node.healthy ? 'Healthy' : 'Unhealthy';
  }

  nodeAlerts(node: LocationHealthNode): LocationHealthAlert[] {
    return node.alerts ?? [];
  }

  hasNodeAlerts(node: LocationHealthNode): boolean {
    return this.nodeAlerts(node).length > 0;
  }

  configuredNodeAlerts(location: Location, node: Node, nodeGroup?: NodeGroup): AlertDisplayEntry[] {
    return this.buildAlertDisplayEntries(node.alerts ?? [], this.nodeFiringAlerts(location, node, nodeGroup));
  }

  alertDisplayCardClass(alert: AlertDisplayEntry): string {
    if (alert.isFiring) {
      return 'rounded-xl border border-error-100 bg-white p-3 dark:border-error-500/20 dark:bg-white/[0.03]';
    }

    return 'rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]';
  }

  alertDisplayBadgeClass(alert: AlertDisplayEntry): string {
    if (alert.isFiring) {
      return 'rounded-full bg-error-100 px-2 py-0.5 text-xs font-semibold text-error-900 dark:bg-error-500/15 dark:text-error-300';
    }

    return 'rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-white/[0.08] dark:text-gray-300';
  }

  alertDisplayStatusText(alert: AlertDisplayEntry): string {
    return alert.isFiring ? 'Firing' : 'Configured';
  }

  locationAlertSectionClass(location: Location): string {
    if (this.hasLocationAlerts(location)) {
      return 'mt-3 rounded-xl border border-error-200 bg-error-50 p-4 dark:border-error-500/30 dark:bg-error-500/12';
    }

    return 'mt-3 rounded-xl border border-gray-200 bg-gray-25 p-4 dark:border-gray-800 dark:bg-white/[0.02]';
  }

  locationAlertSectionEyebrowClass(location: Location): string {
    if (this.hasLocationAlerts(location)) {
      return 'm-0 text-xs uppercase tracking-wider text-error-700 dark:text-error-300';
    }

    return 'm-0 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400';
  }

  locationAlertSectionDescriptionClass(location: Location): string {
    if (this.hasLocationAlerts(location)) {
      return 'mt-1 text-sm text-error-900 dark:text-error-300';
    }

    return 'mt-1 text-sm text-gray-700 dark:text-gray-300';
  }

  locationAlertSectionCountClass(location: Location): string {
    if (this.hasLocationAlerts(location)) {
      return 'rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-error-900 shadow-sm dark:bg-white/[0.08] dark:text-error-300';
    }

    return 'rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm dark:bg-white/[0.08] dark:text-gray-300';
  }

  locationAlertLabelEntries(location: Location, alert: LocationHealthAlert): KeyValueEntry[] {
    const matcher = this.resolveAlertMatcher(location.spec?.alerts ?? [], alert);
    return this.matcherLabelEntries(matcher);
  }

  nodeAlertLabelEntries(location: Location, nodeHealth: LocationHealthNode, alert: LocationHealthAlert): KeyValueEntry[] {
    if (nodeHealth.alertScope === 'location') {
      return this.locationAlertLabelEntries(location, alert);
    }

    const matcher = this.resolveAlertMatcher(this.nodeAlertMatchers(location, nodeHealth), alert);
    return this.matcherLabelEntries(matcher);
  }

  alertTimestampText(alert: { timestamp?: number }): string | null {
    if (!alert.timestamp) {
      return null;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(alert.timestamp * 1000));
  }

  nodeHealthIdentity(node: LocationHealthNode): string {
    if (node.nodeName?.trim()) {
      return node.nodeName;
    }

    return 'Unmatched target';
  }

  nodeGroupLabel(node: LocationHealthNode): string | null {
    if (!node.nodeGroupName?.trim()) {
      return null;
    }

    if (node.nodeGroupFlavor?.trim()) {
      return `${node.nodeGroupName}/${node.nodeGroupFlavor}`;
    }

    return node.nodeGroupName;
  }

  visibleUnmatchedMetrics(): LocationHealthNode[] {
    const selectedSource = this.selectedSource();
    const unhealthyOnly = this.showUnhealthyNodesOnly();

    return this.healthState().unmatchedMetrics.filter((metric) => {
      if (selectedSource !== 'all' && metric.source !== selectedSource) {
        return false;
      }
      if (unhealthyOnly && metric.healthy) {
        return false;
      }

      return true;
    });
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

  configuredLocationAlertCount(location: Location): number {
    return location.spec?.alerts?.length ?? 0;
  }

  configuredNodeAlertCount(location: Location): number {
    const standaloneCount = this.locationNodes(location).reduce((sum, node) => sum + (node.alerts?.length ?? 0), 0);
    const groupedCount = this.nodeGroups(location)
      .flatMap((group) => this.nodeGroupNodes(group))
      .reduce((sum, node) => sum + (node.alerts?.length ?? 0), 0);

    return standaloneCount + groupedCount;
  }

  statusBadgeClass(status?: string): string {
    if (status === 'Healthy') {
      return 'inline-flex items-center rounded-full border border-success-200 bg-success-100 px-2.5 py-1 text-xs font-semibold text-success-900 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-300';
    }
    if (status === 'Progressing') {
      return 'inline-flex items-center rounded-full border border-warning-200 bg-warning-100 px-2.5 py-1 text-xs font-semibold text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-300';
    }
    if (status === 'Degraded') {
      return 'inline-flex items-center rounded-full border border-error-200 bg-error-100 px-2.5 py-1 text-xs font-semibold text-error-900 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300';
    }

    return 'inline-flex items-center rounded-full border border-gray-200 bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-white/[0.06] dark:text-gray-300';
  }

  ngOnInit() {
    this.adminStore.loadLocations();
    this.adminStore.loadLocationHealths();

    this.refreshIntervalId = window.setInterval(() => {
      this.adminStore.loadLocations(true);
      this.adminStore.loadLocationHealths(true);
    }, 10000);
  }

  refreshLocations(): void {
    this.adminStore.loadLocations(true);
    this.adminStore.loadLocationHealths(true);
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

  private matchesHealthFilters(location: Location, selectedSource: string, unhealthyOnly: boolean): boolean {
    const sources = this.displayLocationHealthSources(location);
    if (selectedSource !== 'all') {
      if (!sources.some((source) => source.source === selectedSource)) {
        return false;
      }
    }

    if (!unhealthyOnly) {
      return true;
    }

    if (selectedSource === 'all' && this.hasLocationAlerts(location)) {
      return true;
    }

    return sources
      .filter((source) => selectedSource === 'all' || source.source === selectedSource)
      .some((source) => source.nodes.some((node) => !node.healthy));
  }

  private filterHealthSource(source: LocationHealthSource, unhealthyOnly: boolean): LocationHealthSource {
    const nodes = unhealthyOnly ? source.nodes.filter((node) => !node.healthy) : source.nodes;
    const healthyNodes = nodes.filter((node) => node.healthy).length;
    const unhealthyNodes = nodes.length - healthyNodes;
    const unknownNodes = nodes.filter((node) => !node.matched).length;

    return {
      ...source,
      nodes,
      totalNodes: nodes.length,
      healthyNodes,
      unhealthyNodes,
      unknownNodes,
    };
  }

  private isRedundantLocationAlertSource(source: LocationHealthSource): boolean {
    if (source.source !== PROMETHEUS_ALERTS_SOURCE) {
      return false;
    }

    return source.nodes.length > 0 && source.nodes.every((node) => node.alertScope === 'location');
  }

  private matcherLabelEntries(matcher?: PrometheusAlertMatcher): KeyValueEntry[] {
    const labels = matcher?.labels;
    if (!labels) {
      return [];
    }

    return Object.entries(labels)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, value]) => ({ key, value }));
  }

  private resolveAlertMatcher(matchers: PrometheusAlertMatcher[], alert: LocationHealthAlert): PrometheusAlertMatcher | undefined {
    const matching = matchers
      .filter((matcher) => matcher.alertName === alert.alertName)
      .filter((matcher) => this.matcherLabelsMatchAlert(matcher, alert))
      .sort((left, right) => this.matcherLabelCount(right) - this.matcherLabelCount(left));

    return matching[0];
  }

  private matcherLabelsMatchAlert(matcher: PrometheusAlertMatcher, alert: LocationHealthAlert): boolean {
    const matcherLabels = matcher.labels;
    if (!matcherLabels) {
      return true;
    }

    const alertLabels = alert.labels ?? {};
    return Object.entries(matcherLabels).every(([key, value]) => alertLabels[key] === value);
  }

  private matcherLabelCount(matcher: PrometheusAlertMatcher): number {
    return Object.keys(matcher.labels ?? {}).length;
  }

  private buildAlertDisplayEntries(
    matchers: PrometheusAlertMatcher[],
    firingAlerts: LocationHealthAlert[]
  ): AlertDisplayEntry[] {
    const entries = matchers.map((matcher, index) => {
      const matchedAlert = firingAlerts.find((alert) => this.alertMatchesMatcher(alert, matcher));
      const labels = this.matcherLabelEntries(matcher);
      const labelKey = labels.map((entry) => `${entry.key}=${entry.value}`).join('|');

      return {
        key: `${matcher.alertName}-${labelKey}-${index}`,
        alertName: matcher.alertName,
        labels,
        isFiring: !!matchedAlert,
        timestamp: matchedAlert?.timestamp,
      };
    });

    const unmatchedFiringEntries = firingAlerts
      .filter((alert) => !matchers.some((matcher) => this.alertMatchesMatcher(alert, matcher)))
      .map((alert, index) => ({
        key: `${alert.alertName}-firing-${index}`,
        alertName: alert.alertName,
        labels: Object.entries(alert.labels ?? {})
          .filter(([key]) => key !== 'alertname' && key !== 'alertstate')
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
          .map(([key, value]) => ({ key, value })),
        isFiring: true,
        timestamp: alert.timestamp,
      }));

    return [...entries, ...unmatchedFiringEntries];
  }

  private alertMatchesMatcher(alert: LocationHealthAlert, matcher: PrometheusAlertMatcher): boolean {
    if (alert.alertName !== matcher.alertName) {
      return false;
    }

    return this.matcherLabelsMatchAlert(matcher, alert);
  }

  private nodeFiringAlerts(location: Location, node: Node, nodeGroup?: NodeGroup): LocationHealthAlert[] {
    const firingAlerts = this.allLocationHealthSources(location)
      .flatMap((source) => source.nodes)
      .filter((nodeHealth) => nodeHealth.nodeName === node.name)
      .filter((nodeHealth) => {
        if (!nodeGroup) {
          return !nodeHealth.nodeGroupName;
        }

        return nodeHealth.nodeGroupName === nodeGroup.name && (nodeHealth.nodeGroupFlavor ?? '') === (nodeGroup.flavor ?? '');
      })
      .flatMap((nodeHealth) => nodeHealth.alerts ?? []);

    return this.deduplicateAlerts(firingAlerts);
  }

  private deduplicateAlerts(alerts: LocationHealthAlert[]): LocationHealthAlert[] {
    const seen = new Set<string>();

    return alerts.filter((alert) => {
      const key = `${alert.alertName}:${JSON.stringify(alert.labels ?? {})}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private nodeAlertMatchers(location: Location, nodeHealth: LocationHealthNode): PrometheusAlertMatcher[] {
    const node = this.findNodeForHealth(location, nodeHealth);
    return node?.alerts ?? [];
  }

  private findNodeForHealth(location: Location, nodeHealth: LocationHealthNode): Node | undefined {
    const nodeName = nodeHealth.nodeName?.trim();
    if (!nodeName) {
      return undefined;
    }

    const nodeGroupName = nodeHealth.nodeGroupName?.trim();
    if (nodeGroupName) {
      const nodeGroupFlavor = nodeHealth.nodeGroupFlavor?.trim() ?? '';
      return this.nodeGroups(location)
        .find((group) => group.name === nodeGroupName && (group.flavor?.trim() ?? '') === nodeGroupFlavor)
        ?.nodes?.find((node) => node.name === nodeName);
    }

    return this.locationNodes(location).find((node) => node.name === nodeName);
  }
}
