import { inject, Injectable, signal } from "@angular/core";
import { CreateServiceDto, ServiceActionError, ServiceList } from "./service.types";
import { HttpClient } from "@angular/common/http";
import { OAuthService } from "angular-oauth2-oidc";
import { ConfigService } from "../../../config/config.store";



@Injectable({
    providedIn: 'root'
})
export class ServiceStore {
    private configService = inject(ConfigService);
    private oauthService = inject(OAuthService);

    private readonly _services = signal<any>(null);
    private readonly _loading = signal<boolean>(false);
    private readonly _loaded = signal<boolean>(false);
    private readonly _error = signal<ServiceActionError | null>(null);
    private readonly _selectedProjectId = signal<string | null>(null);

    private readonly _creating = signal<boolean>(false);
    private readonly _created = signal<boolean>(false);

    readonly selectedProjectId = this._selectedProjectId.asReadonly();

    readonly services = this._services.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly loaded = this._loaded.asReadonly();
    readonly error = this._error.asReadonly();

    readonly creating = this._creating.asReadonly();
    readonly created = this._created.asReadonly();

    constructor(private http: HttpClient) { }

    selectProject(projectId: string) {
        if (this._selectedProjectId() !== projectId) {
            this._services.set(null);
            this._loading.set(true);
            this._loaded.set(false);
        }

        this._error.set(null);
        this._selectedProjectId.set(projectId);

        this.http.get<ServiceList>(`${this.configService.environment()?.apiUrl}/project/${projectId}/services`, {
            headers: {
                'Authorization': `Bearer ${this.oauthService.getAccessToken()}`
            }
        }).subscribe({
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

    createService(serviceDto: CreateServiceDto) {
        this._error.set(null);
        this._creating.set(true);
        this._created.set(false);

        const projectId = this._selectedProjectId();
        if (!projectId) {
            this._error.set({
                message: 'No project selected',
                action: "create"
            });
            this._creating.set(false);
            return;
        }

        this.http.post(`${this.configService.environment()?.apiUrl}/project/${projectId}/services`, serviceDto).subscribe({
            next: (data) => {
                this._created.set(true);
                this._services.update(services => services ? [...services, data] : [data]);
            },
            error: (err) => {
                this._error.set({
                    message: err.error?.message || 'Failed to create service',
                    action: "create"
                });
                this._creating.set(false);
            },
            complete: () => {
                this._creating.set(false);
            }
        });
    }
}