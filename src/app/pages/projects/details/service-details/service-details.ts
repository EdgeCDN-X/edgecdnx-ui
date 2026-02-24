import { CommonModule, LowerCasePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map, of } from 'rxjs';
import { Placeholder } from '../../../../shared/components/common/placeholder/placeholder';
import { ServiceStore } from '../../store/service.store';
import { SecureKey, Service } from '../../store/service.types';
import { ModalStore } from '../../../../shared/store/modal.store';
import { KeyAdd } from '../components/key-add/key-add';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { KeyDelete } from '../components/key-delete/key-delete';
import { ServiceCreateForm } from '../components/service-create-form/service-create-form';
import { HostAliasAdd } from '../components/host-alias-add/host-alias-add';

@Component({
  selector: 'app-service-details',
  imports: [CommonModule, Placeholder, KeyAdd, ModalComponent, KeyDelete, ServiceCreateForm, LowerCasePipe, HostAliasAdd],
  templateUrl: './service-details.html',
  styleUrl: './service-details.css',
})
export class ServiceDetails {
  private route = inject(ActivatedRoute);
  private serviceStore = inject(ServiceStore);

  loading = this.serviceStore.loading;
  error = this.serviceStore.error;
  services = this.serviceStore.services;
  updated = this.serviceStore.updated;

  serviceStatusLoading = this.serviceStore.serviceStatusLoading;
  serviceStatus = this.serviceStore.serviceStatus;

  readonly hasServiceStatus = computed(() => this.serviceStatus() !== null);

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
    // this.serviceStore.createSecureKey(this.service()!.metadata.name, event.name);
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

  statusTone(status?: string): string {
    if (status === 'Healthy' || status === 'True' || status === 'Synced') {
      return 'text-green-600 dark:text-green-400';
    }

    if (status === 'Progressing' || status === 'Unknown' || status === 'OutOfSync') {
      return 'text-yellow-600 dark:text-yellow-400';
    }

    if (status === 'Degraded' || status === 'False' || status === 'Missing') {
      return 'text-red-600 dark:text-red-400';
    }

    return 'text-gray-600 dark:text-gray-400';
  }

  constructor() {
    effect(() => {
      // TODO rework this to OnUpdated event.
      if (this.updated()) {
        setTimeout(() => { this.closeModal() }, 3000);
      }

      if (this.service() !== undefined) {
        this.serviceStore.getServiceStatus(this.service()!.metadata.name!);
      }
    });
  }
}
