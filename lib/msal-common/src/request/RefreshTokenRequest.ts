/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { BaseAuthRequest } from "./BaseAuthRequest";

/**
 * @type RefreshTokenRequest
 *
 * scopes:                  A space-separated array of scopes for the same resource.
 * authority:               URL of the authority, the security token service (STS) from which MSAL will acquire tokens.
 * refreshToken:            A refresh token returned from a previous request to the Identity provider.
 */
export type RefreshTokenRequest = BaseAuthRequest & {
    refreshToken: string;
};
