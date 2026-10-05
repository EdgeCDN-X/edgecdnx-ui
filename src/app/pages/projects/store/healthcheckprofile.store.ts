import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { catchError, finalize, Observable, tap, throwError } from 'rxjs';
import { ConfigService } from '../../../config/config.store';
import { CreateHealthCheckProfileDto, HealthCheckProfile, UpdateHealthCheckProfileDto } from './healthcheckprofile.types';

@Injectable({ providedIn: 'root' })
export class HealthCheckProfileStore {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly oauth = inject(OAuthService);
  private projectId = '';
  private loadVersion = 0;
  readonly profiles = signal<HealthCheckProfile[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly error = signal<string | null>(null);

  load(projectId: string): Observable<HealthCheckProfile[]> {
    if (this.projectId !== projectId) this.profiles.set([]);
    this.projectId = projectId;
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<HealthCheckProfile[]>(this.url(projectId), { headers: this.headers() }).pipe(
      tap((items) => { if (version === this.loadVersion) this.profiles.set(items); }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId, version)),
      finalize(() => { if (version === this.loadVersion) this.loading.set(false); }),
    );
  }

  get(projectId: string, name: string): Observable<HealthCheckProfile> {
    return this.http.get<HealthCheckProfile>(this.url(projectId, name), { headers: this.headers() }).pipe(
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
    );
  }

  create(projectId: string, dto: CreateHealthCheckProfileDto): Observable<HealthCheckProfile> {
    this.saving.set(true);
    this.error.set(null);
    return this.http.post<HealthCheckProfile>(this.url(projectId), dto, { headers: this.headers() }).pipe(
      tap((created) => {
        if (this.projectId === projectId) this.profiles.update((items) => [...items, created]);
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
      finalize(() => this.saving.set(false)),
    );
  }

  update(projectId: string, name: string, dto: UpdateHealthCheckProfileDto): Observable<HealthCheckProfile> {
    this.saving.set(true);
    this.error.set(null);
    return this.http.patch<HealthCheckProfile>(this.url(projectId, name), dto, { headers: this.headers() }).pipe(
      tap((updated) => {
        if (this.projectId === projectId) {
          this.profiles.update((items) => items.map((item) => item.metadata.name === name ? updated : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
      finalize(() => this.saving.set(false)),
    );
  }

  delete(projectId: string, name: string): Observable<void> {
    this.deleting.set(true);
    this.error.set(null);
    return this.http.delete<void>(this.url(projectId, name), { headers: this.headers() }).pipe(
      tap(() => {
        if (this.projectId === projectId) this.profiles.update((items) => items.filter((item) => item.metadata.name !== name));
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
      finalize(() => this.deleting.set(false)),
    );
  }

  private url(projectId: string, name?: string): string {
    const collection = `${this.config.environment()?.apiUrl}/project/${encodeURIComponent(projectId)}/healthcheckprofiles`;
    return name === undefined ? collection : `${collection}/${encodeURIComponent(name)}`;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.oauth.getAccessToken()}` });
  }

  private fail(error: HttpErrorResponse, projectId: string, version?: number): Observable<never> {
    const body = error.error as { error?: string; message?: string } | null;
    if (this.projectId === projectId && (version === undefined || version === this.loadVersion)) {
      this.error.set(body?.error ?? body?.message ?? 'Health check profile request failed.');
    }
    return throwError(() => error);
  }
}
