import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, of, switchMap } from 'rxjs';
import { AuthStore } from './auth.store';

export const adminGuard: CanActivateFn = (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return toObservable(authStore.isLoaded).pipe(
    filter((loaded) => loaded === true),
    switchMap(() => {
      if (!authStore.isAuthenticated()) {
        return of(router.createUrlTree(['/signin'], { queryParams: { redirectUrl: state.url } }));
      }

      return of(authStore.isAdmin()).pipe(
        map((isAdmin) => (isAdmin ? true : router.createUrlTree(['/dashboard'])))
      );
    })
  );
};
