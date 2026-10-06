import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ZoneDetails } from './zone-details';
import { DNSEndpointStore } from '../../projects/store/dns-endpoint.store';
import { DNSEndpoint, DNSEndpointActionError } from '../../projects/store/dns-endpoint.types';

describe('ZoneDetails selector records', () => {
  it('renders and searches records whose API responses omit targets', () => {
    const endpoint: DNSEndpoint = {
      kind: 'DNSEndpoint',
      apiVersion: 'infrastructure.edgecdnx.com/v1alpha1',
      metadata: { name: 'www-a', namespace: 'edgecdnx' },
      spec: {
        dnsName: 'www.example.com', routingPolicy: 'RoundRobin', recordType: 'A', recordTTL: 300,
        routeSelector: { matchLabels: { 'edgecdnx.com/tenant': 'project-a', region: 'eu' } },
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
});
