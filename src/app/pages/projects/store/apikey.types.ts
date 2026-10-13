export interface ApiKey {
  /** Kubernetes object name (ak-<random>), used in URLs. */
  id: string;
  /** RBAC subject (ak_<random>) used in project role bindings. */
  name: string;
  displayName: string;
  project: string;
  roles: string[];
  /** null when the key never expires. */
  expiresAt: string | null;
  createdAt: string;
}

/** Returned only by the create endpoint; the token is never retrievable again. */
export interface CreatedApiKey extends ApiKey {
  token: string;
}

export interface CreateApiKeyDto {
  displayName: string;
  /** null creates a key that never expires. */
  expiresAt: string | null;
  roles: string[];
}

export interface UpdateApiKeyDto {
  displayName?: string;
  /** Omit to keep the current expiry; null removes it. */
  expiresAt?: string | null;
  roles?: string[];
}
