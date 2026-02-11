import { Component, effect, inject, Input, signal } from '@angular/core';
import { ZoneStore } from '../../../store/zone.store';
import { ModalStore } from '../../../../../shared/store/modal.store';
import { ModalComponent } from '../../../../../shared/components/ui/modal/modal.component';
import { RouterModule } from '@angular/router';
import { Placeholder } from '../../../../../shared/components/common/placeholder/placeholder';
import { ZoneCreateForm } from '../zone-create-form/zone-create-form';

@Component({
  selector: 'app-zone-list',
  imports: [ModalComponent, RouterModule, Placeholder, ZoneCreateForm],
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

  modalSelector = signal<{ type: 'create-zone' | 'edit-zone' | null, serviceId?: string }>({ type: null });

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

  openModal(action: 'create-zone' | 'edit-zone', serviceId?: string) {
    this.modalSelector.set({ type: action, serviceId });
    this.modalStore.openModal();
  }

  ngOnInit(): void {
    this.zoneStore.selectProject(this.projectId);
  }
}
