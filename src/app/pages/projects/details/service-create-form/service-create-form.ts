import { Component, Input, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CreateServiceDto, OriginType } from '../../store/service.types';

@Component({
  selector: 'app-service-create-form',
  imports: [ReactiveFormsModule],
  templateUrl: './service-create-form.html',
  styleUrl: './service-create-form.css',
})
export class ServiceCreateForm implements OnInit {
  @Input() projectId!: string;

  // createServiceModel = signal<CreateServiceDto>({
  //   name: '',
  //   originType: 'static',
  //   staticOrigin: {
  //     upstream: '',
  //     port: 443,
  //     scheme: 'Https',
  //   }
  // });

  originTypes: OriginType[] = Object.values(OriginType) as OriginType[];

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
    staticOrigin: new FormGroup({
      upstream: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
      hostHeader: new FormControl(null, { nonNullable: true }),
      port: new FormControl(443, { nonNullable: true, validators: [Validators.min(1), Validators.max(65535)] }),
      scheme: new FormControl("Https", { nonNullable: true, validators: [Validators.required] }),
    })
  })

  ngOnInit(): void { }

  onSubmit() { }

}
