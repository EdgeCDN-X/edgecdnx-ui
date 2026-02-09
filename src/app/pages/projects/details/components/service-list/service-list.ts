import { Component, effect, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ServiceCreateForm } from '../service-create-form/service-create-form';
import { Placeholder } from '../../../../../shared/components/common/placeholder/placeholder';
import { ModalComponent } from '../../../../../shared/components/ui/modal/modal.component';
import { ModalStore } from '../../../../../shared/store/modal.store';
import { ServiceStore } from '../../../store/service.store';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-service-list',
  imports: [CommonModule, Placeholder, ModalComponent, ServiceCreateForm, RouterModule],
  templateUrl: './service-list.html',
  styleUrl: './service-list.css',
})
export class ServiceList implements OnInit {
  @Input() projectId!: string;
  @Input() routerLinkRoot: string = "./";

  serviceStore = inject(ServiceStore);
  services = this.serviceStore.services;
  loading = this.serviceStore.loading;
  error = this.serviceStore.error;

  created = this.serviceStore.created;

  modalStore = inject(ModalStore);
  isOpen = this.modalStore.isOpen;

  modalSelector = signal<{ type: string, serviceId?: string }>({ type: '' });

  constructor() {
    effect(() => {
      if (this.created()) {
        setTimeout(() => { this.closeModal() }, 5000);
      }
    })
  }

  closeModal() {
    this.modalStore.closeModal();
  }

  openModal(action: 'create' | 'edit', serviceId?: string) {
    this.modalSelector.set({ type: action, serviceId });
    this.modalStore.openModal();
  }

  ngOnInit(): void {
    this.serviceStore.selectProject(this.projectId);
  }
}
