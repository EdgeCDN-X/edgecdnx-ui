import { AuthConfig } from 'angular-oauth2-oidc';

export const authConfig: AuthConfig = {
  // Replace with your OIDC provider's issuer URL
  issuer: 'https://your-oidc-provider.com',

  // Replace with your client ID
  clientId: 'your-client-id',

  // Redirect URI after successful authentication
  redirectUri: window.location.origin + '/callback',

  // Response type for OIDC
  responseType: 'code',

  // Scopes to request
  scope: 'openid profile email',

  // Use PKCE for security
  requireHttps: false, // Set to true in production
  showDebugInformation: true, // Set to false in production

  // Token endpoint
  tokenEndpoint: undefined, // Will be auto-discovered from issuer

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
  sessionChecksEnabled: true,

  // Clear hash after login
  clearHashAfterLogin: true,

  // Skip subject check
  skipSubjectCheck: false,

  // Skip issuer check (set to false in production)
  skipIssuerCheck: true,
};
