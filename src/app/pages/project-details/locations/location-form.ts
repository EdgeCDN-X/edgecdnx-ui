import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectLocation, CreateLocationDto, UpdateLocationDto } from '../../projects/store/location.types';
import { attributeForm, attributeValueForm, continentCodes, createLocationForm, fallbackForm, geoLookupAttributes, healthCheckProfileValidator, locationDtoFromForm, nodeForm, nodeGroupForm, projectFallbackLocationNames, projectHealthCheckProfileNames, selectGeoLookupAttribute, tenantLabelKey } from './location-form.model';
import { LocationKvBuilder } from './location-kv-builder';
import { HealthCheckProfile } from '../../projects/store/healthcheckprofile.types';

@Component({
  selector: 'app-location-form',
  imports: [ReactiveFormsModule, MatTooltipModule, LocationKvBuilder],
  templateUrl: './location-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationForm {
  readonly projectId = input.required<string>();
  readonly location = input<ProjectLocation | null>(null);
  readonly availableLocations = input<readonly ProjectLocation[]>([]);
  readonly availableProfiles = input<readonly HealthCheckProfile[]>([]);
  readonly saving = input(false);
  readonly submitted = output<CreateLocationDto | UpdateLocationDto>();
  readonly cancelled = output<void>();
  readonly validationError = signal<string | null>(null);
  readonly attributeOptions = geoLookupAttributes;
  readonly continentOptions = continentCodes;
  readonly fallbackOptions = computed(() => projectFallbackLocationNames(
    this.availableLocations(), this.projectId(), this.location()?.metadata.name,
  ));
  readonly tenantLabel = computed(() => ({ [tenantLabelKey]: this.projectId() }));
  readonly profileOptions = computed(() => projectHealthCheckProfileNames(this.availableProfiles(), this.projectId()));
  form = createLocationForm();

  constructor() {
    effect(() => {
      this.form = createLocationForm(this.location() ?? undefined);
      if (this.location()) this.form.controls.name.disable();
      this.validationError.set(null);
    });
    effect(() => {
      if (this.saving()) this.form.disable();
      else {
        this.form.enable();
        if (this.location()) this.form.controls.name.disable();
      }
    });
    effect(() => {
      const availableNames = this.fallbackOptions();
      for (const fallback of this.form.controls.fallbackLocations.controls) {
        fallback.setValidators(fallbackForm(fallback.value, availableNames).validator);
        fallback.updateValueAndValidity();
      }
    });
    effect(() => {
      this.location();
      this.profileOptions();
      this.validateGroupProfiles();
    });
  }

  addGroup(): void {
    this.form.controls.nodeGroups.push(nodeGroupForm());
    this.validateGroupProfiles();
  }
  addNode(groupIndex: number): void { this.form.controls.nodeGroups.at(groupIndex).controls.nodes.push(nodeForm()); }
  addAttribute(): void { this.form.controls.attributes.push(attributeForm()); }
  addValue(attributeIndex: number): void {
    const attribute = this.form.controls.attributes.at(attributeIndex);
    attribute.controls.values.push(attributeValueForm('', 0, attribute.controls.name.value));
  }
  selectAttribute(attributeIndex: number, event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      selectGeoLookupAttribute(this.form.controls.attributes.at(attributeIndex), event.target.value);
    }
  }
  supportedAttribute(name: string): boolean {
    return this.attributeOptions.some((option) => option.name === name);
  }
  addFallback(): void {
    this.form.controls.fallbackLocations.push(fallbackForm('', this.fallbackOptions()));
  }

  submit(): void {
    if (this.saving()) return;
    this.validateGroupProfiles();
    this.form.markAllAsTouched();
    this.validationError.set(null);
    try {
      const dto = locationDtoFromForm(this.form, this.projectId());
      this.submitted.emit(this.location() ? dto : { ...dto, name: this.form.controls.name.getRawValue() });
    } catch (error: unknown) {
      this.validationError.set(error instanceof Error ? error.message : 'Invalid location settings.');
    }

  }

  private validateGroupProfiles(): void {
    const validator = healthCheckProfileValidator(this.profileOptions());
    for (const group of this.form.controls.nodeGroups.controls) {
      group.controls.healthCheck.setValidators(validator);
      group.controls.healthCheck.updateValueAndValidity();
    }
  }
}