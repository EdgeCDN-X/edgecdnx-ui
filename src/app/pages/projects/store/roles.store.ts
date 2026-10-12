import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { catchError, finalize, Observable, tap, throwError } from 'rxjs';
import { ConfigService } from '../../../config/config.store';
import { CreateRoleDto, ProjectRole, UpdateRoleDto } from './roles.types';

@Injectable()
export class RolesStore {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly oauth = inject(OAuthService);
  private projectId = '';
  private loadVersion = 0;

  readonly roles = signal<ProjectRole[]>([]);
  readonly resourceTypes = signal<string[]>([]);
  readonly loadingResourceTypes = signal(false);
  readonly resourceTypesError = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly error = signal<string | null>(null);

  loadResourceTypes(): Observable<string[]> {
    this.loadingResourceTypes.set(true);
    this.resourceTypesError.set(null);
    return this.http.get<string[]>(`${this.config.environment()?.apiUrl}/auth/resource-types`, {
      headers: this.headers(),
    }).pipe(
      tap((types) => this.resourceTypes.set(types)),
      catchError((error: HttpErrorResponse) => {
        const body = error.error as { error?: string; message?: string } | null;
        this.resourceTypesError.set(body?.error ?? body?.message ?? 'Failed to load resource types.');
        return throwError(() => error);
      }),
      finalize(() => this.loadingResourceTypes.set(false)),
    );
  }

  load(projectId: string): Observable<ProjectRole[]> {
    if (this.projectId !== projectId) this.roles.set([]);
    this.projectId = projectId;
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<ProjectRole[]>(this.url(projectId), { headers: this.headers() }).pipe(
      tap((roles) => {
        if (version === this.loadVersion) this.roles.set(roles);
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId, version)),
      finalize(() => {
        if (version === this.loadVersion) this.loading.set(false);
      }),
    );
  }

  create(projectId: string, dto: CreateRoleDto): Observable<ProjectRole> {
    this.saving.set(true);
    this.error.set(null);
    return this.http.post<ProjectRole>(this.url(projectId), dto, { headers: this.headers() }).pipe(
      tap((role) => {
        if (this.projectId === projectId) this.roles.update((roles) => [...roles, role]);
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
      finalize(() => this.saving.set(false)),
    );
  }

  update(projectId: string, name: string, dto: UpdateRoleDto): Observable<ProjectRole> {
    this.saving.set(true);
    this.error.set(null);
    return this.http.put<ProjectRole>(this.url(projectId, name), dto, { headers: this.headers() }).pipe(
      tap((role) => {
        if (this.projectId === projectId) {
          this.roles.update((roles) => roles.map((current) => current.name === name ? role : current));
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
        if (this.projectId === projectId) this.roles.update((roles) => roles.filter((role) => role.name !== name));
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
      finalize(() => this.deleting.set(false)),
    );
  }

  private url(projectId: string, roleName?: string): string {
    const collection = `${this.config.environment()?.apiUrl}/projects/${encodeURIComponent(projectId)}/roles`;
    return roleName === undefined ? collection : `${collection}/${encodeURIComponent(roleName)}`;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.oauth.getAccessToken()}` });
  }

  private fail(error: HttpErrorResponse, projectId: string, version?: number): Observable<never> {
    const body = error.error as { error?: string; message?: string } | null;
    if (this.projectId === projectId && (version === undefined || version === this.loadVersion)) {
      this.error.set(body?.error ?? body?.message ?? 'Role request failed.');
    }
    return throwError(() => error);
  }
}
