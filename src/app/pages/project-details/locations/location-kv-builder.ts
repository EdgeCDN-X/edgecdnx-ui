import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { keyValueForm } from './location-form.model';

@Component({
  selector: 'app-location-kv-builder',
  imports: [ReactiveFormsModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="min-w-0">
      <legend class="form-label flex items-center gap-2">
        <span>{{ legend() || (kind() === 'label' ? 'Labels' : 'Metadata') }}</span>
        @if (tooltip()) {
          <button type="button" class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-400 text-xs"
            [attr.aria-label]="(legend() || 'Labels') + ' information'" [matTooltip]="tooltip()" matTooltipPosition="above" matTooltipClass="location-weight-tooltip">
            <span aria-hidden="true">?</span>
          </button>
        }
      </legend>
      @for (locked of lockedRows(); track locked.key; let lockedIndex = $index) {
        <div class="location-value-row mt-3">
          <div class="min-w-0">
            <label [for]="prefix() + '-locked-key-' + lockedIndex" class="form-label">Key</label>
            <input [id]="prefix() + '-locked-key-' + lockedIndex" class="form-input-field" [value]="locked.key" readonly aria-readonly="true" [disabled]="true" />
          </div>
          <div class="min-w-0">
            <label [for]="prefix() + '-locked-value-' + lockedIndex" class="form-label">Value</label>
            <input [id]="prefix() + '-locked-value-' + lockedIndex" class="form-input-field" [value]="locked.value" readonly aria-readonly="true" [disabled]="true" />
          </div>
          <span class="flex h-11 items-center justify-center self-end text-xs text-gray-600 dark:text-gray-400">Managed</span>
        </div>
      }
      @for (row of rows().controls; track row; let rowIndex = $index) {
        <div [formGroup]="row" class="location-value-row mt-3">
          <div class="min-w-0">
            <label [for]="prefix() + '-key-' + rowIndex" class="form-label">Key</label>
            <input [id]="prefix() + '-key-' + rowIndex" formControlName="key" class="form-input-field"
              [attr.aria-invalid]="row.controls.key.touched && row.controls.key.invalid"
              [attr.aria-describedby]="row.controls.key.touched && row.controls.key.invalid ? prefix() + '-error-' + rowIndex : null" />
          </div>
          <div class="min-w-0">
            <label [for]="prefix() + '-value-' + rowIndex" class="form-label">Value</label>
            <input [id]="prefix() + '-value-' + rowIndex" formControlName="value" class="form-input-field" />
          </div>
          <button type="button" class="location-icon-button" [disabled]="disabled()"
            [title]="'Remove ' + kind()" [attr.aria-label]="'Remove ' + kind()" (click)="rows().removeAt(rowIndex)">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        @if (row.controls.key.touched && row.controls.key.invalid) {
          <p [id]="prefix() + '-error-' + rowIndex" class="location-field-error">Key is required.</p>
        }
      }
      @if (rows().hasError('duplicate')) {
        <p class="location-field-error">Keys must be unique.</p>
      }
      @if (rows().hasError('reserved')) {
        <p class="location-field-error">The project label is managed automatically.</p>
      }
      @if (rows().hasError('labelFormat')) {
        <p class="location-field-error">Use valid Kubernetes label keys and values (alphanumerics, '-', '_', '.', max 63 characters).</p>
      }
      <button type="button" class="btn-secondary mt-3" [disabled]="disabled()" (click)="add()">
        {{ kind() === 'label' ? 'Add label' : 'Add metadata' }}
      </button>
    </fieldset>
  `,
})
export class LocationKvBuilder {
  readonly rows = input.required<FormArray<ReturnType<typeof keyValueForm>>>();
  readonly kind = input.required<'label' | 'metadata'>();
  readonly prefix = input.required<string>();
  readonly disabled = input(false);
  readonly legend = input('');
  readonly tooltip = input('');
  readonly lockedLabels = input<Record<string, string>>({});
  readonly lockedRows = computed(() => Object.entries(this.lockedLabels()).map(([key, value]) => ({ key, value })));

  add(): void { this.rows().push(keyValueForm()); }
}