import { AuthConfig } from 'angular-oauth2-oidc';

export const authConfig: AuthConfig = {
  // Replace with your OIDC provider's issuer URL
  issuer: 'issuer',

  // Replace with your client ID
  clientId: 'clientId',
  // Redirect URI after successful authentication
  redirectUri: 'http://localhost:4200/callback',

  // Response type for OIDC
  responseType: 'code',

  // Scopes to request
  scope: 'openid profile email',

  // Use PKCE for security
  requireHttps: false,
  showDebugInformation: true, // Set to false in production

  // User info endpoint
  userinfoEndpoint: undefined, // Will be auto-discovered from issuer

  // Logout URL
  logoutUrl: undefined,

  // Use silent refresh
  useSilentRefresh: true,

  // Silent refresh timeout
  silentRefreshTimeout: 5000,

  // Timeout factor for token refresh
  timeoutFactor: 0.75,

  // Session check interval
  sessionChecksEnabled: false,

  // Clear hash after login
  clearHashAfterLogin: true,

  // Skip subject check
  skipSubjectCheck: false,

  // Skip issuer check (set to false in production)
  skipIssuerCheck: true,
};
