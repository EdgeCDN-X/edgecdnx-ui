import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { of } from 'rxjs';
import { ConfigService } from '../../../config/config.store';
import { LocationHealthchecks } from '../../projects/store/location-healthcheck.types';
import { LocationDetails } from './location-details';

describe('LocationDetails', () => {
  const data: LocationHealthchecks = {
    location: 'fra1', from: '2026-10-05T14:00:00Z', to: '2026-10-05T14:15:00Z',
    nodes: [
      { name: 'n2', configured: true, status: 'Unhealthy', ipv4: '74.220.31.184', checks: [{
        name: 'http', type: 'HTTP', target: '74.220.31.184', alive: false, lastCheck: '2026-10-05T14:16:18Z',
        results: [
          { time: '2026-10-05T14:16:18Z', source: 'fra', code: -1, message: 'connection refused', alive: false, durationMs: 3.6 },
          { time: '2026-10-05T14:16:18Z', source: 'ams', code: 200, message: 'OK', alive: true, durationMs: 4.8 },
        ],
        sources: [
          { source: 'ams', alive: true, lastCheck: '2026-10-05T14:16:18Z', results: [
            { time: '2026-10-05T14:16:18Z', source: 'ams', code: 200, message: 'OK', alive: true, durationMs: 4.8 },
          ] },
          { source: 'fra', alive: false, lastCheck: '2026-10-05T14:16:18Z', results: [
            { time: '2026-10-05T14:16:18Z', source: 'fra', code: -1, message: 'connection refused', alive: false, durationMs: 3.6 },
          ] },
        ],
      }] },
      { name: 'n3', configured: true, status: 'Unknown', checks: [] },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LocationDetails],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
        { provide: OAuthService, useValue: { getAccessToken: () => 'token' } },
        { provide: ActivatedRoute, useValue: {
          paramMap: of(convertToParamMap({ locationName: 'fra1' })),
          queryParamMap: of(convertToParamMap({})),
          parent: { paramMap: of(convertToParamMap({ name: 'project-a' })) },
        } },
      ],
    });
  });

  it('displays the selected location labels on its details page', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LocationDetails);
    fixture.detectChanges();
    http.expectOne('https://api.example/project/project-a/locations').flush([
      { metadata: { name: 'ams1', labels: { region: 'do-not-show' } } },
      { metadata: { name: 'fra1', labels: { region: 'eu-central', 'edgecdnx.com/tenant': 'project-a' } } },
    ]);
    http.expectOne('https://api.example/project/project-a/locations/fra1/healthchecks?limit=60').flush(data);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const labels = element.querySelector('app-location-labels');
    expect(labels?.textContent).toContain('region=eu-central');
    expect(labels?.textContent).toContain('edgecdnx.com/tenant=project-a');
    expect(labels?.textContent).not.toContain('do-not-show');
    fixture.destroy();
    http.verify();
  });

  it('shows accessible icon badges for location status, weight, node groups, and fallbacks', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LocationDetails);
    fixture.detectChanges();
    http.expectOne('https://api.example/project/project-a/locations').flush([
      { metadata: { name: 'fra1' }, status: { status: 'Healthy' },
        spec: { weight: 70, nodeGroups: [{ name: 'edge' }], fallbackLocations: ['test-loc2'] } },
    ]);
    http.expectOne('https://api.example/project/project-a/locations/fra1/healthchecks?limit=60').flush(data);
    fixture.detectChanges();
    const summary: HTMLElement = fixture.nativeElement.querySelector('[aria-label="Location summary"]');
    expect(summary.querySelectorAll('li').length).toBe(4);
    expect(summary.querySelectorAll('svg[aria-hidden="true"]').length).toBe(4);
    expect(summary.textContent).toContain('Status: Healthy');
    expect(summary.textContent).toContain('Weight: 70');
    expect(summary.textContent).toContain('Node groups: 1');
    expect(summary.textContent).toContain('Fallbacks: test-loc2');
    expect(summary.querySelector('[title="Location status"]')?.classList).toContain('text-success-700');
    fixture.componentInstance.locationStore.locations.set([{ metadata: { name: 'fra1' }, status: { status: 'Degraded' } }]);
    fixture.detectChanges();
    expect(summary.textContent).toContain('Status: Degraded');
    expect(summary.querySelector('[title="Location status"]')?.classList).toContain('text-error-700');
    fixture.componentInstance.locationStore.locations.set([{ metadata: { name: 'fra1' } }]);
    fixture.detectChanges();
    expect(summary.querySelectorAll('li').length).toBe(3);
    expect(summary.textContent).toContain('Status: Pending');
    expect(summary.textContent).toContain('Weight: 0');
    expect(summary.textContent).toContain('Node groups: 0');
    fixture.destroy();
    http.verify();
  });

  it('displays selected location GEO attributes, values, and defined weights', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LocationDetails);
    fixture.detectChanges();
    http.expectOne('https://api.example/project/project-a/locations').flush([
      { metadata: { name: 'ams1' }, spec: { geoLookup: { attributes: { hidden: { values: [{ value: 'do-not-show' }] } } } } },
      { metadata: { name: 'fra1' }, spec: { geoLookup: { weight: 0, attributes: {
        'geoip/country/code': { weight: 100, values: [{ value: 'DE', weight: 0 }, { value: 'NL', weight: 5 }] },
        'geoip/city/name': { values: [{ value: 'Frankfurt' }] },
        custom: {},
      } } } },
    ]);
    http.expectOne('https://api.example/project/project-a/locations/fra1/healthchecks?limit=60').flush(data);
    fixture.detectChanges();
    const section: HTMLElement = fixture.nativeElement.querySelector('[aria-labelledby="geo-attributes-heading"]');
    expect(section.textContent).toContain('GEO weight: 0');
    const attributes = section.querySelectorAll('dl > div');
    expect(Array.from(attributes).map((attribute) => attribute.querySelector('dt span')?.textContent))
      .toEqual(['custom', 'geoip/city/name', 'geoip/country/code']);
    expect(attributes[0].textContent).toContain('No values defined.');
    expect(attributes[1].textContent).toContain('Frankfurt');
    expect(attributes[1].textContent).not.toContain('Weight:');
    expect(attributes[2].querySelector('dt')?.textContent).toContain('Weight: 100');
    const values = attributes[2].querySelectorAll('li');
    expect(values[0].textContent).toContain('DE');
    expect(values[0].textContent).toContain('Weight: 0');
    expect(values[1].textContent).toContain('NL');
    expect(values[1].textContent).toContain('Weight: 5');
    expect(section.textContent).not.toContain('do-not-show');
    fixture.destroy();
    http.verify();
  });

  for (const spec of [undefined, {}, { geoLookup: {} }, { geoLookup: { weight: 10, attributes: {} } }]) {
    it('omits the GEO section when no attributes are defined', () => {
      const http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(LocationDetails);
      fixture.detectChanges();
      http.expectOne('https://api.example/project/project-a/locations').flush([
        { metadata: { name: 'fra1' }, spec },
      ]);
      http.expectOne('https://api.example/project/project-a/locations/fra1/healthchecks?limit=60').flush(data);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[aria-labelledby="geo-attributes-heading"]')).toBeNull();
      fixture.destroy();
      http.verify();
    });
  }

  it('shows a combined row with collapsed source details and preserves expansion across polls', fakeAsync(() => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LocationDetails);
    fixture.detectChanges();
    http.expectOne('https://api.example/project/project-a/locations').flush([]);
    http.expectOne('https://api.example/project/project-a/locations/fra1/healthchecks?limit=60').flush(data);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('article').length).toBe(2);
    const combined = element.querySelector('app-healthcheck-bars')!;
    expect(combined.querySelectorAll('li.bg-success-500').length).toBe(1);
    expect(combined.querySelectorAll('li.bg-error-500').length).toBe(1);
    expect(combined.querySelectorAll('ol li').length).toBe(60);
    expect(combined.querySelector('li.bg-success-500')?.getAttribute('aria-label')).toContain('Source: ams');
    expect(combined.querySelector('li.bg-error-500')?.getAttribute('aria-label')).toContain('Source: fra');
    const details = element.querySelector('details')!;
    expect(details.open).toBeFalse();
    expect(details.querySelector('summary')?.textContent).toContain('2 sources');
    details.querySelector('summary')!.click();
    expect(details.open).toBeTrue();
    const sources = details.querySelectorAll('section');
    expect(sources.length).toBe(2);
    expect(sources[0].textContent).toContain('ams');
    expect(sources[0].textContent).toContain('Healthy');
    expect(sources[0].querySelectorAll('li.bg-success-500').length).toBe(1);
    expect(sources[0].querySelectorAll('li.bg-error-500').length).toBe(0);
    expect(sources[1].textContent).toContain('fra');
    expect(sources[1].textContent).toContain('Unhealthy');
    expect(sources[1].textContent).toContain('connection refused');
    expect(sources[1].querySelectorAll('li.bg-error-500').length).toBe(1);

    tick(30_000);
    http.expectOne('https://api.example/project/project-a/locations/fra1/healthchecks?limit=60').flush(data);
    fixture.detectChanges();
    expect(element.querySelector('details')).toBe(details);
    expect(details.open).toBeTrue();
    details.querySelector('summary')!.click();
    expect(details.open).toBeFalse();
    expect(element.textContent).toContain('connection refused');
    expect(element.textContent).toContain('No data');
    fixture.destroy();
    http.verify();
  }));

  it('labels legacy results without a source as Unknown source', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LocationDetails);
    fixture.detectChanges();
    http.expectOne('https://api.example/project/project-a/locations').flush([]);
    const legacy = structuredClone(data);
    const check = legacy.nodes[0].checks[0];
    check.results = [{ time: '2026-10-05T14:16:18Z', source: '', alive: true, message: 'OK' }];
    check.sources = [{ source: '', alive: true, lastCheck: check.lastCheck, results: check.results }];
    http.expectOne('https://api.example/project/project-a/locations/fra1/healthchecks?limit=60').flush(legacy);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('summary')?.textContent).toContain('1 source');
    expect(element.querySelector('details section')?.textContent).toContain('Unknown source');
    expect(element.querySelector('li.bg-success-500')?.getAttribute('aria-label')).toContain('Unknown source');
    fixture.destroy();
    http.verify();
  });
});
