import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OAuthService } from 'angular-oauth2-oidc';
import { ConfigService } from '../../../config/config.store';
import { LocationStore } from './location.store';
import { ProjectLocation, UpdateLocationDto } from './location.types';

describe('LocationStore', () => {
  let store: LocationStore;
  let http: HttpTestingController;
  const dto: UpdateLocationDto = { labels: {}, weight: 0, geoLookup: { weight: 0, attributes: {} }, nodeGroups: [], fallbackLocations: [] };
  const location: ProjectLocation = { metadata: { name: 'fra1' }, spec: dto };
  const collection = 'https://api.example/project/project-a/locations';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), LocationStore,
      { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
      { provide: OAuthService, useValue: { getAccessToken: () => 'test-access-token' } },
    ] });
    store = TestBed.inject(LocationStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function load(): void {
    store.load('project-a').subscribe();
    const request = http.expectOne(collection);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-access-token');
    request.flush([]);
  }

  it('creates, patches, and deletes using the project-scoped API', () => {
    load();
    store.create('project-a', { ...dto, name: 'fra1' }).subscribe();
    let request = http.expectOne(collection);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ ...dto, name: 'fra1' });
    request.flush(location);
    expect(store.locations().length).toBe(1);
    store.update('project-a', 'fra1', { ...dto, weight: 100 }).subscribe();
    request = http.expectOne(collection + '/fra1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.weight).toBe(100);
    request.flush({ ...location, spec: { ...dto, weight: 100 } });
    expect(store.locations()[0].spec?.weight).toBe(100);
    store.delete('project-a', 'fra1').subscribe();
    request = http.expectOne(collection + '/fra1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    expect(store.locations()).toEqual([]);
    expect(store.saving()).toBeFalse();
    expect(store.deleting()).toBeFalse();
  });

  it('clears previous project data and does not append a late save to another project', () => {
    load();
    store.create('project-a', { ...dto, name: 'fra1' }).subscribe();
    const create = http.expectOne(collection);
    store.load('project-b').subscribe();
    http.expectOne('https://api.example/project/project-b/locations').flush([]);
    create.flush(location);
    expect(store.locations()).toEqual([]);
  });

  it('surfaces server validation errors and resets saving state', () => {
    load();
    store.create('project-a', { ...dto, name: 'fra1' }).subscribe({ error: () => {} });
    http.expectOne(collection).flush({ error: 'Location already exists' }, { status: 409, statusText: 'Conflict' });
    expect(store.error()).toBe('Location already exists');
    expect(store.saving()).toBeFalse();
    expect(store.locations()).toEqual([]);
  });

  it('URL-encodes the project and location identifiers', () => {
    store.update('project/a', 'location/a', dto).subscribe();
    const request = http.expectOne('https://api.example/project/project%2Fa/locations/location%2Fa');
    expect(request.request.method).toBe('PATCH');
    request.flush(location);
  });
});