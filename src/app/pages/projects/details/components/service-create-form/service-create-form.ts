import { Component, inject, Input, OnDestroy, OnInit, signal } from '@angular/core';
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

  serviceStore = inject(ServiceStore);

  creating = this.serviceStore.creating;
  created = this.serviceStore.created;
  error = this.serviceStore.error;

  step = signal(1);
  submitStep = 4;

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
    this.OriginChanges = this.serviceCreateForm.get('originType')?.valueChanges.subscribe(value => {
      if (value === OriginType.Static) {
        (this.serviceCreateForm as any).removeControl('s3OriginSpec');
        (this.serviceCreateForm as any).addControl('staticOrigin', new FormGroup({
          upstream: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
          hostHeader: new FormControl(null, { nonNullable: false }),
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

      if (value == OriginType.Static || value == OriginType.S3) {
        this.nextStep();
      }
    });
  }

  ngOnDestroy(): void {
    this.OriginChanges?.unsubscribe();
  }

  onSubmit() {
    if (this.serviceCreateForm.valid) {
      const createService = this.serviceCreateForm.value as CreateServiceDto;
      this.serviceStore.createService(createService);
    }
   }
}
