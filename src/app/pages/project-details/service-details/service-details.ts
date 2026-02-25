import { CommonModule, LowerCasePipe } from '@angular/common';
import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map, of } from 'rxjs';
import { KeyAdd } from '../components/key-add/key-add';
import { KeyDelete } from '../components/key-delete/key-delete';
import { ServiceCreateForm } from '../components/service-create-form/service-create-form';
import { HostAliasAdd } from '../components/host-alias-add/host-alias-add';
import { Placeholder } from '../../../shared/components/common/placeholder/placeholder';
import { BadgeComponent } from '../../../shared/components/ui/badge/badge.component';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { ModalStore } from '../../../shared/store/modal.store';
import { ServiceStore } from '../../projects/store/service.store';
import { Service, SecureKey } from '../../projects/store/service.types';

type BadgeColor = 'primary' | 'success' | 'error' | 'warning' | 'info' | 'light' | 'dark';

@Component({
  selector: 'app-service-details',
  imports: [CommonModule, Placeholder, KeyAdd, ModalComponent, KeyDelete, ServiceCreateForm, LowerCasePipe, HostAliasAdd, BadgeComponent],
  templateUrl: './service-details.html',
  styleUrl: './service-details.css',
})
export class ServiceDetails implements OnDestroy {
  private route = inject(ActivatedRoute);
  private serviceStore = inject(ServiceStore);

  loading = this.serviceStore.loading;
  error = this.serviceStore.error;
  services = this.serviceStore.services;
  updated = this.serviceStore.updated;

  serviceStatusLoading = this.serviceStore.serviceStatusLoading;
  serviceStatus = this.serviceStore.serviceStatus;

  readonly hasServiceStatus = computed(() => this.serviceStatus() !== null);

  urlClipBoardClicked = signal(false);

  projectId = toSignal(
    this.route.parent?.paramMap.pipe(map(params => params.get('name'))) ?? of(null)
  );

  serviceName = toSignal(
    this.route.paramMap.pipe(map(params => params.get('serviceName')))
  );

  service = computed<Service | undefined>(() => {
    const list = this.services() as Service[] | null;
    const name = this.serviceName();
    if (!list || !name) {
      return undefined;
    }
    return list.find(item => item.spec?.name === name);
  });

  modalStore = inject(ModalStore);
  isOpen = this.modalStore.isOpen;
  modalSelector = signal<{ type: string, params?: any }>({ type: '' });

  private visibleKeyIndexes = signal<Set<number>>(new Set());
  private clipboardClickedIndexers = signal<Set<number>>(new Set());

  isKeyVisible(index: number): boolean {
    return this.visibleKeyIndexes().has(index);
  }

  isClipboardClicked(index: number): boolean {
    return this.clipboardClickedIndexers().has(index);
  }

  toggleKeyVisibility(index: number): void {
    const next = new Set(this.visibleKeyIndexes());
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.visibleKeyIndexes.set(next);
  }

  copyToClipBoard(value?: string | null): void {
    if (!value) {
      return;
    }
    navigator.clipboard?.writeText(value);
    this.urlClipBoardClicked.set(true);
    setTimeout(() => {
      this.urlClipBoardClicked.set(false);
    }, 2000);
  }

  copyKeyValue(index: number, value?: string | null): void {
    if (!value) {
      return;
    }
    navigator.clipboard?.writeText(value);
    const next = new Set(this.clipboardClickedIndexers());
    next.add(index);
    this.clipboardClickedIndexers.set(next);

    setTimeout(() => {
      const next = new Set(this.clipboardClickedIndexers());
      next.delete(index);
      this.clipboardClickedIndexers.set(next);
    }, 2000);
  }

  deleteKey(key: SecureKey): void {
    if (!this.service()) {
      return;
    }

    this.modalSelector.set({ type: 'key-delete', params: { keyName: key.name } });
    this.modalStore.openModal();
  }

  addKey(): void {
    this.modalSelector.set({ type: 'key-add' });
    this.modalStore.openModal();
  }

  addHostAlias(): void {
    this.modalSelector.set({ type: 'host-alias-add' });
    this.modalStore.openModal();
  }

  onEdit(): void {
    this.modalSelector.set({ type: 'edit' });
    this.modalStore.openModal();
  }

  handleKeyAdded(event: { name: string | undefined }): void {
    if (!this.service() || !event.name) {
      return;
    }
    this.closeModal();
  }

  closeModal(): void {
    this.modalStore.closeModal();
    this.modalSelector.set({ type: '' });
  }

  closeModalDelayed(delay: number): void {
    setTimeout(() => {
      this.closeModal();
    }, delay);
  }

  statusTone(status?: string): BadgeColor {
    if (status === 'Healthy' || status === 'True' || status === 'Synced') {
      return 'success';
    }

    if (status === 'Progressing' || status === 'Unknown' || status === 'OutOfSync') {
      return 'warning';
    }

    if (status === 'Degraded' || status === 'False' || status === 'Missing') {
      return 'error';
    }

    return 'info';
  }

  extractLocationFromArgoApp(argoAppName: string): string {
    const reg = new RegExp(`^service-${this.service()?.metadata.name}-at-(.*)$`);

    console.log('Extracting location from Argo App Name:', argoAppName, 'using regex:', reg);

    const match = argoAppName.match(reg);
    if (match && match[1]) {
      return match[1];
    }
    return 'N/A';
  }

  formatMessage(message: string): string {
    return message.replace(/\\n/g, '<br>');
  }

  ngOnDestroy(): void {
    this.serviceStore.stopPollingServiceStatus(this.service()?.metadata.name!);
  }

  translateConditionType(type: string, condition: string): { message: string, badgeTone: BadgeColor } {
    if (type === 'Ready') {
      if (condition === 'True') {
        return { message: 'Certificate is Valid', badgeTone: 'success' };
      } else if (condition === 'False') {
        return { message: 'Certificate is Invalid', badgeTone: 'error' };
      } else if (condition === 'Unknown') {
        return { message: 'Unknown Certificate Status', badgeTone: 'warning' };
      }
    }
    if (type == "Issuing") {
      if (condition === 'True') {
        return { message: 'Issuing', badgeTone: 'warning' };
      } else if (condition === 'False') {
        return { message: 'Not Issuing', badgeTone: 'info' };
      } else if (condition === 'Unknown') {
        return { message: 'Unknown Issuing Status', badgeTone: 'warning' };
      }
    }
    return { message: 'N/A', badgeTone: 'info' };
  }

  constructor() {
    effect(() => {
      // TODO rework this to OnUpdated event.
      if (this.updated()) {
        setTimeout(() => { this.closeModal() }, 3000);
      }

      if (this.service() !== undefined) {
        this.serviceStore.startPollingServiceStatus(this.service()!.metadata.name!);
      }
    });
  }
}
