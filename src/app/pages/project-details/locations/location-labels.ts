import { KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-location-labels',
  imports: [KeyValuePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (compact()) {
      <button type="button" class="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus-visible:outline-2 md:hidden dark:text-gray-300 dark:hover:bg-white/5"
        [attr.aria-label]="expanded() ? 'Hide location labels' : 'Show location labels'"
        [attr.aria-expanded]="expanded()" (click)="expanded.update(toggle)">
        <span aria-hidden="true">...</span>
      </button>
    }
    <ul class="gap-1.5" aria-label="Location labels"
      [class.hidden]="compact() && !expanded()" [class.flex]="!compact() || expanded()"
      [class.flex-wrap]="!compact()" [class.flex-nowrap]="compact()"
      [class.flex-col]="compact() && expanded()" [class.items-start]="compact()"
      [class.md:flex]="compact()" [class.md:flex-row]="compact()">
      @for (entry of labels() | keyvalue; track entry.key) {
        <li class="max-w-full break-all rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-white/[0.08] dark:text-gray-300">
          <a [routerLink]="filterLink()" [queryParams]="{ label: toggledLabels(entry.key + '=' + entry.value) }"
            queryParamsHandling="merge" class="rounded-full hover:underline focus-visible:outline-2"
            [class.font-semibold]="selectedLabels().includes(entry.key + '=' + entry.value)"
            [class.underline]="selectedLabels().includes(entry.key + '=' + entry.value)"
            [attr.aria-label]="'Filter locations by ' + entry.key + '=' + entry.value"
            [attr.aria-current]="selectedLabels().includes(entry.key + '=' + entry.value) ? 'true' : null">
            {{ entry.key }}={{ entry.value }}
          </a>
        </li>
      } @empty {
        <li class="base-text text-sm">No labels</li>
      }
    </ul>
  `,
})
export class LocationLabels {
  readonly labels = input<Record<string, string> | undefined>();
  readonly projectId = input.required<string>();
  readonly selectedLabels = input<string[]>([]);
  readonly compact = input(false);
  readonly expanded = signal(false);
  readonly toggle = (value: boolean): boolean => !value;
  readonly filterLink = computed(() => ['/projects', this.projectId(), 'locations']);

  toggledLabels(label: string): string[] | null {
    const selected = this.selectedLabels();
    const labels = selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label];
    return labels.length ? labels : null;
  }
}
