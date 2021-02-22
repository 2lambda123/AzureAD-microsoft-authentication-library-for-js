# Acquiring Access Tokens Protected with Proof-of-Possession

In order to increase the protection of OAuth 2.0 access tokens stored in the browser against "token replay", MSAL provides an `Access Token Proof-of-Posession` authentication scheme. `Access Token Proof-of-Possession`, or `AT PoP`, is an authentication scheme that cryptographically binds the access tokens to the browser and client application from which they are requested, meaning they cannot be used from a different application or device.

It is important to understand that for `AT PoP` to work end-to-end and provide the security upgrade intended, both the **authorization service** that issues the access tokens and the **resource server** that they are provide access to must support `AT PoP`.

## Bearer Access Token vs PoP Token

### Bearer Access Token

The standard [Authentication Result](https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_common.html#authenticationresult) returned by MSAL v2 APIs includes an `accessToken` property. When used with the default `Bearer` authentication scheme, the value under the `accessToken` property is the access token secret provided by the authorization server. This value is cached by MSAL and should be added to resource requests as a bearer token in the request's `Authorization` header.

Example Bearer Access Token Usage:

```typescript
// Using the Bearer scheme (default), loginRedirect returns an AuthenticationResult object containing the Bearer access token secret
const { accessToken } = await myMSALObj.loginRedirect(loginRequest);

// The bearer token secret is appended to the Authorization header
const headers = new Headers();
const authHeader = `Bearer ${accessToken}`; // The Bearer label is used in this header
headers.append("Authorization", authHeader);
```

### PoP Token (SHR)

When the `POP` authorization scheme is enabled in an MSAL token request, the authorization server will still provide a `Bearer` type access token, which MSAL will also cache. The main difference is that when using the `POP` scheme, MSAL will sign the access token secret before returning it to the client application.

The access token secret is wrapped in a new JSON Web Token, which will be signed using the `HMAC` (Hash-based Message Authentication Code) hashing algorithm and a private key that MSAL generates, stores and manages. The signed JWT is then added to the `AuthorizationResult` object under the `accessToken` property and returned from the MSAL v2 API called.

Once the client application receives the returned authentication result, it can extract the `accessToken` value from the authentication result and add it to the `Authorization` header of a PoP-protected resource request, using the `PoP` label instead of `Bearer`.

**Note: The signed JWT (called a Signed HTTP Request or SHR) is never cached by MSAL. Everytime an MSAL v2 API is called, MSAL will either retrieve a valid raw access token secret from the cache or request a new access token from the authorization server. MSAL will then sign said access token and return it in the authentication result.**

Example PoP Access Token Usage:

```typescript
// Using the POP scheme (default), loginRedirect returns an AuthenticationResult object containing the Signed HTTP Request (PoP Token)
const { accessToken } = await myMSALObj.loginRedirect(loginRequest);

// The SHR is appended to the Authorization header
const headers = new Headers();
const authHeader = `PoP ${accessToken}`; // The PoP label is used in this header
headers.append("Authorization", authHeader);
```

## Making a PoP Token Request

Once you have determined the authorization service and resource server support access token binding, you can configure your MSAL authentication and authorization request objects to acquire bound access tokens by enabling the `POP` authenticaiton scheme in the request configuration:

### Login Redirect Request Example

```typescript
const loginRequest = {
    scopes: ["User.Read"],
    authenticationScheme: msal.AuthenticationScheme.POP, // Default is "BEARER"
    resourceRequestMethod: "POST",
    resourceRequestUri: "YOUR_RESOURCE_ENDPOINT"
}

```

Once the request has been configured and `POP` is set as the `authenticationScheme`, it can be sent into the `loginRedirect` MSAL v2 API.

```typescript
const { accessToken } = await myMSALObj.loginRedirect(loginRequest);

// Once a Pop Token has been acquired, it can be added on the authorization header of a resource request
const headers = new Headers();
const authHeader = `PoP ${accessToken}`;

headers.append("Authorization", authHeader);

const options = {
    method: loginRequest.resourceRequestMethod,
    headers: headers
};

// After the request has been built and the access token has bee appended, the request can be executed using an API like "fetch"
fetch(endpoint, options)
    .then(response => response.json())
    .then(response => callback(response, endpoint))
    .catch(error => console.log(error));
});
```

### Acquire Token Redirect Example

```typescript

// Add here scopes for id token to be used at MS Identity Platform endpoints.
const loginRequest = {
    scopes: ["User.Read"],
    
};

// Add here scopes for access token to be used at MS Graph API endpoints.
const tokenRequest = {
    scopes: ["Mail.Read"],
    authenticationScheme: msal.AuthenticationScheme.POP,
    resourceRequestMethod: "POST",
};
       
const { accessToken } = await myMSALObj.acquireTokenRedirect(request);

// Once a Pop Token has been acquired, it can be added on the authorization header of a resource request
const headers = new Headers();
const authHeader = `PoP ${accessToken}`;

headers.append("Authorization", authHeader);

const options = {
    method: tokenRequest.resourceRequestMethod,
    headers: headers
};

// Once the request has been built and the access token has bee appended, the request can be executed using an API like "fetch"
fetch(endpoint, options)
    .then(response => response.json())
    .then(response => callback(response, endpoint))
    .catch(error => console.log(error));
});
```

