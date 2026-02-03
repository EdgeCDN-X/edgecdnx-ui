import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, of, switchMap, tap } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const loaded$ = toObservable(authStore.isLoaded);

  return loaded$.pipe(
    filter(loaded => loaded === true),
    switchMap(() => {
      if (authStore.isAuthenticated()) {
        return of(true);
      } else {
        const route = router.createUrlTree(['/signin'], {queryParams: {redirectUrl: state.url}});
        return of(route);
      }
    }),

  )
};
