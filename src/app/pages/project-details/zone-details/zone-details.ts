import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, of } from 'rxjs';
import { Placeholder } from '../../../shared/components/common/placeholder/placeholder';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { DNSEndpointForm } from '../components/dns-endpoint-form/dns-endpoint-form';
import { DNSEndpointStore } from '../../projects/store/dns-endpoint.store';
import { DNSEndpoint, LabelSelector } from '../../projects/store/dns-endpoint.types';
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

  readonly displayHost = (dnsName: string): string =>
    hostFromDnsName(dnsName, this.zoneName() ?? '');

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
