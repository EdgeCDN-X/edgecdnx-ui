import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, FormBuilder, FormArray, AbstractControl, isFormArray } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SwitchComponent } from '../../../../shared/components/form/input/switch.component';
import { TagInputComponent } from '../../../../shared/components/form/input/tag-input.component';
import { ServiceStore } from '../../../projects/store/service.store';
import { OriginType, CreateServiceDto, CorsDto } from '../../../projects/store/service.types';


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

  // TODO perhaps implement onSuccess hook for closing modal in parent

  serviceStore = inject(ServiceStore);

  creating = this.serviceStore.creating;
  created = this.serviceStore.created;

  updating = this.serviceStore.updating;
  updated = this.serviceStore.updated;
  error = this.serviceStore.error;

  step = signal(1);
  submitStep = 5;

  private readonly defaultCorsMethods = ['GET', 'HEAD', 'OPTIONS'];
  private readonly defaultCorsOrigins = ['*'];
  readonly corsMethodOptions = ['GET', 'HEAD', 'OPTIONS'];

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

    if (this.step() === 4) {
      if (!this.serviceCreateForm.get('corsEnabled')?.value) {
        return true;
      }
      return this.serviceCreateForm.get('cors')?.valid;
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
  corsEnabledChanges: Subscription | undefined = null as any;

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
    corsEnabled: new FormControl(true, { nonNullable: true }),

    path: new FormGroup({
      paths: new FormArray<FormControl<string>>([
        new FormControl("/", { nonNullable: true, validators: [Validators.required] })
      ], { validators: [Validators.required, Validators.minLength(1)], }),
      rewrite: new FormControl<string | null>(null, { nonNullable: false }),
    }),

    cacheKey: new FormGroup({
      queryParams: new FormControl<string[]>([]),
      headers: new FormArray<FormControl<string>>([]),
    }),

    cors: this.createCorsGroup()
  })

  ngOnInit(): void {
    this.serviceStore.resetUpdate();
    this.serviceStore.resetCreate();

    if (this.isEditMode && this.serviceId) {
      const service = this.serviceStore.services()?.find(s => s.metadata.name === this.serviceId);
      if (service) {
        const allowedMethods = this.normalizeTags(service.spec.cors?.allowedMethods, true);
        const allowedOrigins = this.normalizeTags(service.spec.cors?.allowedOrigins);

        this.serviceCreateForm.patchValue({
          name: service.spec.name,
          originType: service.spec.originType,
          cache: service.spec.cache,
          signedUrlsEnabled: service.spec.secureKeys && service.spec.secureKeys.length > 0,
          wafEnabled: service.spec.waf.enabled,
          corsEnabled: !!service.spec.cors,
          cacheKey: {
            queryParams: service.spec.cacheKey?.queryParams || [],
            headers: service.spec.cacheKey?.headers || [],
          },
        }, { emitEvent: true });

        if (service.spec.cors) {
          this.serviceCreateForm.setControl('cors', this.createCorsGroup({
            allowedMethods: allowedMethods.length > 0 ? allowedMethods : [...this.defaultCorsMethods],
            allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : [...this.defaultCorsOrigins],
            allowCredentials: service.spec.cors?.allowCredentials ?? true,
          }));
        } else {
          (this.serviceCreateForm as any).removeControl('cors');
        }

        if (service.spec.path?.paths && service.spec.path.paths.length > 0) {
          this.serviceCreateForm.setControl('path', new FormGroup({
            paths: new FormArray<FormControl<string>>(
              service.spec.path?.paths?.map(p => new FormControl(p, { nonNullable: true, validators: [Validators.required] })) || [],
              { validators: [Validators.required, Validators.minLength(1)], }
            ),
            rewrite: new FormControl(service.spec.path?.rewrite || null, { nonNullable: false }),
          }));
        } else {
          this.serviceCreateForm.setControl('path', new FormGroup({
            paths: new FormArray<FormControl<string>>([
              new FormControl("/", { nonNullable: true, validators: [Validators.required] })
            ], { validators: [Validators.required, Validators.minLength(1)], }),
            rewrite: new FormControl<string | null>(null, { nonNullable: false }),
          }));
        }


        // These fields are editable elsewehere or not allowed.
        this.serviceCreateForm.get('name')?.disable();
        this.serviceCreateForm.get('signedUrlsEnabled')?.disable();
        this.serviceCreateForm.get('hostAliases')?.disable();

        if (service.spec.originType === OriginType.Static && service.spec.staticOrigins && service.spec.staticOrigins.length > 0) {
          (this.serviceCreateForm as any).addControl('staticOrigin', new FormGroup({
            upstream: new FormControl(service.spec.staticOrigins[0]!.upstream, { nonNullable: true, validators: [Validators.required, Validators.pattern(/(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{1,63}(?<!-)\.)+[a-zA-Z]{2,63}$)/)] }),
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

    this.corsEnabledChanges = this.serviceCreateForm.get('corsEnabled')?.valueChanges.subscribe(enabled => {
      this.toggleCorsGroup(enabled);
    });
  }

  ngOnDestroy(): void {
    this.OriginChanges?.unsubscribe();
    this.corsEnabledChanges?.unsubscribe();
  }

  get paths() {
    return (this.serviceCreateForm.get('path')?.get('paths') as FormArray<FormControl<string>>);
  }

  addPath(defaultPath: string = "/") {
    const paths = this.serviceCreateForm.get('path')?.get('paths') as FormArray<FormControl<string>>;
    paths.push(new FormControl(defaultPath, { nonNullable: true, validators: [Validators.required] }));
  }

  removePath(index: number) {
    const paths = this.serviceCreateForm.get('path')?.get('paths') as FormArray<FormControl<string>>;
    paths.removeAt(index);
  }

  onSubmit() {
    if (this.serviceCreateForm.valid) {
      const createService = this.serviceCreateForm.value as CreateServiceDto;
      createService.cors = this.serviceCreateForm.get('corsEnabled')?.value ? this.normalizedCors() : null;

      if (this.isEditMode) {
        this.serviceStore.updateService(this.serviceId!, createService);
      } else {
        this.serviceStore.createService(createService);
      }
    }
  }

  private createCorsGroup(initial?: Partial<CorsDto>): FormGroup {
    return new FormGroup({
      allowedMethods: new FormControl<string[]>(initial?.allowedMethods || [...this.defaultCorsMethods], {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(1)],
      }),
      allowedOrigins: new FormControl<string[]>(initial?.allowedOrigins || [...this.defaultCorsOrigins], {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(1)],
      }),
      allowCredentials: new FormControl(initial?.allowCredentials ?? true, { nonNullable: true }),
    });
  }

  private normalizeTags(values?: string[], uppercase: boolean = false): string[] {
    const normalized = (values || [])
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => uppercase ? item.toUpperCase() : item);

    return [...new Set(normalized)];
  }

  private normalizedCors(): CorsDto {
    const corsValue = this.serviceCreateForm.get('cors')?.value as CorsDto | undefined;
    const methods = this.normalizeTags(corsValue?.allowedMethods, true);
    const origins = this.normalizeTags(corsValue?.allowedOrigins);

    return {
      allowedMethods: methods.length > 0 ? methods : [...this.defaultCorsMethods],
      allowedOrigins: origins.length > 0 ? origins : [...this.defaultCorsOrigins],
      allowCredentials: corsValue?.allowCredentials ?? true,
    };
  }

  private toggleCorsGroup(enabled: boolean): void {
    const hasCorsGroup = !!this.serviceCreateForm.get('cors');

    if (enabled && !hasCorsGroup) {
      this.serviceCreateForm.setControl('cors', this.createCorsGroup());
    }

    if (!enabled && hasCorsGroup) {
      (this.serviceCreateForm as any).removeControl('cors');
    }
  }
}
