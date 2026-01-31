import { Injectable, signal } from "@angular/core";
import { CreateProjectDto, Project, ProjectActionError, ProjectList } from "./projects.types";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../../environments/environment";
import { catchError, tap } from "rxjs";



@Injectable({
    providedIn: 'root'
})
export class ProjectsStore {
    private readonly _projects = signal<ProjectList>([]);
    private readonly _loading = signal<boolean>(false);

    private readonly _creating = signal<boolean>(false);
    private readonly _created = signal<Project | null>(null);

    private readonly _error = signal<ProjectActionError | null>(null);

    readonly projects = this._projects.asReadonly();
    readonly loading = this._loading.asReadonly();

    readonly creating = this._creating.asReadonly();
    readonly created = this._created.asReadonly();

    readonly error = this._error.asReadonly();

    constructor(private http: HttpClient) { }

    loadProjects() {
        this._projects.set([]);
        this._loading.set(true);
        this._error.set(null);

        this.http.get<ProjectList>(`${environment.apiUrl}/projects`).subscribe({
            next: (data) => {
                this._projects.set(data);
            },
            error: (err) => {
                this._error.set({
                    message: err.error?.message || 'Failed to load projects',
                    action: "list"
                });
                this._loading.set(false);
            },
            complete: () => {
                this._loading.set(false);
            }
        })
    }

    createProject(project: CreateProjectDto) {
        this._creating.set(true);
        this._error.set(null);

        this.http.post<Project>(`${environment.apiUrl}/projects`, project).subscribe({
            next: (data) => {
                this._projects.update(projects => [...projects, data]);
                this._created.set(data);
            },
            error: (err) => {
                this._error.set({
                    message: err.error?.error ?? 'Failed to create project',
                    action: "create"
                });
                this._creating.set(false);
                this._created.set(null);
            },
            complete: () => {
                this._creating.set(false);
            }
        });
    }

    clearCreationState() {
        this.clearError();
        this._created.set(null);
        this._creating.set(false);
    }

    clearError() {
        this._error.set(null);
    }
}