import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CreateDNSEndpointDto,
  DNSEndpoint,
  DNSRecordType,
} from '../../../projects/store/dns-endpoint.types';
import { DNSEndpointStore } from '../../../projects/store/dns-endpoint.store';
import {
  dnsNameFromHost,
  hostInputFromDnsName,
} from '../../zone-details/dns-name';

@Component({
  selector: 'app-dns-endpoint-form',
  imports: [ReactiveFormsModule],
  templateUrl: './dns-endpoint-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DNSEndpointForm {
  readonly projectId = input.required<string>();
  readonly zoneName = input.required<string>();
  readonly dnsEndpoint = input<DNSEndpoint | null>(null);
  readonly saved = output<void>();
  readonly canceled = output<void>();

  private readonly store = inject(DNSEndpointStore);

  readonly saving = this.store.saving;
  readonly error = this.store.error;
  readonly recordTypes: DNSRecordType[] = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'NS'];
  readonly form = new FormGroup({
    host: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.maxLength(253),
        Validators.pattern(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/),
      ],
    }),
    recordType: new FormControl<DNSRecordType>('A', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    recordTTL: new FormControl(300, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    targets: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor() {
    effect(() => {
      const dnsEndpoint = this.dnsEndpoint();
      this.store.clearError();
      this.form.reset({
        host: dnsEndpoint
          ? hostInputFromDnsName(dnsEndpoint.spec.dnsName, this.zoneName())
          : '',
        recordType: dnsEndpoint?.spec.recordType ?? 'A',
        recordTTL: dnsEndpoint?.spec.recordTTL ?? 300,
        targets: dnsEndpoint?.spec.targets.join('\n') ?? '',
      });
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const dto: CreateDNSEndpointDto = {
      dnsName: dnsNameFromHost(value.host, this.zoneName()),
      routingPolicy: 'Simple',
      recordTTL: value.recordTTL,
      recordType: value.recordType,
      targets: value.targets
        .split('\n')
        .map((target) => target.trim())
        .filter((target) => target.length > 0),
    };

    if (dto.targets.length === 0) {
      this.form.controls.targets.setErrors({ required: true });
      return;
    }

    const current = this.dnsEndpoint();
    const request = current
      ? this.store.update(this.projectId(), this.zoneName(), current.metadata.name, dto)
      : this.store.create(this.projectId(), this.zoneName(), dto);

    request.subscribe({ next: () => this.saved.emit() });
  }
}
