import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from './auth.config';

export const authGuard: CanActivateFn = async (route, state) => {
  const oauthService = inject(OAuthService);
  oauthService.configure(authConfig);
  await oauthService.loadDiscoveryDocumentAndLogin();
  if (!oauthService.hasValidAccessToken()) {
    console.log('auth guard, no valid access token');
    return false;
  }
  console.log('auth guard, valid access token');
  return true;
};
