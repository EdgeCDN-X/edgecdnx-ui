import { Component, effect, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { ServiceStore } from '../../../store/service.store';
import { ZoneStore } from '../../../store/zone.store';

@Component({
  selector: 'app-zone-delete',
  imports: [],
  templateUrl: './zone-delete.html',
  styleUrl: './zone-delete.css',
})
export class ZoneDelete implements OnInit {
  @Input() zoneId: string | null = "";
  @Output() onZoneDeleted = new EventEmitter<{ name: string | undefined }>();

  zoneStore = inject(ZoneStore);

  error = this.zoneStore.error;
  deleting = this.zoneStore.deleting;
  deleted = this.zoneStore.deleted;

  onDelete(): void {
    if (this.zoneId) {
      this.zoneStore.deleteZone(this.zoneId);
    }
  }

  ngOnInit(): void {
    this.zoneStore.resetDelete();
  }

  constructor() {

    effect(() => {
      if (this.zoneStore.deleted()) {
        this.onZoneDeleted.emit({ name: this.zoneId! });
      }
    })
  }
}
