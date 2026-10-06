import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OAuthService } from 'angular-oauth2-oidc';
import { ConfigService } from '../../../config/config.store';
import { HealthCheckProfileStore } from './healthcheckprofile.store';
import { HealthCheckProfile, CreateHealthCheckProfileDto } from './healthcheckprofile.types';

describe('HealthCheckProfileStore', () => {
  let store: HealthCheckProfileStore;
  let http: HttpTestingController;
  const collection = 'https://api.example/project/project-a/healthcheckprofiles';
  const dto: CreateHealthCheckProfileDto = { name: 'web', probes: [{ name: 'tcp', type: 'TCP', tcp: { port: 80 } }] };
  const profile: HealthCheckProfile = { metadata: { name: 'web' }, spec: { probes: dto.probes } };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), HealthCheckProfileStore,
      { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
      { provide: OAuthService, useValue: { getAccessToken: () => 'test-token' } },
    ] });
    store = TestBed.inject(HealthCheckProfileStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function load(): void {
    store.load('project-a').subscribe();
    const request = http.expectOne(collection);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([]);
  }

  it('lists, creates, gets, patches and deletes profiles', () => {
    load();
    store.create('project-a', dto).subscribe();
    let request = http.expectOne(collection);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(dto);
    request.flush(profile);
    expect(store.profiles()).toEqual([profile]);
    store.get('project-a', 'web').subscribe((item) => expect(item).toEqual(profile));
    request = http.expectOne(collection + '/web');
    expect(request.request.method).toBe('GET');
    request.flush(profile);
    store.update('project-a', 'web', { probes: dto.probes }).subscribe();
    request = http.expectOne(collection + '/web');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ probes: dto.probes });
    request.flush({ ...profile, metadata: { name: 'web', labels: { 'project': 'project-a' } } });
    expect(store.profiles()[0].metadata.labels).toEqual({ 'project': 'project-a' });
    store.delete('project-a', 'web').subscribe();
    request = http.expectOne(collection + '/web');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    expect(store.profiles()).toEqual([]);
    expect(store.saving()).toBeFalse();
    expect(store.deleting()).toBeFalse();
  });

  it('does not leak late list or create responses into a different project', () => {
    store.load('project-a').subscribe();
    const oldLoad = http.expectOne(collection);
    store.create('project-a', dto).subscribe();
    const oldCreate = http.expectOne(collection);
    store.load('project-b').subscribe();
    http.expectOne('https://api.example/project/project-b/healthcheckprofiles').flush([]);
    oldLoad.flush([profile]);
    oldCreate.flush(profile);
    expect(store.profiles()).toEqual([]);
    expect(store.loading()).toBeFalse();
  });

  it('surfaces API errors and resets operation state', () => {
    load();
    store.create('project-a', dto).subscribe({ error: () => {} });
    http.expectOne(collection).flush({ error: 'Profile already exists' }, { status: 409, statusText: 'Conflict' });
    expect(store.error()).toBe('Profile already exists');
    expect(store.saving()).toBeFalse();
    store.delete('project-a', 'web').subscribe({ error: () => {} });
    http.expectOne(collection + '/web').flush({ error: 'Delete failed' }, { status: 500, statusText: 'Error' });
    expect(store.error()).toBe('Delete failed');
    expect(store.deleting()).toBeFalse();
  });

  it('encodes project and profile identifiers', () => {
    store.get('project/a', 'profile/a').subscribe();
    http.expectOne('https://api.example/project/project%2Fa/healthcheckprofiles/profile%2Fa').flush(profile);
  });
});
