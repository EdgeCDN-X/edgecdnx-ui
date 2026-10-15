import { Injectable, signal } from '@angular/core';

export interface DNSNameserver {
    ns: string;
    routeResolver: string;
}

export interface Environment {
    production: boolean;
    apiUrl: string;
    dnsNameservers?: DNSNameserver[];
    auth: {
        oidc: {
            issuer: string;
            token: string;
            clientId: string;
            scope: string;
            requireHttps: boolean;
            redirectUri: string;
        },
        allowSignup: boolean;
        adminGroups: string[];
    }
}


@Injectable({ providedIn: 'root' })
export class ConfigService {

    private readonly _environment = signal<Environment | null>(null);
    readonly environment = this._environment.asReadonly();

    setConfig(config: Environment) {
        this._environment.set(config);
    }

    constructor() { }
}