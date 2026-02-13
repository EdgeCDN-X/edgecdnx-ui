import { inject, Injectable, signal } from "@angular/core";
import { CreateServiceDto, Service, ServiceActionError, ServiceList } from "./service.types";
import { HttpClient } from "@angular/common/http";
import { OAuthService } from "angular-oauth2-oidc";
import { ConfigService } from "../../../config/config.store";
import { ProjectsStore } from "./projects.store";



@Injectable({
    providedIn: 'root'
})
export class ServiceStore {
    private projectStore = inject(ProjectsStore);

    private configService = inject(ConfigService);
    private oauthService = inject(OAuthService);

    private readonly _services = signal<ServiceList | null>(null);
    private readonly _loading = signal<boolean>(false);
    private readonly _error = signal<ServiceActionError | null>(null);

    private readonly _creating = signal<boolean>(false);
    private readonly _created = signal<boolean>(false);

    private readonly _updating = signal<boolean>(false);
    private readonly _updated = signal<boolean>(false);

    readonly services = this._services.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly error = this._error.asReadonly();

    readonly creating = this._creating.asReadonly();
    readonly created = this._created.asReadonly();

    readonly updating = this._updating.asReadonly();
    readonly updated = this._updated.asReadonly();

    constructor(private http: HttpClient) { }

    selectProject(projectId: string) {
        if (this.projectStore.selectedProjectId() !== projectId) {
            this._services.set(null);
            this._loading.set(true);
        }

        this._error.set(null);

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
                    message: err.error.error || err.error.message || 'Failed to load services',
                    action: "list"
                })
                this._loading.set(false);
            },
            complete: () => {
                this._loading.set(false);
            }
        });
    }

    createService(serviceDto: CreateServiceDto) {
        this._error.set(null);
        this._creating.set(true);
        this._created.set(false);

        const projectId = this.projectStore.selectedProjectId();
        if (!projectId) {
            this._error.set({
                message: 'No project selected',
                action: "create"
            });
            this._creating.set(false);
            return;
        }

        this.http.post<Service>(`${this.configService.environment()?.apiUrl}/project/${projectId}/services`, serviceDto, {
            headers: {
                'Authorization': `Bearer ${this.oauthService.getAccessToken()}`
            }
        }).subscribe({
            next: (data) => {
                this._created.set(true);
                this._services.update(services => services ? [...services, data] : [data]);
            },
            error: (err) => {
                this._error.set({
                    message: err.error.error || err.error.message || 'Failed to create service',
                    action: "create"
                });
                this._creating.set(false);
            },
            complete: () => {
                this._creating.set(false);
            }
        });
    }

    updateService(serviceId: string, serviceDto: Partial<CreateServiceDto>) {
        this._error.set(null);
        this._updating.set(true);
        this._updated.set(false);

        const projectId = this.projectStore.selectedProjectId();
        if (!projectId) {
            this._error.set({
                message: 'No project selected',
                action: "update"
            });
            this._updating.set(false);
            return;
        }

        this.http.patch<Service>(`${this.configService.environment()?.apiUrl}/project/${projectId}/services/${serviceId}`, serviceDto, {
            headers: {
                'Authorization': `Bearer ${this.oauthService.getAccessToken()}`
            }
        }).subscribe({
            next: (data) => {
                this._updated.set(true);
                this._services.update(services => {
                    if (!services) return services;
                    return services.map(service => {
                        if (service.metadata.name === serviceId) {
                            return {
                                ...data,
                            }
                        }
                        return service;
                    });
                });
            },
            error: (err) => {
                this._error.set({
                    message: err.error.error || err.error.message || 'Failed to update service',
                    action: "update"
                });
                this._updating.set(false);
            },
            complete: () => {
                this._updating.set(false);
            }
        });
    }

    addHostAlias(serviceId: string, hostAlias: string) {
        const projectId = this.projectStore.selectedProjectId();
        if (!projectId) {
            this._error.set({
                message: 'No project selected',
                action: "host-alias-add"
            });
            this._updating.set(false);
            return;
        }

        this.resetUpdate()

        this.http.post<Service>(`${this.configService.environment()?.apiUrl}/project/${projectId}/services/${serviceId}/host-alias`, {name: hostAlias}, {
            headers: {
                'Authorization': `Bearer ${this.oauthService.getAccessToken()}`
            }
        }).subscribe({
            next: (data) => {
                this._updated.set(true);
                this._services.update(services => {
                    if (!services) return services;
                    return services.map(service => {
                        if (service.metadata.name === serviceId) {
                            return {
                                ...data,
                            }
                        }
                        return service;
                    });
                });
            },
            error: (err) => {
                this._error.set({
                    message: err.error.error || err.error.message || 'Failed to add hostAlias',
                    action: "host-alias-add"
                });
                this._updating.set(false);
            },
            complete: () => {
                this._updating.set(false);
            }
        });
    }

    addKey(serviceId: string, keyName: string) {
        const projectId = this.projectStore.selectedProjectId();
        if (!projectId) {
            this._error.set({
                message: 'No project selected',
                action: "key-add"
            });
            this._updating.set(false);
            return;
        }

        this.resetUpdate();

        this.http.post<Service>(`${this.configService.environment()?.apiUrl}/project/${projectId}/services/${serviceId}/keys`, { name: keyName }, {
            headers: {
                'Authorization': `Bearer ${this.oauthService.getAccessToken()}`
            }
        }).subscribe({
            next: (data) => {
                this._updated.set(true);
                this._services.update(services => {
                    if (!services) return services;
                    return services.map(service => {
                        if (service.metadata.name === serviceId) {
                            return {
                                ...data,
                            }
                        }
                        return service;
                    });
                });
            },
            error: (err) => {
                this._error.set({
                    message: err.error.error || err.error.message || 'Failed to add key',
                    action: "key-add"
                });
                this._updating.set(false);
            },
            complete: () => {
                this._updating.set(false);
            }
        });
    }

    deleteKey(serviceId: string, keyName: string) {
        const projectId = this.projectStore.selectedProjectId();
        if (!projectId) {
            this._error.set({
                message: 'No project selected',
                action: "key-delete"
            });
            this._updating.set(false);
            return;
        }

        this._error.set(null);
        this._updating.set(true);
        this._updated.set(false);

        this.http.delete<Service>(`${this.configService.environment()?.apiUrl}/project/${projectId}/services/${serviceId}/keys/${keyName}`, {
            headers: {
                'Authorization': `Bearer ${this.oauthService.getAccessToken()}`
            }
        }).subscribe({
            next: (data) => {
                this._updated.set(true);
                this._services.update(services => {
                    if (!services) return services;
                    return services.map(service => {
                        if (service.metadata.name === serviceId) {
                            return {
                                ...data,
                            }
                        }
                        return service;
                    });
                });
            },
            error: (err) => {
                this._error.set({
                    message: err.error.error || err.error.message || 'Failed to delete key',
                    action: "key-delete"
                });
                this._updating.set(false);
            },
            complete: () => {
                this._updating.set(false);
            }
        });
    }

    resetUpdate() {
        this._error.set(null);
        this._updating.set(false);
        this._updated.set(false);
    }

    resetCreate() {
        this._error.set(null);
        this._creating.set(false);
        this._created.set(false);
    }
}