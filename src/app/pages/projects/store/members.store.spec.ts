import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OAuthService } from 'angular-oauth2-oidc';
import { ConfigService } from '../../../config/config.store';
import { MembersStore } from './members.store';

describe('MembersStore', () => {
  let store: MembersStore;
  let http: HttpTestingController;
  const base = 'https://api.example/projects/project-a';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MembersStore,
        { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
        { provide: OAuthService, useValue: { getAccessToken: () => 'test-token' } },
      ],
    });
    store = TestBed.inject(MembersStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads members and roles, assigns and removes bindings', () => {
    store.load('project-a').subscribe();
    const membersRequest = http.expectOne(`${base}/members`);
    expect(membersRequest.request.headers.get('Authorization')).toBeTruthy();
    membersRequest.flush([{ user: 'bob@example.com', role: 'viewer' }]);
    http.expectOne(`${base}/roles`).flush([{ name: 'admin', permissions: [] }, { name: 'viewer', permissions: [] }]);
    expect(store.members()).toEqual([{ user: 'bob@example.com', role: 'viewer' }]);
    expect(store.roles()).toEqual(['admin', 'viewer']);
    expect(store.loading()).toBeFalse();

    store.assign('project-a', { user: 'new@example.com', role: 'admin' }).subscribe();
    let request = http.expectOne(`${base}/members`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ user: 'new@example.com', role: 'admin' });
    request.flush({ user: 'new@example.com', role: 'admin' });
    expect(store.members().length).toBe(2);

    store.remove('project-a', { user: 'new@example.com', role: 'admin' }).subscribe();
    request = http.expectOne(`${base}/members/new%40example.com/roles/admin`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    expect(store.members()).toEqual([{ user: 'bob@example.com', role: 'viewer' }]);
    expect(store.saving()).toBeFalse();
    expect(store.removing()).toBeFalse();
  });

  it('surfaces API errors', () => {
    store.load('project-a').subscribe();
    http.expectOne(`${base}/members`).flush([]);
    http.expectOne(`${base}/roles`).flush([]);
    store.remove('project-a', { user: 'a@example.com', role: 'admin' }).subscribe({ error: () => {} });
    http.expectOne(`${base}/members/a%40example.com/roles/admin`)
      .flush({ error: 'cannot remove the last admin of the project' }, { status: 409, statusText: 'Conflict' });
    expect(store.error()).toBe('cannot remove the last admin of the project');
    expect(store.removing()).toBeFalse();
  });
});
