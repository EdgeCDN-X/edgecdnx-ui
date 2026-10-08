import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ZoneDetails } from './zone-details';
import { DNSEndpointStore } from '../../projects/store/dns-endpoint.store';
import { DNSEndpoint, DNSEndpointActionError, DNSRoutingPolicy } from '../../projects/store/dns-endpoint.types';

describe('ZoneDetails selector records', () => {
  it('renders and searches records whose API responses omit targets', () => {
    const endpoint: DNSEndpoint = {
      kind: 'DNSEndpoint',
      apiVersion: 'infrastructure.edgecdnx.com/v1alpha1',
      metadata: { name: 'www-a', namespace: 'edgecdnx' },
      spec: {
        dnsName: 'www.example.com', routingPolicy: 'RoundRobin', recordType: 'A', recordTTL: 300,
        routeSelector: { matchLabels: { 'project': 'project-a', region: 'eu' } },
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: {
          parent: { paramMap: of(convertToParamMap({ name: 'project-a' })) },
          paramMap: of(convertToParamMap({ zoneName: 'example.com' })),
        } },
        { provide: DNSEndpointStore, useValue: {
          dnsEndpoints: signal([endpoint]),
          loading: signal(false),
          deleting: signal(false),
          error: signal<DNSEndpointActionError | null>(null),
          load: jasmine.createSpy('load'),
        } },
      ],
    });
    const fixture = TestBed.createComponent(ZoneDetails);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('RoundRobin');
    expect(fixture.nativeElement.textContent).toContain('region = eu');
    fixture.componentInstance.searchTerm.set('www');
    fixture.detectChanges();
    expect(fixture.componentInstance.visibleDNSEndpoints()).toEqual([endpoint]);
    fixture.componentInstance.searchTerm.set('missing');
    fixture.detectChanges();
    expect(fixture.componentInstance.visibleDNSEndpoints()).toEqual([]);
  });

  it('links every routing label to locations with the complete match-label selector', () => {
    const endpoint: DNSEndpoint = {
      kind: 'DNSEndpoint',
      apiVersion: 'infrastructure.edgecdnx.com/v1alpha1',
      metadata: { name: 'www-a', namespace: 'edgecdnx' },
      spec: {
        dnsName: 'www.example.com', routingPolicy: 'RoundRobin', recordType: 'A', recordTTL: 300,
        routeSelector: {
          matchLabels: { project: 'project-a', 'routing.example.com/region': 'eu', tier: 'edge', empty: '' },
        },
      },
    };
    const endpoints = signal([endpoint]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: {
          parent: { paramMap: of(convertToParamMap({ name: 'project-a' })) },
          paramMap: of(convertToParamMap({ zoneName: 'example.com' })),
        } },
        { provide: DNSEndpointStore, useValue: {
          dnsEndpoints: endpoints,
          loading: signal(false),
          deleting: signal(false),
          error: signal<DNSEndpointActionError | null>(null),
          load: jasmine.createSpy('load'),
        } },
      ],
    });
    const fixture = TestBed.createComponent(ZoneDetails);
    const element: HTMLElement = fixture.nativeElement;
    const policies: DNSRoutingPolicy[] = ['Geolocation', 'Weighted', 'RoundRobin'];
    for (const routingPolicy of policies) {
      endpoints.set([{ ...endpoint, spec: { ...endpoint.spec, routingPolicy } }]);
      fixture.detectChanges();
      const links = element.querySelectorAll<HTMLAnchorElement>('[aria-label="Route selector"] a');
      expect(links.length).toBe(4);
      for (const link of links) {
        const url = new URL(link.href);
        expect(url.pathname).toBe('/projects/project-a/locations');
        expect(url.searchParams.getAll('label')).toEqual([
          'project=project-a', 'routing.example.com/region=eu', 'tier=edge', 'empty=',
        ]);
        expect(link.getAttribute('aria-label')).toContain('matching all routing labels');
      }

      endpoints.set([{
        ...endpoint,
        metadata: { ...endpoint.metadata, labels: { service: 'managed-service' } },
        spec: { ...endpoint.spec, routingPolicy },
      }]);
      fixture.detectChanges();
      expect(element.querySelectorAll('[aria-label="Route selector"] a').length).toBe(0);
      expect(element.querySelector('[aria-label="Route selector"]')?.textContent).toContain('tier = edge');
      expect(element.textContent).toContain('Managed');
    }

    endpoints.set([{
      ...endpoint,
      spec: { ...endpoint.spec, routeSelector: { matchLabels: { region: 'eu' } } },
    }]);
    fixture.detectChanges();
    expect(element.querySelectorAll('[aria-label="Route selector"] a').length).toBe(1);
    expect(element.querySelector('[aria-label="Route selector"] a')?.getAttribute('href'))
      .toBe('/projects/project-a/locations?label=region%3Deu');

    endpoints.set([{
      ...endpoint,
      spec: {
        ...endpoint.spec,
        routeSelector: {
          ...endpoint.spec.routeSelector,
          matchExpressions: [{ key: 'tier', operator: 'In', values: ['edge', 'origin'] }],
        },
      },
    }]);
    fixture.detectChanges();
    expect(element.querySelector('[aria-label="Route selector"]')?.textContent).toContain('tier In (edge, origin)');
    expect(element.querySelectorAll('[aria-label="Route selector"] a').length).toBe(0);

    for (const routingPolicy of ['Simple', 'Failover'] as const) {
      endpoints.set([{ ...endpoint, spec: { ...endpoint.spec, routingPolicy } }]);
      fixture.detectChanges();
      expect(element.querySelectorAll('[aria-label="Route selector"] a').length).toBe(0);
    }
    expect(fixture.componentInstance.routeSelectorQueryParams({
      ...endpoint, spec: { ...endpoint.spec, routeSelector: {} },
    })).toBeNull();
    expect(fixture.componentInstance.routeSelectorQueryParams({
      ...endpoint, spec: { ...endpoint.spec, routeSelector: undefined },
    })).toBeNull();
    fixture.destroy();
  });
});
