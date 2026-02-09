import { Injectable, signal } from '@angular/core';

export interface Environment {
    production: boolean;
    apiUrl: string;
    auth: {
        oidc: {
            issuer: string;
            token: string;
            clientId: string;
            scope: string;
            requireHttps: boolean;
            redirectUri: string;
        }
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