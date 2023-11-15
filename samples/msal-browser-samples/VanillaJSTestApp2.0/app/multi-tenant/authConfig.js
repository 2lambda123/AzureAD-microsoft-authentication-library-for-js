const homeTenant = "HOME_TENANT_ID";
const guestTenant = "GUEST_TENANT_ID"
const baseAuthority = "https://login.microsoftonline.com"

// Config object to be passed to Msal on creation
const msalConfig = {
    auth: {
        clientId: "ENTER_CLIENT_ID",
        authority: `${baseAuthority}/${homeTenant}`
    },
    cache: {
        cacheLocation: "localStorage", // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
    system: {
        loggerOptions: {
            logLevel: msal.LogLevel.Trace,
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case msal.LogLevel.Error:
                        console.error(message);
                        return;
                    case msal.LogLevel.Info:
                        console.info(message);
                        return;
                    case msal.LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case msal.LogLevel.Warning:
                        console.warn(message);
                        return;
                    default:
                        console.log(message);
                        return;
                }
            }
        }
    },
    telemetry: {
        application: {
            appName: "MSAL Browser V2 Multi-tenant Sample",
            appVersion: "1.0.0"
        }
    }
};

// Add here scopes for id token to be used at MS Identity Platform endpoints.
const loginRequest = {
    scopes: ["User.Read"]
};

// Add here the endpoints for MS Graph API services you would like to use.
const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
};

const silentRequest = {
    scopes: ["openid", "profile", "User.Read"]
};

const guestTenantRequest = {
    ...loginRequest,
    authority: `${baseAuthority}/${guestTenant}`
}