import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ConfigService } from '../../../../config/config.store';

@Component({
  selector: 'app-zone-delegation',
  templateUrl: './zone-delegation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoneDelegation {
  readonly domain = input<string | null | undefined>(null);
  private readonly config = inject(ConfigService);
  readonly nameservers = computed(() => this.config.environment()?.dnsNameservers);
}
