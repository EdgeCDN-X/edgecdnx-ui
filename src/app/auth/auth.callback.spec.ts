import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { OAuthEvent, OAuthService } from 'angular-oauth2-oidc';
import { Subject } from 'rxjs';
import { ConfigService } from '../config/config.store';
import { authGuard } from './auth.guard';
import { AuthStore } from './auth.store';

@Component({ template: '' })
class LoginDestination {}

describe('OIDC callback navigation', () => {
  let originalUrl: string;
  beforeEach(() => { originalUrl = window.location.href; });
  afterEach(() => { window.history.replaceState(null, '', originalUrl); });

  const deepLink = '/projects/demo?label=region%3Deu&label=tier%3Dedge#locations';
  const cases = [
    { url: '/callback?iss=https%3A%2F%2Fauth.example', state: encodeURIComponent(deepLink), expected: deepLink },
    { url: '/callback?iss=https%3A%2F%2Fauth.example', state: '', expected: '/projects' },
    { url: deepLink, state: '', expected: deepLink },
    { url: deepLink, state: encodeURIComponent('/projects'), expected: deepLink },
  ];
  for (const { url, state, expected } of cases) {
    it(`preserves reload URLs and redirects only callbacks: ${url} with ${state ? 'saved' : 'empty'} state`, async () => {
      window.history.replaceState(null, '', url);
      const events = new Subject<OAuthEvent>();
      const oauth = jasmine.createSpyObj<OAuthService>('OAuthService', [
        'configure', 'loadDiscoveryDocumentAndTryLogin', 'hasValidAccessToken',
        'getIdentityClaims', 'getAccessToken', 'getRefreshToken', 'loadUserProfile',
      ], {
        events: events.asObservable(),
        state,
      });
      oauth.loadDiscoveryDocumentAndTryLogin.and.resolveTo(true);
      oauth.hasValidAccessToken.and.returnValue(true);
      oauth.getIdentityClaims.and.returnValue({ sub: 'user' });
      TestBed.configureTestingModule({ providers: [
        provideRouter([
          { path: 'callback', component: LoginDestination },
          { path: 'projects', component: LoginDestination, canActivate: [authGuard] },
          { path: 'projects/:name', component: LoginDestination, canActivate: [authGuard] },
        ]),
        { provide: OAuthService, useValue: oauth },
        { provide: ConfigService, useValue: { environment: () => null } },
      ] });
      const router = TestBed.inject(Router);
      const store = TestBed.inject(AuthStore);
      const initialNavigation = router.navigateByUrl(url);
      await store.runInitialLoginSequence();
      await initialNavigation;
      expect(store.isLoaded()).toBeTrue();
      expect(store.isAuthenticated()).toBeTrue();
      expect(router.url).toBe(expected);
    });
  }
});
