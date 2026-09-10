import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { catchError, finalize, Observable, tap, throwError } from 'rxjs';
import { ConfigService } from '../../../config/config.store';
import {
  CreateDNSEndpointDto,
  DNSEndpoint,
  DNSEndpointActionError,
  UpdateDNSEndpointDto,
} from './dns-endpoint.types';

@Injectable({ providedIn: 'root' })
export class DNSEndpointStore {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);
  private readonly oauthService = inject(OAuthService);

  private readonly _dnsEndpoints = signal<DNSEndpoint[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _deleting = signal(false);
  private readonly _error = signal<DNSEndpointActionError | null>(null);

  readonly dnsEndpoints = this._dnsEndpoints.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly deleting = this._deleting.asReadonly();
  readonly error = this._error.asReadonly();

  load(projectId: string, zoneName: string): void {
    this._loading.set(true);
    this._error.set(null);

    this.http
      .get<DNSEndpoint[]>(this.collectionUrl(projectId, zoneName), { headers: this.headers() })
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (dnsEndpoints) => this._dnsEndpoints.set(dnsEndpoints),
        error: (error: HttpErrorResponse) => this.setError('list', error),
      });
  }

  create(
    projectId: string,
    zoneName: string,
    dto: CreateDNSEndpointDto,
  ): Observable<DNSEndpoint> {
    this._saving.set(true);
    this._error.set(null);

    return this.http
      .post<DNSEndpoint>(this.collectionUrl(projectId, zoneName), dto, {
        headers: this.headers(),
      })
      .pipe(
        tap((created) => this._dnsEndpoints.update((items) => [...items, created])),
        catchError((error: HttpErrorResponse) => this.handleError('create', error)),
        finalize(() => this._saving.set(false)),
      );
  }

  update(
    projectId: string,
    zoneName: string,
    dnsEndpointId: string,
    dto: UpdateDNSEndpointDto,
  ): Observable<DNSEndpoint> {
    this._saving.set(true);
    this._error.set(null);

    return this.http
      .patch<DNSEndpoint>(this.itemUrl(projectId, zoneName, dnsEndpointId), dto, {
        headers: this.headers(),
      })
      .pipe(
        tap((updated) =>
          this._dnsEndpoints.update((items) =>
            items.map((item) => (item.metadata.name === updated.metadata.name ? updated : item)),
          ),
        ),
        catchError((error: HttpErrorResponse) => this.handleError('update', error)),
        finalize(() => this._saving.set(false)),
      );
  }

  delete(projectId: string, zoneName: string, dnsEndpointId: string): Observable<void> {
    this._deleting.set(true);
    this._error.set(null);

    return this.http
      .delete<void>(this.itemUrl(projectId, zoneName, dnsEndpointId), { headers: this.headers() })
      .pipe(
        tap(() =>
          this._dnsEndpoints.update((items) =>
            items.filter((item) => item.metadata.name !== dnsEndpointId),
          ),
        ),
        catchError((error: HttpErrorResponse) => this.handleError('delete', error)),
        finalize(() => this._deleting.set(false)),
      );
  }

  clearError(): void {
    this._error.set(null);
  }

  private collectionUrl(projectId: string, zoneName: string): string {
    const apiUrl = this.configService.environment()?.apiUrl;
    return `${apiUrl}/project/${encodeURIComponent(projectId)}/zones/${encodeURIComponent(zoneName)}/dns-endpoints`;
  }

  private itemUrl(projectId: string, zoneName: string, dnsEndpointId: string): string {
    return `${this.collectionUrl(projectId, zoneName)}/${encodeURIComponent(dnsEndpointId)}`;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.oauthService.getAccessToken()}` });
  }

  private handleError(
    action: DNSEndpointActionError['action'],
    error: HttpErrorResponse,
  ): Observable<never> {
    this.setError(action, error);
    return throwError(() => error);
  }

  private setError(action: DNSEndpointActionError['action'], error: HttpErrorResponse): void {
    const body = error.error as { error?: string; message?: string } | null;
    this._error.set({
      action,
      message: body?.error ?? body?.message ?? `Failed to ${action} DNS endpoint`,
    });
  }
}
