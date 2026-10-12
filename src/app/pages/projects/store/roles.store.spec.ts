import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OAuthService } from 'angular-oauth2-oidc';
import { ConfigService } from '../../../config/config.store';
import { RolesStore } from './roles.store';
import { CreateRoleDto, ProjectRole } from './roles.types';

describe('RolesStore', () => {
  let store: RolesStore;
  let http: HttpTestingController;
  const collection = 'https://api.example/projects/project-a/roles';
  const dto: CreateRoleDto = {
    name: 'viewer',
    permissions: [{ resource: 'service', action: 'read' }],
  };
  const role: ProjectRole = { ...dto };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        RolesStore,
        { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
        { provide: OAuthService, useValue: { getAccessToken: () => 'test-token' } },
      ],
    });
    store = TestBed.inject(RolesStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads resource types from the API, including the all-resources wildcard', () => {
    store.loadResourceTypes().subscribe();
    const request = http.expectOne('https://api.example/auth/resource-types');
    expect(request.request.method).toBe('GET');
    request.flush(['*', 'healthcheckprofile', 'location', 'prefixlist', 'project', 'service', 'zone']);
    expect(store.resourceTypes()).toContain('*');
    expect(store.loadingResourceTypes()).toBeFalse();
  });

  it('lists, creates, updates, and deletes roles', () => {
    store.load('project-a').subscribe();
    let request = http.expectOne(collection);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBeTruthy();
    request.flush([role]);
    expect(store.roles()).toEqual([role]);

    store.create('project-a', { ...dto, name: 'editor' }).subscribe();
    request = http.expectOne(collection);
    expect(request.request.method).toBe('POST');
    request.flush({ ...role, name: 'editor' });
    expect(store.roles().map((item) => item.name)).toEqual(['viewer', 'editor']);

    const update = { permissions: [{ resource: 'zone', action: 'read' }] };
    store.update('project-a', 'editor', update).subscribe();
    request = http.expectOne(`${collection}/editor`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(update);
    request.flush({ name: 'editor', permissions: update.permissions });
    expect(store.roles()[1].permissions).toEqual(update.permissions);

    store.delete('project-a', 'editor').subscribe();
    request = http.expectOne(`${collection}/editor`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    expect(store.roles()).toEqual([role]);
    expect(store.saving()).toBeFalse();
    expect(store.deleting()).toBeFalse();
  });

  it('encodes project and role identifiers', () => {
    store.update('project/a', 'role/a', { permissions: [{ resource: 'service', action: 'read' }] }).subscribe();
    const request = http.expectOne('https://api.example/projects/project%2Fa/roles/role%2Fa');
    expect(request.request.method).toBe('PUT');
    request.flush({ name: 'role/a', permissions: [{ resource: 'service', action: 'read' }] });
  });

  it('surfaces API errors and resets operation state', () => {
    store.load('project-a').subscribe();
    http.expectOne(collection).flush([]);
    store.create('project-a', dto).subscribe({ error: () => {} });
    http.expectOne(collection).flush({ error: 'Role already exists' }, { status: 409, statusText: 'Conflict' });
    expect(store.error()).toBe('Role already exists');
    expect(store.saving()).toBeFalse();
  });
});
