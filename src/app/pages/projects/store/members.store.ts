import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { catchError, finalize, forkJoin, map, Observable, tap, throwError } from 'rxjs';
import { ConfigService } from '../../../config/config.store';
import { AssignMemberDto, ProjectMember } from './members.types';
import { ProjectRole } from './roles.types';

@Injectable()
export class MembersStore {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly oauth = inject(OAuthService);
  private projectId = '';
  private loadVersion = 0;

  readonly members = signal<ProjectMember[]>([]);
  readonly roles = signal<string[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly removing = signal(false);
  readonly error = signal<string | null>(null);

  load(projectId: string): Observable<ProjectMember[]> {
    if (this.projectId !== projectId) {
      this.members.set([]);
      this.roles.set([]);
    }
    this.projectId = projectId;
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.error.set(null);
    return forkJoin({
      members: this.http.get<ProjectMember[]>(this.url(projectId), { headers: this.headers() }),
      roles: this.http.get<ProjectRole[]>(this.rolesUrl(projectId), { headers: this.headers() }),
    }).pipe(
      tap(({ members, roles }) => {
        if (version !== this.loadVersion) return;
        this.members.set(members);
        this.roles.set(roles.map((role) => role.name));
      }),
      map(({ members }) => members),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId, version)),
      finalize(() => {
        if (version === this.loadVersion) this.loading.set(false);
      }),
    );
  }

  loadRoles(projectId: string): Observable<string[]> {
    return this.http.get<ProjectRole[]>(this.rolesUrl(projectId), { headers: this.headers() }).pipe(
      map((roles) => roles.map((role) => role.name)),
      tap((roles) => {
        if (this.projectId === projectId) this.roles.set(roles);
      }),
    );
  }

  assign(projectId: string, dto: AssignMemberDto): Observable<ProjectMember> {
    this.saving.set(true);
    this.error.set(null);
    return this.http.post<ProjectMember>(this.url(projectId), dto, { headers: this.headers() }).pipe(
      tap((member) => {
        if (this.projectId === projectId) this.members.update((members) => [...members, member]);
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
      finalize(() => this.saving.set(false)),
    );
  }

  remove(projectId: string, member: ProjectMember): Observable<void> {
    this.removing.set(true);
    this.error.set(null);
    const url = `${this.url(projectId)}/${encodeURIComponent(member.user)}/roles/${encodeURIComponent(member.role)}`;
    return this.http.delete<void>(url, { headers: this.headers() }).pipe(
      tap(() => {
        if (this.projectId === projectId) {
          this.members.update((members) => members.filter((m) => m.user !== member.user || m.role !== member.role));
        }
      }),
      catchError((error: HttpErrorResponse) => this.fail(error, projectId)),
      finalize(() => this.removing.set(false)),
    );
  }

  private url(projectId: string): string {
    return `${this.config.environment()?.apiUrl}/projects/${encodeURIComponent(projectId)}/members`;
  }

  private rolesUrl(projectId: string): string {
    return `${this.config.environment()?.apiUrl}/projects/${encodeURIComponent(projectId)}/roles`;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.oauth.getAccessToken()}` });
  }

  private fail(error: HttpErrorResponse, projectId: string, version?: number): Observable<never> {
    const body = error.error as { error?: string; message?: string } | null;
    if (this.projectId === projectId && (version === undefined || version === this.loadVersion)) {
      this.error.set(body?.error ?? body?.message ?? 'Member request failed.');
    }
    return throwError(() => error);
  }
}
