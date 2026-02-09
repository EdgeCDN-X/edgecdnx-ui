import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { DefaultOAuthInterceptor, provideOAuthClient } from 'angular-oauth2-oidc';
import { routes } from './app.routes';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { tap } from 'rxjs';
import { Environment, ConfigService } from './config/config.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptorsFromDi()),
    provideAppInitializer(() => {
      const http = inject(HttpClient);
      const configService = inject(ConfigService);

      return http.get<Environment>('config/config.json').pipe(
        tap(config => {
          configService.setConfig(config);
        })
      )
    }),
    provideRouter(routes),
    provideOAuthClient(),
    { provide: HTTP_INTERCEPTORS, useClass: DefaultOAuthInterceptor, multi: true },
  ],
};
