import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { OAuthService } from 'angular-oauth2-oidc';
import { ConfigService } from '../config/config.store';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from './auth.store';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let auth: jasmine.SpyObj<AuthStore>;
  let token: string;
  let valid: boolean;
  const endpoint = 'https://api.example/api/projects';

  beforeEach(() => {
    token = 'old-token';
    valid = true;
    auth = jasmine.createSpyObj<AuthStore>('AuthStore', ['refreshAccessToken', 'expireSession']);
    auth.refreshAccessToken.and.callFake(async () => { token = 'new-token'; valid = true; });
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthStore, useValue: auth },
      { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example/api' }) } },
      { provide: OAuthService, useValue: {
        getAccessToken: () => token, hasValidAccessToken: () => valid,
        tokenEndpoint: 'https://api.example/api/token',
      } },
    ] });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('refreshes expired tokens before sending an API request', fakeAsync(() => {
    valid = false;
    client.get(endpoint, { headers: { Authorization: 'Bearer stale-token' } }).subscribe();
    flushMicrotasks();
    const request = http.expectOne(endpoint);
    expect(request.request.headers.get('Authorization')).toBe('Bearer new-token');
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    request.flush([]);
  }));

  it('renews and retries a 401 exactly once, then expires the session', fakeAsync(() => {
    let failure: HttpErrorResponse | undefined;
    client.get(endpoint).subscribe({ error: error => { failure = error; } });
    flushMicrotasks();
    http.expectOne(endpoint).flush(null, { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();
    const retry = http.expectOne(endpoint);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(auth.expireSession).toHaveBeenCalledTimes(1);
    expect(failure?.status).toBe(401);
  }));

  it('reuses a token renewed while an older request was in flight', fakeAsync(() => {
    client.get(endpoint).subscribe();
    flushMicrotasks();
    const first = http.expectOne(endpoint);
    token = 'new-token';
    first.flush(null, { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();
    const retry = http.expectOne(endpoint);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush([]);
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
  }));

  it('preserves request body, parameters and headers when retrying successfully', fakeAsync(() => {
    const body = { name: 'project-a' };
    let result: unknown;
    client.post(endpoint, body, {
      params: { dryRun: 'true' }, headers: { 'X-Request-ID': 'test-request' },
    }).subscribe(value => { result = value; });
    flushMicrotasks();
    http.expectOne(endpoint + '?dryRun=true').flush(null, { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();
    const retry = http.expectOne(endpoint + '?dryRun=true');
    expect(retry.request.method).toBe('POST');
    expect(retry.request.body).toEqual(body);
    expect(retry.request.headers.get('X-Request-ID')).toBe('test-request');
    retry.flush({ name: 'project-a' });
    expect(result).toEqual(body);
    expect(auth.expireSession).not.toHaveBeenCalled();
  }));

  it('propagates renewal failures without retrying the API request', fakeAsync(() => {
    const failure = new Error('invalid_grant');
    auth.refreshAccessToken.and.rejectWith(failure);
    let received: HttpErrorResponse | undefined;
    client.get(endpoint).subscribe({ error: error => { received = error; } });
    flushMicrotasks();
    http.expectOne(endpoint).flush(null, { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();
    http.expectNone(endpoint);
    expect(received instanceof HttpErrorResponse).toBeTrue();
    expect(received?.status).toBe(401);
    expect(received?.error.message).toBe('Your session has expired. Please sign in again.');
  }));

  it('keeps pre-request renewal errors compatible with existing HTTP error handlers', fakeAsync(() => {
    valid = false;
    auth.refreshAccessToken.and.rejectWith(new Error('No refresh token'));
    let received: HttpErrorResponse | undefined;
    client.get(endpoint).subscribe({ error: error => { received = error; } });
    flushMicrotasks();
    http.expectNone(endpoint);
    expect(received?.status).toBe(401);
    expect(received?.error.message).toBe('Your session has expired. Please sign in again.');
  }));

  it('does not renew or redirect for forbidden responses', fakeAsync(() => {
    client.get(endpoint).subscribe({ error: () => {} });
    flushMicrotasks();
    http.expectOne(endpoint).flush(null, { status: 403, statusText: 'Forbidden' });
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(auth.expireSession).not.toHaveBeenCalled();
  }));

  it('excludes OIDC, config, foreign origins and lookalike API paths', () => {
    for (const url of [
      'https://api.example/api/token', 'config/config.json',
      'https://api.example.evil/api/projects', 'https://api.example/api-other/projects',
    ]) {
      client.get(url).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBeFalse();
      request.flush({});
    }
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
  });
});
