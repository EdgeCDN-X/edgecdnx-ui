import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import {
  CreateDNSEndpointDto,
  DNSEndpoint,
  DNSRecordType,
  DNSRoutingPolicy,
} from '../../../projects/store/dns-endpoint.types';
import { DNSEndpointStore } from '../../../projects/store/dns-endpoint.store';
import { LocationStore } from '../../../projects/store/location.store';
import {
  dnsNameFromHost,
  hostInputFromDnsName,
} from '../../zone-details/dns-name';
import { LocationKvBuilder } from '../../locations/location-kv-builder';
import { resourceLabelsForm, projectLabelKey } from '../../locations/location-form.model';

@Component({
  selector: 'app-dns-endpoint-form',
  imports: [ReactiveFormsModule, LocationKvBuilder],
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
  private readonly locationStore = inject(LocationStore);
  private readonly formBuilder = inject(FormBuilder);

  readonly saving = this.store.saving;
  readonly error = this.store.error;
  readonly locationsLoading = this.locationStore.loading;
  readonly locationsError = this.locationStore.error;
  readonly availableLocations = computed(() => this.locationStore.locations()
    .filter((location) => location.metadata.labels?.[projectLabelKey] === this.projectId())
    .map((location) => location.metadata.name)
    .sort((first, second) => first.localeCompare(second)));
  readonly projectLabel = computed(() => ({ [projectLabelKey]: this.projectId() }));
  readonly routingPolicies: { value: DNSRoutingPolicy; label: string }[] = [
    { value: 'Simple', label: 'Simple' },
    { value: 'RoundRobin', label: 'Round Robin' },
    { value: 'Weighted', label: 'Weighted Round Robin' },
    { value: 'Geolocation', label: 'Geolocation' },
    { value: 'Failover', label: 'Failover' },
  ];
  readonly recordTypes: DNSRecordType[] = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'NS'];
  readonly form = this.formBuilder.nonNullable.group({
    routingPolicy: this.formBuilder.nonNullable.control<DNSRoutingPolicy>('Simple', Validators.required),
    routeLabels: resourceLabelsForm(),
    failoverLocation: this.formBuilder.nonNullable.control('', [
      Validators.required,
      (control: AbstractControl): ValidationErrors | null => !control.value ? null : untracked(() =>
        this.locationsLoading() || this.locationsError() || !this.availableLocations().includes(control.value)
          ? { unavailableLocation: true }
          : null),
    ]),
    host: this.formBuilder.nonNullable.control('', {
      validators: [
        Validators.maxLength(253),
        Validators.pattern(hostNamePattern),
      ],
    }),
    recordType: this.formBuilder.nonNullable.control<DNSRecordType>('A', {
      validators: [Validators.required],
    }),
    recordTTL: this.formBuilder.nonNullable.control(300, {
      validators: [Validators.required, Validators.min(1)],
    }),
    targets: this.formBuilder.nonNullable.control('', {
      validators: [Validators.required],
    }),
    priority: this.formBuilder.nonNullable.control(10, {
      validators: [Validators.required, Validators.min(0), Validators.max(65535)],
    }),
    srvRecords: this.formBuilder.array<SrvRecordForm>([]),
  });

  get srvRecords(): FormArray<SrvRecordForm> {
    return this.form.controls.srvRecords;
  }

  constructor() {
    effect((onCleanup) => {
      const subscription = this.locationStore.load(this.projectId()).subscribe({ error: () => {
        // LocationStore exposes the request error in the form.
      } });
      onCleanup(() => subscription.unsubscribe());
    });
    effect(() => {
      this.availableLocations();
      this.locationsLoading();
      this.locationsError();
      this.form.controls.failoverLocation.updateValueAndValidity({ emitEvent: false });
    });
    this.form.controls.routingPolicy.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateTargetValidators(this.form.controls.recordType.value));
    effect(() => {
      const dnsEndpoint = this.dnsEndpoint();
      const recordType = dnsEndpoint?.spec.recordType ?? 'A';
      const fields = targetFieldsFromEndpoint(recordType, dnsEndpoint?.spec.targets ?? []);
      this.store.clearError();
      this.form.reset({
        routingPolicy: dnsEndpoint?.spec.routingPolicy || 'Simple',
        failoverLocation: dnsEndpoint?.spec.routingPolicy === 'Failover' ? dnsEndpoint.spec.targets?.[0] ?? '' : '',
        host: dnsEndpoint
          ? hostInputFromDnsName(dnsEndpoint.spec.dnsName, this.zoneName())
          : '',
        recordType,
        recordTTL: dnsEndpoint?.spec.recordTTL ?? 300,
        targets: fields.targets.join('\n'),
        priority: fields.priority,
      });
      this.form.setControl('routeLabels', resourceLabelsForm(dnsEndpoint?.spec.routeSelector?.matchLabels));
      this.setSrvRecords(fields.srvRecords);
      this.updateHostValidators(recordType);
      this.updateTargetValidators(recordType);

      if (dnsEndpoint) {
        this.form.controls.recordType.disable({ emitEvent: false });
      } else {
        this.form.controls.recordType.enable({ emitEvent: false });
      }
    });
  }

  submit(): void {
    if (this.saving() || this.form.invalid || this.hasUnsupportedSelector()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const dto: CreateDNSEndpointDto = {
      dnsName: dnsNameFromHost(value.host, this.zoneName()),
      routingPolicy: value.routingPolicy,
      recordTTL: value.recordTTL,
      recordType: value.recordType,
      targets: this.usesRouteSelector() ? [] : this.isFailover() ? [value.failoverLocation] : this.targetsForRecord(value),
      routeSelector: this.usesRouteSelector()
        ? {
            matchLabels: {
              ...Object.fromEntries(value.routeLabels.map(({ key, value }) => [key, value])),
              ...this.projectLabel(),
            },
          }
        : null,
    };

    if (!this.usesRouteSelector() && dto.targets.length === 0) {
      this.form.controls.targets.setErrors({ required: true });
      return;
    }

    const current = this.dnsEndpoint();
    const request = current
      ? this.store.update(this.projectId(), this.zoneName(), current.metadata.name, dto)
      : this.store.create(this.projectId(), this.zoneName(), dto);

    request.subscribe({ next: () => this.saved.emit() });
  }

  usesRouteSelector(): boolean {
    return ['RoundRobin', 'Weighted', 'Geolocation'].includes(this.form.controls.routingPolicy.value);
  }

  isFailover(): boolean {
    return this.form.controls.routingPolicy.value === 'Failover';
  }

  hasUnsupportedSelector(): boolean {
    return this.usesRouteSelector() && !!this.dnsEndpoint()?.spec.routeSelector?.matchExpressions?.length;
  }

  valueLabel(): string {
    switch (this.form.controls.recordType.value) {
      case 'A':
        return 'IPv4 addresses';
      case 'AAAA':
        return 'IPv6 addresses';
      case 'CNAME':
        return 'Canonical hostnames';
      case 'MX':
        return 'Mail exchanger hostnames';
      case 'NS':
        return 'Nameserver hostnames';
      case 'SRV':
        return 'Service target hostnames';
      case 'TXT':
        return 'Text values';
    }
  }

  valuePlaceholder(): string {
    switch (this.form.controls.recordType.value) {
      case 'A':
        return '192.0.2.42';
      case 'AAAA':
        return '2001:db8::42';
      case 'CNAME':
        return 'origin.example.net.';
      case 'MX':
        return 'mail.example.net.';
      case 'NS':
        return 'ns1.example.net.';
      case 'SRV':
        return 'service.example.net.';
      case 'TXT':
        return 'v=spf1 include:example.net -all';
    }
  }

  valueHelp(): string {
    switch (this.form.controls.recordType.value) {
      case 'A':
      case 'AAAA':
        return 'Enter one address per line.';
      case 'CNAME':
        return 'Enter the canonical hostname. Use a trailing dot for an absolute name.';
      case 'MX':
        return 'Each hostname uses the priority above. Use a trailing dot for an absolute name.';
      case 'NS':
        return 'Enter one authoritative nameserver hostname per line.';
      case 'SRV':
        return 'Each hostname uses the priority, weight, and port above.';
      case 'TXT':
        return 'Enter one TXT value per line. Each value must be 255 characters or fewer.';
    }
  }

  private updateTargetValidators(recordType: DNSRecordType): void {
    const selector = this.usesRouteSelector();
    const failover = this.isFailover();
    for (const [control, active] of [
      [this.form.controls.targets, recordType !== 'SRV'],
      [this.form.controls.priority, recordType === 'MX'],
      [this.srvRecords, recordType === 'SRV'],
    ] as const) {
      if (selector || failover || !active) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
      if (failover) {
        this.form.controls.failoverLocation.enable({ emitEvent: false });
      } else {
        this.form.controls.failoverLocation.disable({ emitEvent: false });
      }
    }
    if (selector) {
      this.form.controls.routeLabels.enable({ emitEvent: false });
    } else {
      this.form.controls.routeLabels.disable({ emitEvent: false });
    }
    const validators = recordType === 'SRV' ? [] : [Validators.required];
    if (recordType === 'TXT') {
      validators.push(txtTargetLengthValidator);
    }
    this.form.controls.targets.setValidators(validators);
    this.form.controls.targets.updateValueAndValidity({ emitEvent: false });
  }

  private updateHostValidators(recordType: DNSRecordType): void {
    const pattern = recordType === 'SRV' ? serviceOwnerNamePattern : hostNamePattern;
    this.form.controls.host.setValidators([Validators.maxLength(253), Validators.pattern(pattern)]);
    this.form.controls.host.updateValueAndValidity({ emitEvent: false });
  }

  private targetsForRecord(value: ReturnType<DNSEndpointForm['form']['getRawValue']>): string[] {
    const targets = value.targets
      .split('\n')
      .map((target) => target.trim())
      .filter((target) => target.length > 0);

    switch (value.recordType) {
      case 'MX':
        return targets.map((target) => `${value.priority} ${target}`);
      case 'SRV':
        return value.srvRecords.map(
          (record) => `${record.priority} ${record.weight} ${record.port} ${record.target}`,
        );
      case 'TXT':
        return targets.map(quoteTxtTarget);
      default:
        return targets;
    }
  }

  addSrvRecord(): void {
    this.srvRecords.push(this.newSrvRecord());
  }

  selectRecordType(event: Event): void {
    const recordType = (event.target as HTMLSelectElement).value as DNSRecordType;
    this.form.controls.recordType.setValue(recordType, { emitEvent: false });
    this.updateHostValidators(recordType);
    if (recordType === 'SRV' && this.srvRecords.length === 0) {
      this.addSrvRecord();
    }
    this.updateTargetValidators(recordType);
  }

  removeSrvRecord(index: number): void {
    this.srvRecords.removeAt(index);
  }

  private setSrvRecords(records: SrvRecordValue[]): void {
    this.srvRecords.clear({ emitEvent: false });
    records.forEach((record) => this.srvRecords.push(this.newSrvRecord(record), { emitEvent: false }));
    if (this.form.controls.recordType.value === 'SRV' && this.srvRecords.length === 0) {
      this.addSrvRecord();
    }
  }

  private newSrvRecord(record: SrvRecordValue = defaultSrvRecord): SrvRecordForm {
    return this.formBuilder.nonNullable.group({
      priority: this.formBuilder.nonNullable.control(record.priority, [Validators.required, Validators.min(0), Validators.max(65535)]),
      weight: this.formBuilder.nonNullable.control(record.weight, [Validators.required, Validators.min(0), Validators.max(65535)]),
      port: this.formBuilder.nonNullable.control(record.port, [Validators.required, Validators.min(1), Validators.max(65535)]),
      target: this.formBuilder.nonNullable.control(record.target, [Validators.required, srvTargetValidator]),
    });
  }
}

const hostNamePattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/;
const serviceOwnerNamePattern = /^(?:[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?)(?:\.(?:[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?))*$/;

function quoteTxtTarget(target: string): string {
  return isQuotedTxtTarget(target) ? target : `"${target}"`;
}

function txtTargetLengthValidator(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value : '';
  return value.split('\n').some((target) => {
    const trimmedTarget = target.trim();
    const textValue = isQuotedTxtTarget(trimmedTarget)
      ? trimmedTarget.slice(1, -1)
      : trimmedTarget;
    return textValue.length > 255;
  })
    ? { txtValueTooLong: true }
    : null;
}

function isQuotedTxtTarget(target: string): boolean {
  return target.startsWith('"') && target.endsWith('"');
}

function srvTargetValidator(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && isFullyQualifiedDomainName(control.value.trim())
    ? null
    : { invalidSrvTarget: true };
}

function isFullyQualifiedDomainName(value: string): boolean {
  const domainName = value.replace(/\.$/, '');
  return domainName.includes('.') && hostNamePattern.test(domainName) && !ipv4AddressPattern.test(domainName);
}

const ipv4AddressPattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function targetFieldsFromEndpoint(recordType: DNSRecordType, targets: string[]): {
  targets: string[];
  priority: number;
  srvRecords: SrvRecordValue[];
} {
  if (recordType === 'MX') {
    const records = targets.map((target) => /^(\d+)\s+(.+)$/.exec(target.trim()));
    const firstRecord = records[0];
    if (firstRecord) {
      return {
        targets: records.map((record, index) => record?.[2] ?? targets[index]),
        priority: Number(firstRecord[1]),
        srvRecords: [],
      };
    }
  }

  if (recordType === 'SRV') {
    const records = targets.map((target) => /^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(target.trim()));
    return {
      targets: [],
      priority: 10,
      srvRecords: records.map((record, index) => record
        ? { priority: Number(record[1]), weight: Number(record[2]), port: Number(record[3]), target: record[4] }
        : { ...defaultSrvRecord, target: targets[index] }),
    };
  }

  return { targets, priority: 10, srvRecords: [] };
}

type SrvRecordValue = {
  priority: number;
  weight: number;
  port: number;
  target: string;
};

type SrvRecordForm = FormGroup<{
  priority: FormControl<number>;
  weight: FormControl<number>;
  port: FormControl<number>;
  target: FormControl<string>;
}>;

const defaultSrvRecord: SrvRecordValue = { priority: 10, weight: 0, port: 443, target: '' };
