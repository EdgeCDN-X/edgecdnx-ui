import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-tag-input',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: TagInputComponent
    }
  ],
  template: `
    <div
      class="flex flex-wrap gap-2 rounded-md border border-gray-300 p-2
             focus-within:ring-2 focus-within:ring-blue-500"
    >
      <!-- Chips -->
      <ng-container *ngFor="let tag of tags; let i = index">
        <span
          class="flex items-center gap-1 rounded-full bg-blue-100
                 px-3 py-1 text-sm text-blue-800"
        >
          {{ tag }}
          <button
            type="button"
            class="text-blue-600 hover:text-blue-900"
            (click)="removeTag(i)"
          >
            ×
          </button>
        </span>
      </ng-container>

      <!-- Input -->
      <input
        class="flex-1 min-w-[120px] border-none p-1 focus:outline-none"
        [placeholder]="placeholder"
        [value]="input"
        (input)="input = $event.target.value"
        (keydown)="handleKeydown($event)"
      />
    </div>

    <!-- Optional: native form submission -->
    <input type="hidden" name="tags" [value]="tags | json" />
  `
})
export class TagInputComponent implements ControlValueAccessor {
  @Input()
  placeholder: string = 'Add entry';

  tags = Array<string>();
  input = '';


  onChange = (tags: string[]) => { };

  onTouched = () => { };

  touched = false;

  disabled = false;

  writeValue(tags: string[]) {
    this.tags = tags || [];
  }

  registerOnChange(onChange: any) {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: any) {
    this.onTouched = onTouched;
  }

  markAsTouched() {
    if (!this.touched) {
      this.onTouched();
      this.touched = true;
    }
  }

  setDisabledState(disabled: boolean) {
    this.disabled = disabled;
  }

  addTag() {
    const value = this.input.trim();
    if (!value) return;

    if (!this.tags.includes(value)) {
      this.tags = [...this.tags, value];
    }

    this.onChange(this.tags);
    this.markAsTouched();

    this.input = '';
  }

  removeTag(index: number) {
    this.tags = this.tags.filter((_, i) => i !== index);

    this.onChange(this.tags);
    this.markAsTouched();
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      this.addTag();
    }
  }
}