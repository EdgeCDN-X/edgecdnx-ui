import { Component, effect, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServiceStore } from '../../../projects/store/service.store';

@Component({
  selector: 'app-key-add',
  imports: [ReactiveFormsModule],
  templateUrl: './key-add.html',
  styleUrl: './key-add.css',
})
export class KeyAdd implements OnInit {
  @Input() serviceId: string | null = "";
  @Output() onKeyAdded = new EventEmitter<{ name: string | undefined }>();

  serviceStore = inject(ServiceStore);

  error = this.serviceStore.error;
  updating = this.serviceStore.updating;
  updated = this.serviceStore.updated;

  newKeyForm = new FormGroup({
    keyName: new FormControl('', {
      nonNullable: true, validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(32),
        Validators.pattern('^[a-z]+[a-z0-9]*$')]
    })
  })

  ngOnInit(): void {
    this.serviceStore.resetUpdate();
  }

  onSubmit(): void {
    if (this.newKeyForm.valid) {
      this.serviceStore.addKey(this.serviceId!, this.newKeyForm.get('keyName')?.value!);
    }
  }

  constructor() {
    effect(() => {
      if (this.serviceStore.updated()) {
        this.onKeyAdded.emit({ name: this.newKeyForm.get('keyName')?.value });
      }
    })
  }
}
