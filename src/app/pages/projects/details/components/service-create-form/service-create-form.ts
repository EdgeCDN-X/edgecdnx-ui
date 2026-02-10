import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, FormBuilder, FormArray } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TagInputComponent } from '../../../../../shared/components/form/input/tag-input.component';
import { SwitchComponent } from '../../../../../shared/components/form/input/switch.component';
import { ServiceStore } from '../../../store/service.store';
import { CreateServiceDto, OriginType } from '../../../store/service.types';

@Component({
  selector: 'app-service-create-form',
  imports: [ReactiveFormsModule, TagInputComponent, SwitchComponent],
  templateUrl: './service-create-form.html',
  styleUrl: './service-create-form.css',
})
export class ServiceCreateForm implements OnInit, OnDestroy {
  @Input() projectId!: string;
  @Input() isEditMode: boolean = false;
  @Input() serviceId?: string;

  // TODO perhaps implement onSuccess hook

  serviceStore = inject(ServiceStore);

  creating = this.serviceStore.creating;
  created = this.serviceStore.created;

  updating = this.serviceStore.updating;
  updated = this.serviceStore.updated;
  error = this.serviceStore.error;

  step = signal(1);
  submitStep = 4;

  /**
   * Step by step validation to ensure users fill in the required fields before proceeding to the next step.
   * @returns 
   */
  canClickNext() {
    if (this.step() === 1) {
      if (this.isEditMode) {
        return this.serviceCreateForm.get('originType')?.valid;
      }
      return this.serviceCreateForm.get('name')?.valid && this.serviceCreateForm.get('originType')?.valid;
    }

    if (this.step() === 2) {
      const originType = this.serviceCreateForm.get('originType')?.value;
      if (originType === OriginType.Static) {
        return this.serviceCreateForm.get('staticOrigin')?.valid;
      } else if (originType === OriginType.S3) {
        return this.serviceCreateForm.get('s3OriginSpec')?.valid;
      }
    }

    if (this.step() === 3) {
      return this.serviceCreateForm.get('cache')?.valid;
    }

    return true;
  }

  nextStep() {
    this.step.update(s => s + 1);
  }

  previousStep() {
    this.step.update(s => s - 1);
  }

  OriginChanges: Subscription | undefined = null as any;

  originTypes: OriginType[] = Object.values(OriginType) as OriginType[];
  awsSigsVersions: (2 | 4)[] = [2, 4];

