import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HEALTHCHECK_BAR_LIMIT } from '../../projects/store/location-healthcheck.store';
import { HealthcheckResult } from '../../projects/store/location-healthcheck.types';

@Component({
  selector: 'app-healthcheck-bars',
  imports: [MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="flex h-9 items-stretch gap-0.5" [attr.aria-label]="label()">
      @for (slot of emptySlots(); track slot) {
        <li class="max-w-2 min-w-0.5 flex-1 rounded-sm bg-gray-100 dark:bg-white/5" aria-hidden="true"></li>
      }
      @for (result of results(); track $index) {
        <li class="max-w-2 min-w-0.5 flex-1 rounded-sm transition-opacity hover:opacity-70"
          [class.bg-success-500]="result.alive" [class.bg-error-500]="!result.alive"
          tabindex="0" [matTooltip]="barLabel(result)" matTooltipPosition="above"
          matTooltipClass="healthcheck-bar-tooltip" [attr.aria-label]="barLabel(result)"></li>
      }
    </ol>
  `,
})
export class HealthcheckBars {
  readonly results = input.required<HealthcheckResult[]>();
  readonly label = input.required<string>();
  readonly emptySlots = computed(() =>
    Array.from({ length: Math.max(0, HEALTHCHECK_BAR_LIMIT - this.results().length) }, (_, index) => index),
  );

  barLabel(result: HealthcheckResult): string {
    const time = new Date(result.time).toLocaleString();
    const lines = [
      this.label(),
      `Status: ${result.alive ? 'Healthy' : 'Unhealthy'}`,
      `Source: ${result.source || 'Unknown source'}`,
      `Time: ${time}`,
    ];
    if (result.start !== undefined) lines.push(`Started: ${new Date(result.start).toLocaleString()}`);
    if (result.code !== undefined) lines.push(`Code: ${result.code}`);
    if (result.durationMs !== undefined) lines.push(`Duration: ${result.durationMs.toFixed(1)} ms`);
    if (result.message) lines.push(`Message: ${result.message}`);
    return lines.join('\n');
  }
}
