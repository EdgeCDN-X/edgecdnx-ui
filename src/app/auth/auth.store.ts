import { effect, inject, Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { OAuthErrorEvent, OAuthService } from "angular-oauth2-oidc";
import { filter } from "rxjs";
import { environment } from "../../environments/environment";
import { authConfig } from "./auth.config";


@Injectable({
    providedIn: 'root'
})
export class AuthStore {
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
        this.oauthService.configure(authConfig);
        await this.oauthService.loadDiscoveryDocumentAndTryLogin();

        this._isLoaded.set(true);

        if (this.oauthService.hasValidAccessToken()) {
            return;
        }

        this.oauthService.initLoginFlow();
    }

    public logout(): void {
        this.oauthService.logOut();
    }

}