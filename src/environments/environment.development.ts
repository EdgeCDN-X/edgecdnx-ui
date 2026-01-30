export const environment = {
    production: false,
    apiUrl : 'http://localhost:5555',
    auth: {
        oidc: {
            issuer: 'http://127.0.0.1:5556/dex',
            token: 'http://127.0.0.1:5556/dex/token_endpoint',
            clientId: 'example-app',
            scope: 'openid profile email',
            requireHttps: false,
        }
    }
};
