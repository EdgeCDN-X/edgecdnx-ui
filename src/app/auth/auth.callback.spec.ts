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
  for (const state of [encodeURIComponent('/projects/demo?label=region%3Deu'), '']) {
    it(`releases the route guard and redirects with ${state ? 'saved' : 'empty'} state`, async () => {
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
      await router.navigateByUrl('/callback?iss=https%3A%2F%2Fauth.example');
      await store.runInitialLoginSequence();
      expect(store.isLoaded()).toBeTrue();
      expect(store.isAuthenticated()).toBeTrue();
      expect(router.url).toBe(state ? '/projects/demo?label=region%3Deu' : '/projects');
    });
  }
});
