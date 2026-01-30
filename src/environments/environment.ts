export const environment = {
    production: false,
    apiUrl : 'http://localhost:5555',
    auth: {
        oidc: {
            issuer: '',
            token: '',
            clientId: '',
            scope: 'openid profile email',
            requireHttps: false,
        }
    }
};
