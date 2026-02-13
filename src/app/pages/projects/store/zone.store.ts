import { inject, Injectable, signal } from "@angular/core";
import { OAuthService } from "angular-oauth2-oidc";
import { ConfigService } from "../../../config/config.store";
import { CreateZoneDto, Zone, ZoneActionError, ZoneList } from "./zone.types";
import { HttpClient } from "@angular/common/http";
import { ProjectsStore } from "./projects.store";
import { map, switchMap } from "rxjs";
import { CreateProjectDto } from "./projects.types";


function soaRnameToEmail(rname: string): string {
    rname = rname.replace(/\.$/, ""); // remove trailing dot
    let local = "";
    let domain = "";
    let escaped = false;
    let split = false;

    for (let i = 0; i < rname.length; i++) {
        const c = rname[i];
        if (split) {
            domain += c;
            continue;
        }
        if (escaped) {
            local += c;
            escaped = false;
            continue;
        }
        if (c === "\\") {
            escaped = true;
            continue;
        }
        if (c === ".") {
            split = true;
            continue;
        }
        local += c;
    }

    return local + "@" + domain;
}


@Injectable({
    providedIn: 'root'
})
export class ZoneStore {
    private projectStore = inject(ProjectsStore);

    private configService = inject(ConfigService);
    private oauthService = inject(OAuthService);

    private readonly _zones = signal<ZoneList | null>(null)
    private readonly _loading = signal<boolean>(false);
    private readonly _error = signal<ZoneActionError | null>(null);

    private readonly _creating = signal<boolean>(false);
    private readonly _created = signal<boolean>(false);

    readonly zones = this._zones.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly error = this._error.asReadonly();

    readonly creating = this._creating.asReadonly();
    readonly created = this._created.asReadonly();

    constructor(private http: HttpClient) { }

    selectProject(projectId: string) {
        if (this.projectStore.selectedProjectId() !== projectId) {
            this._zones.set(null);
            this._loading.set(true);
        }

        this._error.set(null);

        this.http.get<ZoneList>(`${this.configService.environment()?.apiUrl}/project/${projectId}/zones`, {
            headers: {
                'Authorization': `Bearer ${this.oauthService.getAccessToken()}`
            }
        }).pipe(
            map((zoneList) => {
                const enriched = zoneList.map(zone => {
                    if (zone.spec.email) {
                        return {
                            ...zone,
                            spec: {
                                ...zone.spec,
                                email: soaRnameToEmail(zone.spec.email)
                            }
                        }
                    }
                    return zone;
                });
                return enriched as ZoneList;
            })
        ).subscribe({
            next: (data) => {
                this._zones.set(data);
                this._loading.set(false);
            },
            error: (err) => {
                this._error.set({
                    message: err.error.error || err.error.message,
                    action: 'list'
                });
                this._loading.set(false);
            }
        });
    }

    createZone(zoneDto: CreateZoneDto) {
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

        this.http.post<Zone>(`${this.configService.environment()?.apiUrl}/project/${projectId}/zones`, zoneDto, {
            headers: {
                'Authorization': `Bearer ${this.oauthService.getAccessToken()}`
            }
        }).subscribe({
            next: (data) => {
                this._created.set(true);
                const enriched = {
                    ...data,
                    spec: {
                        ...data.spec,
                        email: soaRnameToEmail(data.spec.email)
                    }
                }
                this._zones.update(zones => zones ? [...zones, enriched] : [enriched]);
            },
            error: (err) => {
                this._error.set({
                    message: err.error.error || err.error.message || 'Failed to create zone',
                    action: "create"
                });
                this._creating.set(false);
            },
            complete: () => {
                this._creating.set(false);
            }
        });
    }

    resetCreate() {
        this._error.set(null);
        this._creating.set(false);
        this._created.set(false);
    }
}