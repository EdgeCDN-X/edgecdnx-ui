import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from '../../../config/config.store';
import { ApiKeyStore } from './apikey.store';
import { ApiKey, CreatedApiKey } from './apikey.types';

describe('ApiKeyStore', () => {
  let store: ApiKeyStore;
  let http: HttpTestingController;
  const collection = 'https://api.example/project/project-a/apikeys';
  const key: ApiKey = {
    id: 'ak-abc123',
    name: 'ak_abc123',
    displayName: 'CI',
    project: 'project-a',
    roles: ['viewer'],
    expiresAt: '2030-01-01T00:00:00Z',
    createdAt: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiKeyStore,
        { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
      ],
    });
    store = TestBed.inject(ApiKeyStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists, creates, updates, and deletes API keys without retaining the token', () => {
    store.load('project-a').subscribe();
    http.expectOne(collection).flush([key]);
    expect(store.apiKeys()).toEqual([key]);

    let created: CreatedApiKey | undefined;
    store.create('project-a', { displayName: 'Deploy', expiresAt: '2030-01-01T00:00:00.000Z', roles: [] })
      .subscribe((value) => (created = value));
    const createRequest = http.expectOne(collection);
    expect(createRequest.request.method).toBe('POST');
    createRequest.flush({ ...key, id: 'ak-def', name: 'ak_def', displayName: 'Deploy', roles: [], token: 'ak_def_secret' });
    expect(created?.token).toBe('ak_def_secret');
    expect(store.apiKeys().map((k) => k.displayName)).toEqual(['CI', 'Deploy']);
    expect(store.apiKeys().some((k) => 'token' in k)).toBeFalse();

    store.update('project-a', 'ak-abc123', { roles: ['admin'] }).subscribe();
    const patch = http.expectOne(`${collection}/ak-abc123`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ roles: ['admin'] });
    patch.flush({ ...key, roles: ['admin'] });
    expect(store.apiKeys().find((k) => k.id === 'ak-abc123')?.roles).toEqual(['admin']);

    store.delete('project-a', 'ak-def').subscribe();
    const del = http.expectOne(`${collection}/ak-def`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    expect(store.apiKeys().map((k) => k.id)).toEqual(['ak-abc123']);
  });

  it('exposes API error messages', () => {
    store.load('project-a').subscribe({ error: () => {} });
    http.expectOne(collection).flush({ error: 'forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect(store.error()).toBe('forbidden');
    expect(store.loading()).toBeFalse();
  });
});
