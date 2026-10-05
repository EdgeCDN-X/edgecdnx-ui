import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
          { time: '2026-10-05T14:16:08Z', code: 200, message: 'OK', alive: true, durationMs: 4.8 },
          { time: '2026-10-05T14:16:18Z', code: -1, message: 'connection refused', alive: false, durationMs: 3.6 },
        ],
      }] },
      { name: 'n3', configured: true, status: 'Unknown', checks: [] },
    ],
  };

  it('renders green and red bars per node', () => {
    TestBed.configureTestingModule({
      imports: [LocationDetails],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
        { provide: OAuthService, useValue: { getAccessToken: () => 'token' } },
        { provide: ActivatedRoute, useValue: {
          paramMap: of(convertToParamMap({ locationName: 'fra1' })),
          parent: { paramMap: of(convertToParamMap({ name: 'project-a' })) },
        } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LocationDetails);
    fixture.detectChanges();
    http.expectOne('https://api.example/project/project-a/locations').flush([]);
    http.expectOne('https://api.example/project/project-a/locations/fra1/healthchecks?limit=60').flush(data);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('article').length).toBe(2);
    expect(element.querySelectorAll('li.bg-success-500').length).toBe(1);
    expect(element.querySelectorAll('li.bg-error-500').length).toBe(1);
    expect(element.querySelectorAll('ol li').length).toBe(60);
    expect(element.textContent).toContain('connection refused');
    expect(element.textContent).toContain('No data');
    fixture.destroy();
    http.verify();
  });
});
