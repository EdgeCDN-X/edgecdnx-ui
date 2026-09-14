import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, of } from 'rxjs';
import { Placeholder } from '../../../shared/components/common/placeholder/placeholder';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { DNSEndpointForm } from '../components/dns-endpoint-form/dns-endpoint-form';
import { DNSEndpointStore } from '../../projects/store/dns-endpoint.store';
import { DNSEndpoint, DNSRecordType, LabelSelector } from '../../projects/store/dns-endpoint.types';
import { hostFromDnsName } from './dns-name';

@Component({
  selector: 'app-zone-details',
  imports: [RouterLink, Placeholder, ModalComponent, ButtonComponent, DNSEndpointForm],
  templateUrl: './zone-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoneDetails {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(DNSEndpointStore);

  readonly projectId = toSignal(
    this.route.parent?.paramMap.pipe(map((params) => params.get('name'))) ?? of(null),
  );
  readonly zoneName = toSignal(this.route.paramMap.pipe(map((params) => params.get('zoneName'))));
  readonly dnsEndpoints = this.store.dnsEndpoints;
  readonly loading = this.store.loading;
  readonly deleting = this.store.deleting;
  readonly error = this.store.error;

  readonly dialogMode = signal<'create' | 'edit' | 'delete' | null>(null);
  readonly selected = signal<DNSEndpoint | null>(null);
  readonly dialogOpen = computed(() => this.dialogMode() !== null);
  readonly searchTerm = signal('');
  readonly recordTypeFilter = signal<'all' | DNSRecordType>('all');
  readonly sort = signal<{ field: 'name' | 'type'; direction: 'asc' | 'desc' }>({
    field: 'name',
    direction: 'asc',
  });
  readonly copiedEndpointName = signal<string | null>(null);
  readonly recordTypes: DNSRecordType[] = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'NS'];
  readonly visibleDNSEndpoints = computed(() => {
    const searchTerm = this.searchTerm().trim().toLowerCase();
    const recordTypeFilter = this.recordTypeFilter();
    const sort = this.sort();

    return [...this.dnsEndpoints()]
      .filter((dnsEndpoint) => {
        if (recordTypeFilter !== 'all' && dnsEndpoint.spec.recordType !== recordTypeFilter) {
          return false;
        }
        if (!searchTerm) {
          return true;
        }
        return [dnsEndpoint.spec.dnsName, dnsEndpoint.spec.recordType, ...dnsEndpoint.spec.targets]
          .some((value) => value.toLowerCase().includes(searchTerm));
      })
      .sort((left, right) => {
        const leftValue = sort.field === 'name' ? left.spec.dnsName : left.spec.recordType;
        const rightValue = sort.field === 'name' ? right.spec.dnsName : right.spec.recordType;
        const comparison = leftValue.localeCompare(rightValue);
        return sort.direction === 'asc' ? comparison : -comparison;
      });
  });

  readonly displayHost = (dnsName: string): string =>
    hostFromDnsName(dnsName, this.zoneName() ?? '');

  setSearchTerm(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  setRecordTypeFilter(event: Event): void {
    this.recordTypeFilter.set((event.target as HTMLSelectElement).value as 'all' | DNSRecordType);
  }

  toggleSort(field: 'name' | 'type'): void {
    this.sort.update((sort) => ({
      field,
      direction: sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  sortDirection(field: 'name' | 'type'): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    if (sort.field !== field) {
      return 'none';
    }
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  copyDNSName(dnsEndpoint: DNSEndpoint): void {
    navigator.clipboard?.writeText(dnsEndpoint.spec.dnsName);
    this.copiedEndpointName.set(dnsEndpoint.metadata.name);
    setTimeout(() => this.copiedEndpointName.set(null), 2000);
  }

  isCopied(dnsEndpoint: DNSEndpoint): boolean {
    return this.copiedEndpointName() === dnsEndpoint.metadata.name;
  }

  // Targets of the form `LINK: <service-name>` reference another resource instead of a DNS value.
  serviceLinkId(target: string): string | null {
    const match = /^LINK:\s*(.+)$/.exec(target.trim());
    return match ? match[1].trim() : null;
  }

  serviceRouterLink(serviceId: string): unknown[] {
    return ['/projects', this.projectId(), 'service', serviceId];
  }

  isManaged(dnsEndpoint: DNSEndpoint): boolean {
    return Boolean(dnsEndpoint.metadata.labels?.['service']);
  }

  routeSelectorEntries(selector: LabelSelector | null | undefined): string[] {
    if (!selector) {
      return [];
    }

    const entries = Object.entries(selector.matchLabels ?? {}).map(
      ([key, value]) => `${key} = ${value}`,
    );

    for (const expression of selector.matchExpressions ?? []) {
      const values = expression.values ?? [];
      switch (expression.operator) {
        case 'In':
        case 'NotIn':
          entries.push(`${expression.key} ${expression.operator} (${values.join(', ')})`);
          break;
        default:
          entries.push(`${expression.key} ${expression.operator}`);
      }
    }

    return entries;
  }

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      const zoneName = this.zoneName();
      if (projectId && zoneName) {
        this.store.load(projectId, zoneName);
      }
    });
  }

  openCreate(): void {
    this.selected.set(null);
    this.dialogMode.set('create');
  }

  openEdit(dnsEndpoint: DNSEndpoint): void {
    this.selected.set(dnsEndpoint);
    this.dialogMode.set('edit');
  }

  openDelete(dnsEndpoint: DNSEndpoint): void {
    this.selected.set(dnsEndpoint);
    this.store.clearError();
    this.dialogMode.set('delete');
  }

  closeDialog(): void {
    this.dialogMode.set(null);
    this.selected.set(null);
    this.store.clearError();
  }

  deleteSelected(): void {
    const projectId = this.projectId();
    const zoneName = this.zoneName();
    const selected = this.selected();
    if (!projectId || !zoneName || !selected) {
      return;
    }

    this.store
      .delete(projectId, zoneName, selected.metadata.name)
      .subscribe({ next: () => this.closeDialog() });
  }
}
