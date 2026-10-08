import { computed, DestroyRef, effect, inject, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { OAuthErrorEvent, OAuthInfoEvent, OAuthService } from "angular-oauth2-oidc";
import { authConfig } from "./auth.config";
import { ConfigService } from "../config/config.store";


@Injectable({
    providedIn: 'root'
})
export class AuthStore {
    private config = inject(ConfigService);
    private oauthService = inject(OAuthService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);
    private refreshInFlight: Promise<void> | null = null;
    private sessionExpired = false;
    private renewalDue = false;

    private readonly _isAuthenticated = signal<boolean>(false);
    private readonly _isLoaded = signal<boolean>(false);
    private readonly _userInfo = signal<Record<string, any>>({});

    readonly isAuthenticated = this._isAuthenticated.asReadonly();
    readonly isLoaded = this._isLoaded.asReadonly();
    readonly userInfo = this._userInfo.asReadonly();
    readonly isAdmin = computed<boolean>(() => {
        const claims = this.userInfo();
        const groupsClaim = claims['groups'] ?? claims['group'];

        const groups = Array.isArray(groupsClaim)
            ? groupsClaim.filter((group): group is string => typeof group === 'string')
            : typeof groupsClaim === 'string'
                ? [groupsClaim]
                : [];

        return groups.some((group) =>
            group
                .split('/')
                .map((segment) => segment.trim().toLowerCase())
                .includes(this.config.environment()?.auth.adminGroups.map(g => g.toLowerCase()).join(',') || 'admin')
        );
    });

    constructor() {
        effect(() => {
            if (this.isAuthenticated()) {
                this._userInfo.set(this.oauthService.getIdentityClaims() as Record<string, any>)
            } else {
                this._userInfo.set({});
            }
        })

        this.oauthService.events.pipe(takeUntilDestroyed()).subscribe(event => {
            if (event.type === 'token_received' && this.sessionExpired) {
                this.oauthService.logOut(true);
                return;
            }
            this._isAuthenticated.set(!this.sessionExpired && this.oauthService.hasValidAccessToken());
            this._userInfo.set(this.isAuthenticated()
                ? this.oauthService.getIdentityClaims() as Record<string, any> || {}
                : {});
            if (event instanceof OAuthErrorEvent) {
                console.error('OAuthErrorEvent Object:', event);
            }
            if (this.isLoaded() && [
                'token_refresh_error', 'silent_refresh_error', 'silent_refresh_timeout',
                'session_terminated', 'session_error',
            ].includes(event.type)) {
                this.expireSession();
            }
            if (event instanceof OAuthInfoEvent &&
                event.type === 'token_expires' && event.info === 'access_token') {
                if (this.isLoaded()) {
                    void this.refreshAccessToken().catch(error => console.error('Scheduled token renewal failed:', error));
                } else {
                    this.renewalDue = true;
                }
            }
            if (event.type === 'token_received') {
                this.renewalDue = false;
                void this.oauthService.loadUserProfile()
                    .catch(error => console.error('Failed to load OIDC user profile:', error));
            }
        });

        const onStorage = (event: StorageEvent) => {
            // The `key` is `null` if the event was caused by `.clear()`
            if (event.key !== 'access_token' && event.key !== null) {
                return;
            }

            this._isAuthenticated.set(this.oauthService.hasValidAccessToken());

            if (!this.oauthService.hasValidAccessToken()) {
                this.expireSession();
            }
        };
        const onResume = () => {
            if (!this.isLoaded() || this.sessionExpired || document.visibilityState === 'hidden') {
                return;
            }
            const expiresAt = this.oauthService.getAccessTokenExpiration();
            if (this.oauthService.getAccessToken() &&
                (!this.oauthService.hasValidAccessToken() || expiresAt - Date.now() <= 60_000)) {
                void this.refreshAccessToken().catch(error => console.error('Token renewal on tab resume failed:', error));
            }
        };
        window.addEventListener('storage', onStorage);
        window.addEventListener('focus', onResume);
        document.addEventListener('visibilitychange', onResume);
        this.destroyRef.onDestroy(() => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('focus', onResume);
            document.removeEventListener('visibilitychange', onResume);
        });

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
        try {
            await this.oauthService.loadDiscoveryDocumentAndTryLogin();
            if ((!this.oauthService.hasValidAccessToken() && this.oauthService.getRefreshToken()) ||
                (this.renewalDue && this.oauthService.getAccessToken())) {
                await this.refreshAccessToken();
            }
            this._isAuthenticated.set(!this.sessionExpired && this.oauthService.hasValidAccessToken());
            this._isLoaded.set(true);
            if (this.isAuthenticated()) {
                const state = this.oauthService.state;
                await this.router.navigateByUrl(state ? decodeURIComponent(state) : '/projects');
            }
        } catch (error) {
            console.error('OIDC initialization failed:', error);
            this.expireSession();
        } finally {
            this._isLoaded.set(true);
        }
    }

    public refreshAccessToken(): Promise<void> {
        if (this.refreshInFlight) {
            return this.refreshInFlight;
        }
        this.refreshInFlight = Promise.resolve().then(async () => {
            if (this.sessionExpired || !this.oauthService.getRefreshToken()) {
                throw new Error('The OIDC session has no usable refresh token');
            }
            await this.oauthService.refreshToken();
            if (this.sessionExpired || !this.oauthService.hasValidAccessToken()) {
                throw new Error('Token renewal did not restore the OIDC session');
            }
            this._isAuthenticated.set(true);
            this.renewalDue = false;
        }).catch(error => {
            console.error('OIDC token renewal failed:', error);
            this.expireSession();
            throw error;
        }).finally(() => {
            this.refreshInFlight = null;
        });
        return this.refreshInFlight;
    }

    public expireSession(): void {
        if (this.sessionExpired) {
            return;
        }
        this.sessionExpired = true;
        this._isAuthenticated.set(false);
        this._userInfo.set({});
        this.oauthService.logOut(true);
        const currentUrl = this.router.url;
        if (/^\/(signin|logout)([/?#]|$)/.test(currentUrl)) {
            return;
        }
        const redirectUrl = /^\/callback([/?#]|$)/.test(currentUrl) ? '/dashboard' : currentUrl;
        void this.router.navigate(['/signin'], { queryParams: { redirectUrl } })
            .catch(error => console.error('Failed to navigate to sign-in:', error));
    }

    public async login(targetUrl?: string): Promise<void> {
        this.sessionExpired = false;
        return this.oauthService.initCodeFlow(targetUrl || '/dashboard');
    }

    public async register(targetUrl?: string): Promise<void> {
        this.sessionExpired = false;
        return this.oauthService.initCodeFlow(targetUrl || '/dashboard',
            {
                prompt: "create"
            });
    }

    public logout(): void {
        this.sessionExpired = true;
        this.oauthService.logOut();
    }

}