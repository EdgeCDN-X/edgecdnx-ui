import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { catchError, defer, from, switchMap, throwError } from 'rxjs';
import { ConfigService } from '../config/config.store';
import { AuthStore } from './auth.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const apiUrl = inject(ConfigService).environment()?.apiUrl;
  if (!apiUrl) {
    return next(request);
  }
  const api = new URL(apiUrl, window.location.origin);
  const url = new URL(request.url, window.location.origin);
  const apiPath = api.pathname.replace(/\/+$/, '');
  if (url.origin !== api.origin ||
      (url.pathname !== apiPath && !url.pathname.startsWith(apiPath + '/'))) {
    return next(request);
  }

  const oauth = inject(OAuthService);
  // OIDC requests must bypass this interceptor, including discovery and renewal.
  const oidcEndpoints = [oauth.tokenEndpoint, oauth.userinfoEndpoint, oauth.loginUrl, oauth.logoutUrl];
  if (oidcEndpoints.some(endpoint => endpoint &&
      new URL(endpoint, window.location.origin).href === url.href)) {
    return next(request);
  }
  const auth = inject(AuthStore);
  const withToken = () => request.clone({
    setHeaders: { Authorization: `Bearer ${oauth.getAccessToken()}` },
  });
  const renew = () => from(auth.refreshAccessToken()).pipe(
    catchError(() => throwError(() => new HttpErrorResponse({
      status: 401,
      statusText: 'Unauthorized',
      url: request.url,
      error: { message: 'Your session has expired. Please sign in again.' },
    }))),
  );

  return defer(() => oauth.hasValidAccessToken()
    ? Promise.resolve()
    : renew()).pipe(
    switchMap(() => {
      const sentToken = oauth.getAccessToken();
      return next(withToken()).pipe(
        catchError(error => {
          if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
            return throwError(() => error);
          }
          // Another request may already have renewed the rejected token.
          const renewed = oauth.hasValidAccessToken() && oauth.getAccessToken() !== sentToken;
          return (renewed ? from(Promise.resolve()) : renew()).pipe(
            switchMap(() => next(withToken()).pipe(
              catchError(retryError => {
                if (retryError instanceof HttpErrorResponse && retryError.status === 401) {
                  auth.expireSession();
                }
                return throwError(() => retryError);
              }),
            )),
          );
        }),
      );
    }),
  );
};
