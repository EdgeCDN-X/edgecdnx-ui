import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideOAuthClient } from 'angular-oauth2-oidc';
import { routes } from './app.routes';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth/auth.interceptor';
import { tap } from 'rxjs';
import { Environment, ConfigService } from './config/config.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
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
  ],
};
