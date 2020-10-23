/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ClientConfiguration } from "../config/ClientConfiguration";
import { BaseClient } from "./BaseClient";
import { Authority } from "../authority/Authority";
import { RequestParameterBuilder } from "../request/RequestParameterBuilder";
import { ScopeSet } from "../request/ScopeSet";
import { GrantType , CredentialType, Constants } from "../utils/Constants";
import { ResponseHandler } from "../response/ResponseHandler";
import { AuthenticationResult } from "../response/AuthenticationResult";
import { ClientCredentialRequest } from "../request/ClientCredentialRequest";
import { CredentialFilter, CredentialCache } from "../cache/utils/CacheTypes";

import { AccessTokenEntity } from "../cache/entities/AccessTokenEntity";
import { TimeUtils } from "../utils/TimeUtils";
import { StringUtils } from "../utils/StringUtils";
import { RequestThumbprint } from "../network/RequestThumbprint";
import { ClientAuthError } from "../error/ClientAuthError";

/**
 * OAuth2.0 client credential grant
 */
export class ClientCredentialClient extends BaseClient {

    private scopeSet: ScopeSet;

    constructor(configuration: ClientConfiguration) {
        super(configuration);
    }

    public async acquireToken(request: ClientCredentialRequest): Promise<AuthenticationResult> {

        this.scopeSet = new ScopeSet(request.scopes || []);

        if (request.skipCache) {
            return await this.executeTokenRequest(request, this.authority);
        }

        const cachedAuthenticationResult = await this.getCachedAuthenticationResult();
        if (cachedAuthenticationResult != null) {
            return cachedAuthenticationResult;
        } else {
            return await this.executeTokenRequest(request, this.authority);
        }
    }

    private async getCachedAuthenticationResult(): Promise<AuthenticationResult | null> {
        const cachedAccessToken = this.readAccessTokenFromCache();
        if (!cachedAccessToken || TimeUtils.isTokenExpired(cachedAccessToken.expiresOn, this.config.systemOptions.tokenRenewalOffsetSeconds)) {
            return null;
        }

        return await ResponseHandler.generateAuthenticationResult(
            this.cryptoUtils,
            {
                account: undefined,
                accessToken: cachedAccessToken,
                idToken: undefined,
                refreshToken: undefined,
                appMetadata: undefined
            },
            true
        );
    }

    private readAccessTokenFromCache(): AccessTokenEntity | null {
        const accessTokenFilter: CredentialFilter = {
            homeAccountId: "",
            environment: this.authority.canonicalAuthorityUrlComponents.HostNameAndPort,
            credentialType: CredentialType.ACCESS_TOKEN,
            clientId: this.config.authOptions.clientId,
            realm: this.authority.tenant,
            target: this.scopeSet.printScopesLowerCase()
        };
        const credentialCache: CredentialCache = this.cacheManager.getCredentialsFilteredBy(accessTokenFilter);
        const accessTokens = Object.keys(credentialCache.accessTokens).map(key => credentialCache.accessTokens[key]);
        if (accessTokens.length < 1) {
            return null;
        } else if (accessTokens.length > 1) {
            throw ClientAuthError.createMultipleMatchingTokensInCacheError();
        }
        return accessTokens[0] as AccessTokenEntity;
    }

    private async executeTokenRequest(request: ClientCredentialRequest, authority: Authority)
        : Promise<AuthenticationResult> {

        const requestBody = this.createTokenRequestBody(request);
        const headers: Record<string, string> = this.createDefaultTokenRequestHeaders();
        const thumbprint: RequestThumbprint = {
            clientId: this.config.authOptions.clientId,
            authority: authority.canonicalAuthority,
            scopes: request.scopes
        };

        const response = await this.executePostToTokenEndpoint(authority.tokenEndpoint, requestBody, headers, thumbprint);

        const responseHandler = new ResponseHandler(
            this.config.authOptions.clientId,
            this.cacheManager,
            this.cryptoUtils,
            this.logger,
            this.config.serializableCache,
            this.config.persistencePlugin
        );

        responseHandler.validateTokenResponse(response.body);
        const tokenResponse = await responseHandler.handleServerTokenResponse(
            response.body,
            this.authority,
            request.resourceRequestMethod,
            request.resourceRequestUri,
            Constants.EMPTY_STRING,
            Constants.EMPTY_STRING,
            request.scopes
        );

        return tokenResponse;
    }

    private createTokenRequestBody(request: ClientCredentialRequest): string {
        const parameterBuilder = new RequestParameterBuilder();

        parameterBuilder.addClientId(this.config.authOptions.clientId);

        parameterBuilder.addScopes(request.scopes, false);

        parameterBuilder.addGrantType(GrantType.CLIENT_CREDENTIALS_GRANT);

        const correlationId = request.correlationId || this.config.cryptoInterface.createNewGuid();
        parameterBuilder.addCorrelationId(correlationId);

        if (this.config.clientCredentials) {
            if (this.config.clientCredentials.clientSecret) {
                parameterBuilder.addClientSecret(this.config.clientCredentials.clientSecret);
            }

            if (this.config.clientCredentials.clientAssertion) {
                const clientAssertion = this.config.clientCredentials.clientAssertion;
                parameterBuilder.addClientAssertion(clientAssertion.assertion);
                parameterBuilder.addClientAssertionType(clientAssertion.assertionType);
            }
        }

        if (!StringUtils.isEmpty(request.claims) || this.config.authOptions.clientCapabilities && this.config.authOptions.clientCapabilities.length > 0) {
            parameterBuilder.addClaims(request.claims, this.config.authOptions.clientCapabilities);
        }

        return parameterBuilder.createQueryString();
    }
}
