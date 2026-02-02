import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { AuthStore } from './auth.store';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, switchMap, tap } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);

  const loaded$ = toObservable(authStore.isLoaded);
  const isAuthenticated$ = toObservable(authStore.isAuthenticated);

  return loaded$.pipe(
    filter(loaded => loaded === true),
    switchMap(() => isAuthenticated$),
    tap(isAuthenticated => isAuthenticated || 'Unauthorized')
  )
};
