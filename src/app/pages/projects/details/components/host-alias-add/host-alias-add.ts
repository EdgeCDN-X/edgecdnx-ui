import { Component, effect, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { ServiceStore } from '../../../store/service.store';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-host-alias-add',
  imports: [ReactiveFormsModule],
  standalone: true,
  templateUrl: './host-alias-add.html',
  styleUrl: './host-alias-add.css',
})
export class HostAliasAdd implements OnInit {
  @Input() serviceId: string | null = "";
  @Input() serviceDomain: string | null = "";
  @Output() onHostAliasAdded = new EventEmitter<{ name: string | undefined }>();

  serviceStore = inject(ServiceStore);

  validating = signal(false);
  validationError = signal<string | null>(null);

  error = this.serviceStore.error;
  updating = this.serviceStore.updating;
  updated = this.serviceStore.updated;
  newHostAliasForm = new FormGroup({
    type: new FormControl('CNAME', { nonNullable: true }),
    validated: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
    domain: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(253),
        Validators.pattern(
          /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/
        ),
      ],
    }),
  })

  ngOnInit(): void {
    this.serviceStore.resetUpdate();

    this.newHostAliasForm.get('type')!.valueChanges.subscribe(() => {
      this.newHostAliasForm.get('validated')!.setValue(false);
      this.validationError.set(null);
    });

    this.newHostAliasForm.get('domain')!.valueChanges.subscribe(() => {
      this.newHostAliasForm.get('validated')!.setValue(false);
      this.validationError.set(null);
    });
  }

  onSubmit(): void {
    //todo
  }

  validate(): void {

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
