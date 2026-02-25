import { Component, effect, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ZoneStore } from '../../../projects/store/zone.store';
import { CreateZoneDto } from '../../../projects/store/zone.types';

@Component({
  selector: 'app-zone-create-form',
  imports: [ReactiveFormsModule],
  templateUrl: './zone-create-form.html',
  styleUrl: './zone-create-form.css',
})
export class ZoneCreateForm implements OnInit {
  @Input() projectId!: string;
  @Output() onZoneCreated = new EventEmitter<{ name: string | null | undefined }>();

  zoneStore = inject(ZoneStore);

  creating = this.zoneStore.creating;
  created = this.zoneStore.created
  error = this.zoneStore.error;

  zoneCreateForm = new FormGroup({
    zone: new FormControl('', [
      Validators.required,
      Validators.maxLength(253),
      Validators.pattern(
        /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/
      ),
    ]),
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  onSubmit() {
    this.zoneStore.createZone(this.zoneCreateForm.getRawValue() as CreateZoneDto);
  }

  ngOnInit(): void {
    this.zoneStore.resetCreate();
  }

  constructor() {
    effect(() => {
      if (this.zoneStore.created()) {
        this.onZoneCreated.emit({ name: this.zoneCreateForm.get('zone')?.value });
      }
    })
  }
}
