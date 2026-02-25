import { Component, effect, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { ServiceStore } from '../../../projects/store/service.store';

@Component({
  selector: 'app-key-delete',
  imports: [],
  templateUrl: './key-delete.html',
  styleUrl: './key-delete.css',
})
export class KeyDelete implements OnInit {
  @Input() serviceId: string | null = "";
  @Input() keyName: string | null = "";
  @Output() onKeyDeleted = new EventEmitter<{ name: string | undefined }>();

  serviceStore = inject(ServiceStore);

  error = this.serviceStore.error;
  updating = this.serviceStore.updating;
  updated = this.serviceStore.updated;

  onDelete(): void {
    if (this.serviceId && this.keyName) {
      this.serviceStore.deleteKey(this.serviceId, this.keyName);
    }
  }

  ngOnInit(): void {
    this.serviceStore.resetUpdate();
  }

  constructor() {

    effect(() => {
      if (this.serviceStore.updated()) {
        this.onKeyDeleted.emit({ name: this.keyName! });
      }
    })
  }
}
