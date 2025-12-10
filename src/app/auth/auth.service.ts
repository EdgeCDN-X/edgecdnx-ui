import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { BehaviorSubject, Observable } from 'rxjs';
import { authConfig } from './auth.config';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isAuthenticatedSubject$ = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject$.asObservable();

  constructor(private oauthService: OAuthService, private router: Router) {
    this.configureOAuth();
  }

  private async configureOAuth(): Promise<void> {
    this.oauthService.configure(authConfig);
    this.oauthService.loadDiscoveryDocumentAndTryLogin().then(() => {
      if (this.oauthService.hasValidAccessToken()) {
        this.isAuthenticatedSubject$.next(true);
      }
    });

    // Listen to token events
    this.oauthService.events.subscribe((event) => {
      if (event.type === 'token_received' || event.type === 'token_refreshed') {
        this.isAuthenticatedSubject$.next(true);
      } else if (event.type === 'logout' || event.type === 'session_terminated') {
        this.isAuthenticatedSubject$.next(false);
      }
    });
  }

  public login(): void {
    this.oauthService.initCodeFlow();
  }

  public logout(): void {
    this.oauthService.logOut();
    this.isAuthenticatedSubject$.next(false);
    this.router.navigate(['/login']);
  }

  public getAccessToken(): string | null {
    return this.oauthService.getAccessToken();
  }

  public getIdToken(): string | null {
    return this.oauthService.getIdToken();
  }

  public getIdentityClaims(): any {
    return this.oauthService.getIdentityClaims();
  }

  public hasValidAccessToken(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  public async checkAuth(): Promise<boolean> {
    const hasValidToken = this.oauthService.hasValidAccessToken();
    this.isAuthenticatedSubject$.next(hasValidToken);
    return hasValidToken;
  }
}
