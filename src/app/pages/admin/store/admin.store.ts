import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { ConfigService } from '../../../config/config.store';
import { AdminResource, AdminResourceState, LocationHealthApiResponse, LocationHealthItem, LocationHealthNode, LocationHealthState } from './admin.types';

const initialResourceState = (): AdminResourceState => ({
  items: [],
  loading: false,
  loaded: false,
  error: null,
});

const initialLocationHealthState = (): LocationHealthState => ({
  items: [],
  sources: [],
  unmatchedMetrics: [],
  loading: false,
  loaded: false,
  error: null,
});

@Injectable({
  providedIn: 'root',
})
export class AdminStore {
  private readonly oauthService = inject(OAuthService);
  private readonly configService = inject(ConfigService);

  private readonly _locationsState = signal<AdminResourceState>(initialResourceState());
  private readonly _locationHealthsState = signal<LocationHealthState>(initialLocationHealthState());
  private readonly _prefixlistsState = signal<AdminResourceState>(initialResourceState());
  private readonly _zonesState = signal<AdminResourceState>(initialResourceState());

  readonly locationsState = this._locationsState.asReadonly();
  readonly locationHealthsState = this._locationHealthsState.asReadonly();
  readonly prefixlistsState = this._prefixlistsState.asReadonly();
  readonly zonesState = this._zonesState.asReadonly();

  constructor(private http: HttpClient) {}

  loadLocations(force = false) {
    this.loadResource('locations', this._locationsState, force);
  }

  loadLocationHealths(force = false) {
    let shouldSkip = false;
    this._locationHealthsState.update((current) => {
      if (!force && (current.loading || current.loaded)) {
        shouldSkip = true;
        return current;
      }

      return {
        ...current,
        loading: true,
        loaded: false,
        error: null,
      };
    });

    if (shouldSkip) {
      return;
    }

    this.http
      .get<LocationHealthApiResponse>(`${this.configService.environment()?.apiUrl}/admin/location-healths`, {
        headers: {
          Authorization: `Bearer ${this.oauthService.getAccessToken()}`,
        },
      })
      .subscribe({
        next: (data) => {
          const normalized = this.normalizeLocationHealthResponse(data);
          this._locationHealthsState.update((current) => ({
            ...current,
            items: normalized.items,
            sources: normalized.sources,
            unmatchedMetrics: normalized.unmatchedMetrics,
          }));
        },
        error: (err) => {
          this._locationHealthsState.update((current) => ({
            ...current,
            items: [],
            sources: [],
            unmatchedMetrics: [],
            loading: false,
            loaded: false,
            error: err?.error?.error || err?.error?.message || err?.message || 'Failed to load location health data',
          }));
        },
        complete: () => {
          this._locationHealthsState.update((current) => ({
            ...current,
            loading: false,
            loaded: true,
          }));
        },
      });
  }

  loadPrefixlists(force = false) {
    this.loadResource('prefixlists', this._prefixlistsState, force);
  }

  loadZones(force = false) {
    this.loadResource('zones', this._zonesState, force);
  }

  private loadResource(
    resource: AdminResource,
    state: { set: (value: AdminResourceState) => void; update: (updater: (value: AdminResourceState) => AdminResourceState) => void; },
    force: boolean
  ) {
    let shouldSkip = false;
    state.update((current) => {
      if (!force && (current.loading || current.loaded)) {
        shouldSkip = true;
        return current;
      }

      return {
        ...current,
        loading: true,
        loaded: false,
        error: null,
      };
    });

    if (shouldSkip) {
      return;
    }

    this.http
      .get<unknown>(`${this.configService.environment()?.apiUrl}/admin/${resource}`, {
        headers: {
          Authorization: `Bearer ${this.oauthService.getAccessToken()}`,
        },
      })
      .subscribe({
        next: (data) => {
          state.update((current) => ({
            ...current,
            items: this.normalizeResponse(data),
          }));
        },
        error: (err) => {
          state.update((current) => ({
            ...current,
            items: [],
            loading: false,
            loaded: false,
            error: err?.error?.error || err?.error?.message || err?.message || `Failed to load admin ${resource}`,
          }));
        },
        complete: () => {
          state.update((current) => ({
            ...current,
            loading: false,
            loaded: true,
          }));
        },
      });
  }

  private normalizeResponse(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const value = payload as Record<string, unknown>;

      if (Array.isArray(value['items'])) {
        return value['items'];
      }

      if (Array.isArray(value['data'])) {
        return value['data'];
      }

      if (Array.isArray(value['results'])) {
        return value['results'];
      }

      return [payload];
    }

    return payload === null || payload === undefined ? [] : [payload];
  }

  private normalizeLocationHealthResponse(payload: LocationHealthApiResponse | unknown): {
    items: LocationHealthItem[];
    sources: string[];
    unmatchedMetrics: LocationHealthNode[];
  } {
    if (!payload || typeof payload !== 'object') {
      return {
        items: [],
        sources: [],
        unmatchedMetrics: [],
      };
    }

    const value = payload as Record<string, unknown>;
    const data = value['data'];
    if (!data || typeof data !== 'object') {
      return {
        items: [],
        sources: [],
        unmatchedMetrics: [],
      };
    }

    const dataValue = data as Record<string, unknown>;

    return {
      items: Array.isArray(dataValue['locations']) ? (dataValue['locations'] as LocationHealthItem[]) : [],
      sources: Array.isArray(dataValue['sources']) ? (dataValue['sources'] as string[]) : [],
      unmatchedMetrics: Array.isArray(dataValue['unmatchedMetrics']) ? (dataValue['unmatchedMetrics'] as LocationHealthNode[]) : [],
    };
  }
}
