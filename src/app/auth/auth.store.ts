import { effect, inject, Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { OAuthErrorEvent, OAuthService } from "angular-oauth2-oidc";
import { filter } from "rxjs";
import { authConfig } from "./auth.config";
import { ConfigService } from "../config/config.store";


@Injectable({
    providedIn: 'root'
})
export class AuthStore {
    private config = inject(ConfigService);
    private oauthService = inject(OAuthService);
    private router = inject(Router);

    private readonly _isAuthenticated = signal<boolean>(false);
    private readonly _isLoaded = signal<boolean>(false);
    private readonly _userInfo = signal<Record<string, any>>({});

    readonly isAuthenticated = this._isAuthenticated.asReadonly();
    readonly isLoaded = this._isLoaded.asReadonly();
    readonly userInfo = this._userInfo.asReadonly();

    constructor() {
        effect(() => {
            if (this.isAuthenticated()) {
                this._userInfo.set(this.oauthService.getIdentityClaims() as Record<string, any>)
            } else {
                this._userInfo.set({});
            }
        })

        // debugging OAuth events
        this.oauthService.events.subscribe(event => {
            this._isAuthenticated.set(this.oauthService.hasValidAccessToken());
            this._userInfo.set(this.oauthService.getIdentityClaims() as Record<string, any> || {});
            if (event instanceof OAuthErrorEvent) {
                console.error('OAuthErrorEvent Object:', event);
            } else {
                console.warn('OAuthEvent Object:', event);
            }
        });


        window.addEventListener('storage', (event) => {
            // The `key` is `null` if the event was caused by `.clear()`
            if (event.key !== 'access_token' && event.key !== null) {
                return;
            }

            console.warn('Noticed changes to access_token (most likely from another tab), updating isAuthenticated');
            this._isAuthenticated.set(this.oauthService.hasValidAccessToken());


            if (!this.oauthService.hasValidAccessToken()) {
                this.router.navigateByUrl('/');
            }
        });

        this.oauthService.events
            .pipe(filter(e => ['token_received'].includes(e.type)))
            .subscribe(e => this.oauthService.loadUserProfile());

        this.oauthService.events
            .pipe(filter(e => ['session_terminated', 'session_error'].includes(e.type)))
            .subscribe(e => this.router.navigateByUrl('/'));

    }

    public async runInitialLoginSequence(): Promise<void> {
        this.oauthService.configure(
            {
                ...authConfig,
                issuer: this.config.environment()?.auth.oidc.issuer || authConfig.issuer,
                clientId: this.config.environment()?.auth.oidc.clientId || authConfig.clientId,
                scope: this.config.environment()?.auth.oidc.scope || authConfig.scope,
                requireHttps: this.config.environment()?.auth.oidc.requireHttps ?? authConfig.requireHttps,
                redirectUri: this.config.environment()?.auth.oidc.redirectUri || authConfig.redirectUri,
            }
        );
        await this.oauthService.loadDiscoveryDocumentAndTryLogin();
        this._isAuthenticated.set(this.oauthService.hasValidAccessToken());

        if (this.isAuthenticated()) {
            const state = this.oauthService.state;
            if (state) {
                this.router.navigateByUrl(decodeURIComponent(state));
            }
        }

        this._isLoaded.set(true);
    }

    public async login(targetUrl?: string): Promise<void> {
        return this.oauthService.initCodeFlow(targetUrl || '/dashboard');
    }

    public logout(): void {
        this.oauthService.logOut();
    }

}