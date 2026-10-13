import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, tap, throwError } from 'rxjs';
import { ConfigService } from '../../../config/config.store';
import { ApiKey, CreateApiKeyDto, CreatedApiKey, UpdateApiKeyDto } from './apikey.types';

@Injectable()
export class ApiKeyStore {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private projectId = '';
  private loadVersion = 0;

  readonly apiKeys = signal<ApiKey[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly error = signal<string | null>(null);

  load(projectId: string): Observable<ApiKey[]> {
    if (this.projectId !== projectId) this.apiKeys.set([]);
    this.projectId = projectId;
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<ApiKey[]>(this.url(projectId)).pipe(
      tap((keys) => {
        if (version === this.loadVersion) this.apiKeys.set(sortKeys(keys));
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId, version)),
      finalize(() => {
        if (version === this.loadVersion) this.loading.set(false);
      }),
    );
  }

  /** Emits the created key including its one-time token. The token is not kept in the store. */
  create(projectId: string, dto: CreateApiKeyDto): Observable<CreatedApiKey> {
    this.saving.set(true);
    this.error.set(null);
    return this.http.post<CreatedApiKey>(this.url(projectId), dto).pipe(
      tap((created) => {
        if (this.projectId === projectId) {
          this.apiKeys.update((keys) => sortKeys([...keys, withoutToken(created)]));
        }
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
      finalize(() => this.saving.set(false)),
    );
  }

  update(projectId: string, id: string, dto: UpdateApiKeyDto): Observable<ApiKey> {
    this.saving.set(true);
    this.error.set(null);
    return this.http.patch<ApiKey>(this.url(projectId, id), dto).pipe(
      tap((key) => {
        if (this.projectId === projectId) {
          this.apiKeys.update((keys) => keys.map((current) => current.id === id ? key : current));
        }
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
      finalize(() => this.saving.set(false)),
    );
  }

  delete(projectId: string, id: string): Observable<void> {
    this.deleting.set(true);
    this.error.set(null);
    return this.http.delete<void>(this.url(projectId, id)).pipe(
      tap(() => {
        if (this.projectId === projectId) this.apiKeys.update((keys) => keys.filter((key) => key.id !== id));
      }),
      map(() => undefined),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
      finalize(() => this.deleting.set(false)),
    );
  }

  private url(projectId: string, id?: string): string {
    const collection = `${this.config.environment()?.apiUrl}/project/${encodeURIComponent(projectId)}/apikeys`;
    return id === undefined ? collection : `${collection}/${encodeURIComponent(id)}`;
  }

  private fail(error: HttpErrorResponse, projectId: string, version?: number): Observable<never> {
    const body = error.error as { error?: string; message?: string } | null;
    if (this.projectId === projectId && (version === undefined || version === this.loadVersion)) {
      this.error.set(body?.error ?? body?.message ?? 'API key request failed.');
    }
    return throwError(() => error);
  }
}

function withoutToken(created: CreatedApiKey): ApiKey {
  const { token: _token, ...key } = created;
  return key;
}

function sortKeys(keys: ApiKey[]): ApiKey[] {
  return [...keys].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
}
