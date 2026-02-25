import { Component, effect, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ServiceStore } from '../../../projects/store/service.store';
import { ZoneStore } from '../../../projects/store/zone.store';

@Component({
  selector: 'app-host-alias-add',
  imports: [ReactiveFormsModule, CommonModule],
  standalone: true,
  templateUrl: './host-alias-add.html',
  styleUrl: './host-alias-add.css',
})
export class HostAliasAdd implements OnInit {
  @Input() serviceId: string | null = "";
  @Input() serviceDomain: string | null = "";
  @Output() onHostAliasAdded = new EventEmitter<{ name: string | undefined }>();

  serviceStore = inject(ServiceStore);
  zoneStore = inject(ZoneStore);

  zones = this.zoneStore.zones;

  validating = signal(false);
  validationError = signal<string | null>(null);

  cnamedomainValidators = [
    Validators.required,
    Validators.maxLength(253),
    Validators.pattern(
      /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/
    ),
  ]

  nsdomainValidators = [
    Validators.maxLength(253),
    Validators.pattern(/^(?:[a-zA-Z0-9]+\.)*[a-zA-Z0-9]+$/)
  ]

  error = this.serviceStore.error;
  updating = this.serviceStore.updating;
  updated = this.serviceStore.updated;
  newHostAliasForm = new FormGroup({
    type: new FormControl('CNAME', { nonNullable: true }),
    validated: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
    zone: new FormControl('', { nonNullable: true, validators: [] }),
    domain: new FormControl('', {
      nonNullable: true,
      validators: this.cnamedomainValidators,
    }),
  })

  ngOnInit(): void {
    this.serviceStore.resetUpdate();
    this.newHostAliasForm.get('type')!.valueChanges.subscribe((type) => {
      this.newHostAliasForm.get('validated')!.setValue(false);
      this.validationError.set(null);

      console.log('Type changed to', type);

      if (type == 'ZONE') {
        this.newHostAliasForm.get('zone')!.setValidators([Validators.required]);
        this.newHostAliasForm.get('zone')!.updateValueAndValidity();
        this.newHostAliasForm.get('domain')!.clearValidators();
        this.newHostAliasForm.get('domain')!.setValidators(this.nsdomainValidators);
        this.newHostAliasForm.get('domain')!.updateValueAndValidity();
      } else {
        this.newHostAliasForm.get('zone')!.clearValidators();
        this.newHostAliasForm.get('zone')!.updateValueAndValidity();
        this.newHostAliasForm.get('domain')!.clearValidators();
        this.newHostAliasForm.get('domain')!.setValidators(this.cnamedomainValidators);
        this.newHostAliasForm.get('domain')!.updateValueAndValidity();
      }
    });

    this.newHostAliasForm.get('domain')!.valueChanges.subscribe(() => {
      this.newHostAliasForm.get('validated')!.setValue(false);
      this.validationError.set(null);
    });
  }

  onSubmit(): void {
    const values = this.newHostAliasForm.getRawValue();
    if (values.type == 'CNAME')  {
      this.serviceStore.addHostAlias(this.serviceId!, values.domain)
    }
    if (values.type == 'ZONE')  {
      this.serviceStore.addHostAlias(this.serviceId!, `${values.domain ? `${values.domain}.` : ''}${values.zone}`)
    }
  }
  
  validate(): void {
    // TODO build proper validation chain
    this.validating.set(true);
    console.log('Validating (MOCK)...');
    setTimeout(() => {
      this.newHostAliasForm.get('validated')!.setValue(true);
      this.validating.set(false);
    }, 3000);
  }

  constructor() {
    effect(() => {
      if (this.serviceStore.updated()) {
        this.onHostAliasAdded.emit({ name: this.newHostAliasForm.get('domain')?.value });
      }
    })
  }
}