  serviceCreateForm = new FormGroup({
    name: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(63),
        (control) => {
          const value = control.value;
          // Must start with a letter, allow only letters, numbers, and spaces
          const regex = /^[a-zA-Z][a-zA-Z0-9 ]*$/;
          return regex.test(value)
            ? null
            : { invalidName: 'Name must start with a letter and contain only letters, numbers, and spaces.' };
        }
      ]
    }),
    originType: new FormControl<OriginType | null>(null, { nonNullable: true, validators: [Validators.required] }),
    cache: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    hostAliases: new FormArray<FormControl<string>>([]),
    signedUrlsEnabled: new FormControl(false, { nonNullable: true }),
    wafEnabled: new FormControl(false, { nonNullable: true }),

    cacheKey: new FormGroup({
      queryParams: new FormControl<string[]>([]),
      headers: new FormArray<FormControl<string>>([]),
    })
  })

  ngOnInit(): void {
    this.serviceStore.resetUpdate();
    this.serviceStore.resetCreate();

    if (this.isEditMode && this.serviceId) {
      const service = this.serviceStore.services()?.find(s => s.metadata.name === this.serviceId);
      if (service) {
        this.serviceCreateForm.patchValue({
          name: service.spec.name,
          originType: service.spec.originType,
          cache: service.spec.cache,
          signedUrlsEnabled: service.spec.secureKeys && service.spec.secureKeys.length > 0,
          wafEnabled: service.spec.waf.enabled,
          cacheKey: {
            queryParams: service.spec.cacheKey?.queryParams || [],
            headers: service.spec.cacheKey?.headers || [],
          }
        }, { emitEvent: true });

        // These fields are editable elsewehere or not allowed.
        this.serviceCreateForm.get('name')?.disable();
        this.serviceCreateForm.get('signedUrlsEnabled')?.disable();
        this.serviceCreateForm.get('hostAliases')?.disable();

        if (service.spec.originType === OriginType.Static && service.spec.staticOrigins && service.spec.staticOrigins.length > 0) {
          (this.serviceCreateForm as any).addControl('staticOrigin', new FormGroup({
            upstream: new FormControl(service.spec.staticOrigins[0]!.upstream, { nonNullable: true, validators: [Validators.required] }),
            hostHeader: new FormControl(service.spec.staticOrigins[0]!.hostHeader, { nonNullable: false, validators: [Validators.required] }),
            port: new FormControl(service.spec.staticOrigins[0]!.port, { nonNullable: true, validators: [Validators.min(1), Validators.max(65535)] }),
            scheme: new FormControl(service.spec.staticOrigins[0]!.scheme, { nonNullable: true, validators: [Validators.required] }),
          }));
        }

        if (service.spec.originType === OriginType.S3 && service.spec.s3OriginSpec && service.spec.s3OriginSpec.length > 0) {
          (this.serviceCreateForm as any).addControl('s3OriginSpec', new FormGroup({
            awsSigsVersion: new FormControl<2 | 4>(service.spec.s3OriginSpec[0].awsSigsVersion, { nonNullable: true, validators: [Validators.required] }),
            s3AccessKeyId: new FormControl(service.spec.s3OriginSpec[0].s3AccessKeyId, { nonNullable: true, validators: [Validators.required] }),
            s3BucketName: new FormControl(service.spec.s3OriginSpec[0].s3BucketName, { nonNullable: true, validators: [Validators.required] }),
            s3Region: new FormControl(service.spec.s3OriginSpec[0].s3Region, { nonNullable: true, validators: [Validators.required] }),
            s3SecretKey: new FormControl(service.spec.s3OriginSpec[0].s3SecretKey, { nonNullable: true, validators: [Validators.required] }),
            s3Server: new FormControl(service.spec.s3OriginSpec[0].s3Server, { nonNullable: true, validators: [Validators.required] }),
            s3ServerPort: new FormControl(service.spec.s3OriginSpec[0].s3ServerPort, { nonNullable: true, validators: [Validators.min(1), Validators.max(65535)] }),
            s3ServerProto: new FormControl(service.spec.s3OriginSpec[0].s3ServerProto, { nonNullable: true, validators: [Validators.required] }),
            s3Style: new FormControl<"virtual" | "path">(service.spec.s3OriginSpec[0].s3Style!, { nonNullable: true, validators: [Validators.required] }),
          }));
        }
      }
    }

    this.OriginChanges = this.serviceCreateForm.get('originType')?.valueChanges.subscribe(value => {
      if (value === OriginType.Static) {
        (this.serviceCreateForm as any).removeControl('s3OriginSpec');
        (this.serviceCreateForm as any).addControl('staticOrigin', new FormGroup({
          upstream: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
          hostHeader: new FormControl(null, { nonNullable: false, validators: [Validators.required] }),
          port: new FormControl(443, { nonNullable: true, validators: [Validators.min(1), Validators.max(65535)] }),
          scheme: new FormControl("Https", { nonNullable: true, validators: [Validators.required] }),
        }));
      }

      if (value === OriginType.S3) {
        (this.serviceCreateForm as any).removeControl('staticOrigin');
        (this.serviceCreateForm as any).addControl('s3OriginSpec', new FormGroup({
          awsSigsVersion: new FormControl<2 | 4>(4, { nonNullable: true, validators: [Validators.required] }),
          s3AccessKeyId: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
          s3BucketName: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
          s3Region: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
          s3SecretKey: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
          s3Server: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
          s3ServerPort: new FormControl(443, { nonNullable: true, validators: [Validators.min(1), Validators.max(65535)] }),
          s3ServerProto: new FormControl("Https", { nonNullable: true, validators: [Validators.required] }),
          s3Style: new FormControl<"virtual" | "path">("virtual", { nonNullable: true, validators: [Validators.required] }),
        }));
      }
    });
  }

  ngOnDestroy(): void {
    this.OriginChanges?.unsubscribe();
  }

  onSubmit() {
    if (this.serviceCreateForm.valid) {
      const createService = this.serviceCreateForm.value as CreateServiceDto;

      if (this.isEditMode) {
        this.serviceStore.updateService(this.serviceId!, createService);
      } else {
        this.serviceStore.createService(createService);
      }
    }
  }
}
