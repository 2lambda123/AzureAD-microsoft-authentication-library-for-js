/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * BaseAuthRequest
 * - scopes                  - Array of scopes the application is requesting access to.
 * - authority               - URL of the authority, the security token service (STS) from which MSAL will acquire tokens. Defaults to https://login.microsoftonline.com/common. If using the same authority for all request, authority should set on client application object and not request, to avoid resolving authority endpoints multiple times.
 * - correlationId           - Unique GUID set per request to trace a request end-to-end for telemetry purposes.
 */
export type BaseAuthRequest = {
    scopes: Array<string>;
    authority?: string;
    correlationId?: string;
};
