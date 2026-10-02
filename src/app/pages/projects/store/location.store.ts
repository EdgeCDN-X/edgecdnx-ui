import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { catchError, finalize, Observable, tap, throwError } from 'rxjs';
import { ConfigService } from '../../../config/config.store';
import { CreateLocationDto, ProjectLocation, UpdateLocationDto } from './location.types';

@Injectable({ providedIn: 'root' })
export class LocationStore {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly oauth = inject(OAuthService);
  private projectId = '';
  readonly locations = signal<ProjectLocation[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly error = signal<string | null>(null);

  load(projectId: string): Observable<ProjectLocation[]> {
    if (this.projectId !== projectId) this.locations.set([]);
    this.projectId = projectId;
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<ProjectLocation[]>(this.url(projectId), { headers: this.headers() }).pipe(
      tap((items) => this.locations.set(items)),
      catchError((error: HttpErrorResponse) => this.fail(error)),
      finalize(() => this.loading.set(false)),
    );
  }

  create(projectId: string, dto: CreateLocationDto): Observable<ProjectLocation> {
    this.saving.set(true);
    this.error.set(null);
    return this.http.post<ProjectLocation>(this.url(projectId), dto, { headers: this.headers() }).pipe(
      tap((created) => {
        if (this.projectId === projectId) this.locations.update((items) => [...items, created]);
      }),
      catchError((error: HttpErrorResponse) => this.fail(error)),
      finalize(() => this.saving.set(false)),
    );
  }

  update(projectId: string, name: string, dto: UpdateLocationDto): Observable<ProjectLocation> {
    this.saving.set(true);
    this.error.set(null);
    return this.http.patch<ProjectLocation>(this.url(projectId, name), dto, { headers: this.headers() }).pipe(
      tap((updated) => {
        if (this.projectId === projectId) {
          this.locations.update((items) => items.map((item) => item.metadata.name === name ? updated : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.fail(error)),
      finalize(() => this.saving.set(false)),
    );
  }

  delete(projectId: string, name: string): Observable<void> {
    this.deleting.set(true);
    this.error.set(null);
    return this.http.delete<void>(this.url(projectId, name), { headers: this.headers() }).pipe(
      tap(() => {
        if (this.projectId === projectId) this.locations.update((items) => items.filter((item) => item.metadata.name !== name));
      }),
      catchError((error: HttpErrorResponse) => this.fail(error)),
      finalize(() => this.deleting.set(false)),
    );
  }

  private url(projectId: string, name?: string): string {
    const collection = `${this.config.environment()?.apiUrl}/project/${encodeURIComponent(projectId)}/locations`;
    return name === undefined ? collection : `${collection}/${encodeURIComponent(name)}`;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.oauth.getAccessToken()}` });
  }

  private fail(error: HttpErrorResponse): Observable<never> {
    const body = error.error as { error?: string; message?: string } | null;
    this.error.set(body?.error ?? body?.message ?? 'Location request failed.');
    return throwError(() => error);
  }
}