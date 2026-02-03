import { Injectable, signal } from "@angular/core";
import { environment } from "../../../../environments/environment";
import { ServiceActionError, ServiceList } from "./service.types";
import { HttpClient } from "@angular/common/http";



@Injectable({
    providedIn: 'root'
})
export class ServiceStore {
    private readonly _services = signal<any>(null);
    private readonly _loading = signal<boolean>(false);
    private readonly _loaded = signal<boolean>(false);
    private readonly _error = signal<ServiceActionError | null>(null);
    private readonly _selectedProjectId = signal<string | null>(null);

    readonly services = this._services.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly loaded = this._loaded.asReadonly();
    readonly error = this._error.asReadonly();

    constructor(private http: HttpClient) { }

    selectProject(projectId: string) {
        if (this._selectedProjectId() !== projectId) {
            this._services.set(null);
            this._loading.set(true);
            this._loaded.set(false);
        }

        this._error.set(null);
        this._selectedProjectId.set(projectId);

        this.http.get<ServiceList>(`${environment.apiUrl}/project/${projectId}/services`).subscribe({
            next: (data) => {
                this._services.set(data);
            },
            error: (err) => {
                this._error.set({
                    message: err.error?.message || 'Failed to load services',
                    action: "list"
                })
                this._loading.set(false);
                this._loaded.set(false);
            },
            complete: () => {
                this._loading.set(false);
                this._loaded.set(true);
            }
        });
    }

}