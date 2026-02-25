import { Component, effect, inject, Input, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ZoneCreateForm } from '../zone-create-form/zone-create-form';
import { ZoneDelete } from '../zone-delete/zone-delete';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { Placeholder } from '../../../../shared/components/common/placeholder/placeholder';
import { ModalStore } from '../../../../shared/store/modal.store';
import { ZoneStore } from '../../../projects/store/zone.store';
import { ButtonComponent } from '../../../../shared/components/ui/button/button.component';

@Component({
  selector: 'app-zone-list',
  imports: [ModalComponent, RouterModule, Placeholder, ZoneCreateForm, ZoneDelete, ButtonComponent],
  templateUrl: './zone-list.html',
  styleUrl: './zone-list.css',
})
export class ZoneList {
  @Input() projectId!: string;
  @Input() routerLinkRoot: string = "./";

  zoneStore = inject(ZoneStore);
  zones = this.zoneStore.zones;
  loading = this.zoneStore.loading;
  error = this.zoneStore.error;


  modalStore = inject(ModalStore);
  isOpen = this.modalStore.isOpen;

  modalSelector = signal<{ type: 'create-zone' | 'edit-zone' | 'delete-zone' | null, zoneId?: string }>({ type: null });

  constructor() {}

  closeModal() {
    this.modalSelector.set({ type: null });
    this.modalStore.closeModal();
  }

  closeModalDelayed(delay: number = 2000) {
    setTimeout(() => {
      this.closeModal();
    }, delay);
  }

  openModal(action: 'create-zone' | 'edit-zone' | 'delete-zone', zoneId?: string) {
    this.modalSelector.set({ type: action, zoneId });
    this.modalStore.openModal();
  }

  ngOnInit(): void {}
}
