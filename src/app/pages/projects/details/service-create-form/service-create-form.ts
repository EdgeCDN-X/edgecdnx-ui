import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, FormBuilder } from '@angular/forms';
import { CreateServiceDto, OriginType } from '../../store/service.types';

@Component({
  selector: 'app-service-create-form',
  imports: [ReactiveFormsModule],
  templateUrl: './service-create-form.html',
  styleUrl: './service-create-form.css',
})
export class ServiceCreateForm implements OnInit {
  @Input() projectId!: string;

  private formBuilder = inject(FormBuilder);


  step = signal(1);

  nextStep() {
    this.step.update(s => s + 1);
  }

  previousStep() {
    this.step.update(s => s - 1);
  }

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
    originType: new FormControl<OriginType | null>(null, { nonNullable: true, validators: [Validators.required] })
  })

  ngOnInit(): void {
    this.serviceCreateForm.get('originType')?.valueChanges.subscribe(value => {
      if (value === OriginType.Static) {
        (this.serviceCreateForm as any).removeControl('s3OriginSpec');
        (this.serviceCreateForm as any).addControl('staticOrigin', new FormGroup({
          upstream: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
          hostHeader: new FormControl(null, { nonNullable: true }),
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

  onSubmit() { }

}
