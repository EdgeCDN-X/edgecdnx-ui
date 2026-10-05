import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { OAuthService } from 'angular-oauth2-oidc';
import { ConfigService } from '../../../config/config.store';
import { HEALTHCHECK_POLL_INTERVAL_MS, LocationHealthcheckStore } from './location-healthcheck.store';
import { LocationHealthchecks } from './location-healthcheck.types';

describe('LocationHealthcheckStore', () => {
  let store: LocationHealthcheckStore;
  let http: HttpTestingController;
  const url = 'https://api.example/project/project-a/locations/fra1/healthchecks?limit=60';
  const data: LocationHealthchecks = {
    location: 'fra1', from: '2026-10-05T14:00:00Z', to: '2026-10-05T14:15:00Z',
    nodes: [{ name: 'n1', configured: true, status: 'Healthy', checks: [] }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), LocationHealthcheckStore,
      { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
      { provide: OAuthService, useValue: { getAccessToken: () => 'test-access-token' } },
    ] });
    store = TestBed.inject(LocationHealthcheckStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('polls every 30 seconds and keeps the last data when a poll fails', fakeAsync(() => {
    const subscription = store.poll('project-a', 'fra1').subscribe();
    tick(0);
    const first = http.expectOne(url);
    expect(first.request.headers.get('Authorization')).toBe('Bearer test-access-token');
    first.flush(data);
    expect(store.healthchecks()).toEqual(data);
    expect(store.lastUpdated()).not.toBeNull();

    tick(HEALTHCHECK_POLL_INTERVAL_MS);
    http.expectOne(url).flush({ error: 'failed to query healthchecks' }, { status: 502, statusText: 'Bad Gateway' });
    expect(store.error()).toBe('failed to query healthchecks');
    expect(store.healthchecks()).toEqual(data);

    tick(HEALTHCHECK_POLL_INTERVAL_MS);
    http.expectOne(url).flush(data);
    expect(store.error()).toBeNull();

    subscription.unsubscribe();
    tick(HEALTHCHECK_POLL_INTERVAL_MS);
    http.expectNone(url);
  }));
});
