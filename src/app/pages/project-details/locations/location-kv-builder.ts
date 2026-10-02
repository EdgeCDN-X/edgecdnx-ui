import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { keyValueForm } from './location-form.model';

@Component({
  selector: 'app-location-kv-builder',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="min-w-0">
      <legend class="form-label">{{ kind() === 'label' ? 'Labels' : 'Metadata' }}</legend>
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

  add(): void { this.rows().push(keyValueForm()); }
}