import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CreateHealthCheckProfileDto, HealthCheckProfile, UpdateHealthCheckProfileDto } from '../../projects/store/healthcheckprofile.types';
import { tenantLabelKey } from '../locations/location-form.model';
import { createHealthCheckProfileForm, healthCheckProfileDtoFromForm, probeForm } from './healthcheckprofile-form.model';

@Component({
  selector: 'app-healthcheckprofile-form',
  imports: [ReactiveFormsModule],
  templateUrl: './healthcheckprofile-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthCheckProfileForm {
  readonly projectId = input.required<string>();
  readonly profile = input<HealthCheckProfile | null>(null);
  readonly saving = input(false);
  readonly submitted = output<CreateHealthCheckProfileDto | UpdateHealthCheckProfileDto>();
  readonly cancelled = output<void>();
  readonly validationError = signal<string | null>(null);
  readonly tenantLabelKey = tenantLabelKey;
  form = createHealthCheckProfileForm();

  constructor() {
    effect(() => {
      this.form = createHealthCheckProfileForm(this.profile() ?? undefined);
      if (this.profile()) this.form.controls.name.disable();
      this.validationError.set(null);
    });
    effect(() => {
      if (this.saving()) this.form.disable();
      else {
        this.form.enable();
        if (this.profile()) this.form.controls.name.disable();
      }
    });
  }

  addProbe(): void { this.form.controls.probes.push(probeForm()); }

  submit(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    this.validationError.set(null);
    try {
      const dto = healthCheckProfileDtoFromForm(this.form);
      this.submitted.emit(this.profile() ? dto : { ...dto, name: this.form.controls.name.getRawValue() });
    } catch (error: unknown) {
      this.validationError.set(error instanceof Error ? error.message : 'Invalid health check profile.');
    }
  }
}
