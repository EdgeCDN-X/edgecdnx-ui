import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { OAuthErrorEvent, OAuthInfoEvent, OAuthService, OAuthSuccessEvent, OAuthEvent } from 'angular-oauth2-oidc';
import { Subject } from 'rxjs';
import { ConfigService } from '../config/config.store';
import { AuthStore } from './auth.store';

describe('AuthStore session recovery', () => {
  let store: AuthStore;
  let events: Subject<OAuthEvent>;
  let oauth: jasmine.SpyObj<OAuthService>;
  let router: jasmine.SpyObj<Router>;
  let valid: boolean;
  const tokenResponse = {
    access_token: 'access-token', id_token: 'id-token', token_type: 'Bearer',
    expires_in: 300, refresh_token: 'refresh-token', scope: 'openid offline_access',
  };

  beforeEach(() => {
    events = new Subject<OAuthEvent>();
    valid = true;
    oauth = jasmine.createSpyObj<OAuthService>('OAuthService', [
      'configure', 'hasValidAccessToken', 'getIdentityClaims', 'getAccessToken',
      'getAccessTokenExpiration', 'getRefreshToken', 'refreshToken', 'logOut',
      'loadDiscoveryDocumentAndTryLogin', 'loadUserProfile', 'initCodeFlow',
    ], { events: events.asObservable() });
    oauth.hasValidAccessToken.and.callFake(() => valid);
    oauth.getIdentityClaims.and.returnValue({ sub: 'user' });
    oauth.getAccessToken.and.returnValue('access-token');
    oauth.getAccessTokenExpiration.and.returnValue(Date.now() + 300_000);
    oauth.getRefreshToken.and.returnValue('refresh-token');
    oauth.refreshToken.and.resolveTo(tokenResponse);
    oauth.loadDiscoveryDocumentAndTryLogin.and.resolveTo(true);
    oauth.loadUserProfile.and.resolveTo({});
    oauth.logOut.and.callFake(() => {
      valid = false;
      events.next(new OAuthInfoEvent('logout'));
    });

    router = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl'], {
      url: '/projects/demo/locations?label=region%3Deu',
    });
    router.navigate.and.resolveTo(true);
    router.navigateByUrl.and.resolveTo(true);
    spyOn(console, 'error');
    TestBed.configureTestingModule({ providers: [
      AuthStore,
      { provide: OAuthService, useValue: oauth },
      { provide: Router, useValue: router },
      { provide: ConfigService, useValue: { environment: () => null } },
    ] });
    store = TestBed.inject(AuthStore);
  });

  it('shares a single renewal between concurrent callers', fakeAsync(() => {
    const first = store.refreshAccessToken();
    const second = store.refreshAccessToken();
    expect(first).toBe(second);
    flushMicrotasks();
    expect(oauth.refreshToken).toHaveBeenCalledTimes(1);
    expect(store.isAuthenticated()).toBeTrue();
  }));

  it('renews on access-token expiry events but not ID-token events', fakeAsync(() => {
    void store.runInitialLoginSequence();
    flushMicrotasks();
    events.next(new OAuthInfoEvent('token_expires', 'id_token'));
    flushMicrotasks();
    expect(oauth.refreshToken).not.toHaveBeenCalled();
    events.next(new OAuthInfoEvent('token_expires', 'access_token'));
    flushMicrotasks();
    expect(oauth.refreshToken).toHaveBeenCalledTimes(1);
  }));

  it('clears failed sessions and preserves the current route, only once', fakeAsync(() => {
    oauth.refreshToken.and.rejectWith(new Error('invalid_grant'));
    let failure: unknown;
    void store.refreshAccessToken().catch(error => { failure = error; });
    flushMicrotasks();
    expect(failure).toEqual(jasmine.any(Error));
    expect(store.isAuthenticated()).toBeFalse();
    expect(store.userInfo()).toEqual({});
    expect(oauth.logOut).toHaveBeenCalledTimes(1);
    expect(oauth.logOut.calls.mostRecent().args).toEqual([true]);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/signin'], {
      queryParams: { redirectUrl: '/projects/demo/locations?label=region%3Deu' },
    });
    store.expireSession();
    expect(router.navigate).toHaveBeenCalledTimes(1);
  }));

  it('requires sign-in when no refresh token was issued', fakeAsync(() => {
    oauth.getRefreshToken.and.returnValue('');
    void store.refreshAccessToken().catch(() => {});
    flushMicrotasks();
    expect(oauth.refreshToken).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalled();
  }));

  it('rechecks expiry on tab focus', fakeAsync(() => {
    void store.runInitialLoginSequence();
    flushMicrotasks();
    valid = false;
    oauth.refreshToken.and.callFake(async () => { valid = true; return tokenResponse; });
    window.dispatchEvent(new Event('focus'));
    flushMicrotasks();
    expect(oauth.refreshToken).toHaveBeenCalledTimes(1);
    expect(store.isAuthenticated()).toBeTrue();
  }));

  it('releases guards and redirects after discovery fails', fakeAsync(() => {
    oauth.loadDiscoveryDocumentAndTryLogin.and.rejectWith(new Error('discovery unavailable'));
    void store.runInitialLoginSequence();
    flushMicrotasks();
    expect(store.isLoaded()).toBeTrue();
    expect(store.isAuthenticated()).toBeFalse();
    expect(router.navigate).toHaveBeenCalled();
  }));

  it('recovers an expired stored access token during initialization', fakeAsync(() => {
    valid = false;
    oauth.refreshToken.and.callFake(async () => { valid = true; return tokenResponse; });
    void store.runInitialLoginSequence();
    flushMicrotasks();
    expect(oauth.refreshToken).toHaveBeenCalledTimes(1);
    expect(store.isLoaded()).toBeTrue();
    expect(store.isAuthenticated()).toBeTrue();
  }));

  it('does not lose renewal events while discovery is in progress', fakeAsync(() => {
    oauth.loadDiscoveryDocumentAndTryLogin.and.callFake(async () => {
      events.next(new OAuthInfoEvent('token_expires', 'access_token'));
      return true;
    });
    void store.runInitialLoginSequence();
    flushMicrotasks();
    expect(oauth.refreshToken).toHaveBeenCalledTimes(1);
    expect(store.isLoaded()).toBeTrue();
  }));

  it('does not redirect in a loop when already on sign-in', fakeAsync(() => {
    Object.defineProperty(router, 'url', { value: '/signin?redirectUrl=%2Fprojects' });
    store.expireSession();
    flushMicrotasks();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(oauth.logOut.calls.mostRecent().args).toEqual([true]);
  }));

  it('preserves explicit provider logout', () => {
    store.logout();
    expect(oauth.logOut.calls.mostRecent().args).toEqual([]);
    expect(store.isAuthenticated()).toBeFalse();
  });

  it('handles terminal renewal events and prevents late tokens resurrecting the session', fakeAsync(() => {
    void store.runInitialLoginSequence();
    flushMicrotasks();
    events.next(new OAuthErrorEvent('token_refresh_error', new Error('invalid_grant')));
    events.next(new OAuthSuccessEvent('token_received'));
    flushMicrotasks();
    expect(store.isAuthenticated()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledTimes(1);
  }));
});
