import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { JsonPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ConfigService, DNSNameserver } from '../../../../config/config.store';
import { DNSRecordType, DNSRoutingPolicy } from '../../../projects/store/dns-endpoint.types';

interface ResolveResult {
  nameserver: DNSNameserver;
  loading: boolean;
  response?: unknown;
  parsed?: ParsedResponse;
  error?: string;
}

interface DNSRecordRow {
  section: string;
  name: string;
  type: string;
  class: string;
  ttl: number;
  data: string;
}

interface ParsedResponse {
  rcode: string;
  domain?: string;
  sourceIP?: string;
  records: DNSRecordRow[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseResponse(value: unknown): ParsedResponse | null {
  if (!isObject(value) || !isObject(value['response'])) {
    return null;
  }
  const response = value['response'];
  if (typeof response['rcode'] !== 'string' || !Array.isArray(response['answer'])) {
    return null;
  }
  const records: DNSRecordRow[] = [];
  for (const [key, section] of [['answer', 'Answer'], ['authority', 'Authority'], ['additional', 'Additional']]) {
    const entries: unknown = response[key];
    if (entries === undefined) {
      continue;
    }
    if (!Array.isArray(entries)) {
      return null;
    }
    for (const entry of entries) {
      if (!isObject(entry) || typeof entry['name'] !== 'string' ||
          typeof entry['type'] !== 'string' || typeof entry['class'] !== 'string' ||
          typeof entry['ttl'] !== 'number' || !Number.isFinite(entry['ttl']) ||
          typeof entry['data'] !== 'string') {
        return null;
      }
      records.push({
        section, name: entry['name'], type: entry['type'], class: entry['class'],
        ttl: entry['ttl'], data: entry['data'],
      });
    }
  }
  return {
    rcode: response['rcode'],
    domain: typeof value['domain'] === 'string' ? value['domain'] : undefined,
    sourceIP: typeof value['source_ip'] === 'string' ? value['source_ip'] : undefined,
    records,
  };
}

@Component({
  selector: 'app-zone-resolve',
  imports: [FormsModule, JsonPipe],
  templateUrl: './zone-resolve.html',
})
export class ZoneResolve {
  readonly domain = input.required<string>();
  readonly routingPolicy = input<DNSRoutingPolicy>('Simple');
  readonly recordType = input<DNSRecordType>('A');
  readonly requiresSourceIP = computed(() => this.routingPolicy() === 'Geolocation');
  readonly requiresIPv6 = computed(() => this.requiresSourceIP() && this.recordType() === 'AAAA');
  readonly wildcard = computed(() => this.domain().startsWith('*.'));
  private readonly config = inject(ConfigService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private requests = new Subscription();

  readonly nameservers = computed(() => this.config.environment()?.dnsNameservers ?? []);
  readonly results = signal<ResolveResult[]>([]);
  readonly loading = computed(() => this.results().some(result => result.loading));
  readonly error = signal<string | null>(null);
  selectedNS = 'all';
  sourceIP = '';
  additionalHost = '';

  resolve() {
    this.error.set(null);
    const sourceIP = this.sourceIP.trim();
    if (this.requiresSourceIP() &&
        (!this.validIP(sourceIP) || (this.requiresIPv6() && !sourceIP.includes(':')))) {
      this.error.set(this.requiresIPv6()
        ? 'A valid source IPv6 address is required for Geolocation AAAA records.'
        : 'A valid source IPv4 or IPv6 address is required for Geolocation records.');
      return;
    }
    let domain = this.domain();
    if (this.wildcard()) {
      const host = this.additionalHost.trim();
      const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
      if (!host || !host.split('.').every(part => label.test(part))) {
        this.error.set('Enter a valid additional host, such as www or api.eu, to replace the wildcard.');
        return;
      }
      domain = host + domain.slice(1);
      if (domain.replace(/\.$/, '').length > 253) {
        this.error.set('The resolved domain name must not exceed 253 characters.');
        return;
      }
    }
    const apiUrl = this.config.environment()?.apiUrl;
    const targets = this.nameservers().filter(ns => this.selectedNS === 'all' || ns.ns === this.selectedNS);
    if (!apiUrl || !targets.length) {
      this.error.set('No API or nameservers configured for this lookup.');
      return;
    }
    if (targets.some(ns => !this.validEndpoint(ns.routeResolver))) {
      this.error.set('Each selected nameserver must have a full HTTP or HTTPS routeResolver URL.');
      return;
    }

    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.results.set(targets.map(nameserver => ({ nameserver, loading: true })));
    targets.forEach((nameserver, index) => {
      this.requests.add(this.http.post<unknown>(`${apiUrl.replace(/\/$/, '')}/utils/resolve`, {
        ns: nameserver.routeResolver,
        domain,
        record_type: this.recordType(),
        ...(this.requiresSourceIP() ? { source_ip: sourceIP } : {}),
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => {
          const parsed = parseResponse(response);
          this.update(index, parsed
            ? { nameserver, loading: false, response, parsed }
            : { nameserver, loading: false, error: 'Invalid DNS response: unable to read DNS records.' });
        },
        error: (err: HttpErrorResponse) => this.update(index, {
          nameserver,
          loading: false,
          error: `HTTP ${err.status}: ${this.errorMessage(err)}`,
        }),
      }));
    });
  }

  private validIP(value: string): boolean {
    if (value.includes(':')) {
      try {
        return new URL(`http://[${value}]/`).hostname.startsWith('[');
      } catch {
        return false;
      }
    }
    const parts = value.split('.');
    return parts.length === 4 && parts.every(part =>
      /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
  }

  private validEndpoint(value: string): boolean {
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname &&
        !url.username && !url.password && !url.hash;
    } catch {
      return false;
    }
  }

  private errorMessage(err: HttpErrorResponse): string {
    const body: unknown = err.error;
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error;
    }
    return err.message || 'Unable to resolve domain';
  }

  private update(index: number, result: ResolveResult) {
    this.results.update(results => results.map((entry, i) => i === index ? result : entry));
  }
}
