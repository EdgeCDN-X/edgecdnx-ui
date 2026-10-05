import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { catchError, EMPTY, finalize, interval, Observable, startWith, switchMap, tap } from 'rxjs';
import { ConfigService } from '../../../config/config.store';
import { LocationHealthchecks } from './location-healthcheck.types';

export const HEALTHCHECK_POLL_INTERVAL_MS = 30_000;
export const HEALTHCHECK_BAR_LIMIT = 60;

@Injectable()
export class LocationHealthcheckStore {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly oauth = inject(OAuthService);
  private key = '';
  readonly healthchecks = signal<LocationHealthchecks | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<Date | null>(null);

  load(projectId: string, locationName: string): Observable<LocationHealthchecks> {
    const key = `${projectId}/${locationName}`;
    if (this.key !== key) {
      this.healthchecks.set(null);
      this.lastUpdated.set(null);
    }
    this.key = key;
    this.loading.set(true);
    const params = new HttpParams().set('limit', HEALTHCHECK_BAR_LIMIT);
    return this.http.get<LocationHealthchecks>(this.url(projectId, locationName), { headers: this.headers(), params }).pipe(
      tap((data) => {
        this.healthchecks.set(data);
        this.lastUpdated.set(new Date());
        this.error.set(null);
      }),
      catchError((error: HttpErrorResponse) => {
        const body = error.error as { error?: string; message?: string } | null;
        this.error.set(body?.error ?? body?.message ?? 'Unable to load healthchecks.');
        throw error;
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  /** Loads immediately and then every 30 seconds. A failed poll keeps the previous data and retries on the next tick. */
  poll(projectId: string, locationName: string, intervalMs = HEALTHCHECK_POLL_INTERVAL_MS): Observable<LocationHealthchecks> {
    return interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.load(projectId, locationName).pipe(catchError(() => EMPTY))),
    );
  }

  private url(projectId: string, locationName: string): string {
    return `${this.config.environment()?.apiUrl}/project/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(locationName)}/healthchecks`;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.oauth.getAccessToken()}` });
  }
}
