/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import axios from 'axios';
import { performance } from "perf_hooks";
import { RedisClientType } from "redis";
import {
    Configuration,
    LogLevel,
    ConfidentialClientApplication,
    AuthenticationResult,
    AuthorizationCodeRequest,
    DistributedCachePlugin,
    SilentFlowRequest,
    CryptoProvider,
    AuthorizationUrlRequest,
    AuthorizationCodePayload
} from "@azure/msal-node";
import RedisClientWrapper from "./RedisClientWrapper";
import PartitionManager from "./PartitionManager";

export type AppConfig = {
    instance: string;
    tenantId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
};

export class AuthProvider {
    private msalConfig: Configuration;
    private cryptoProvider: CryptoProvider;
    private cacheClientWrapper: RedisClientWrapper;

    private constructor(msalConfig: Configuration, cacheClient: RedisClientType) {
        this.msalConfig = msalConfig;
        this.cryptoProvider = new CryptoProvider();
        this.cacheClientWrapper = new RedisClientWrapper(cacheClient);
    }

    static async initialize(appConfig: AppConfig, cacheClient: RedisClientType): Promise<AuthProvider> {
        const msalConfig = {
            auth: {
                clientId: appConfig.clientId,
                authority: `${appConfig.instance}/${appConfig.tenantId}`,
                clientSecret: appConfig.clientSecret,
            },
            system: {
                loggerOptions: {
                    loggerCallback(loglevel, message, containsPii) {
                        console.log(message);
                    },
                    logLevel: LogLevel.Verbose,
                    piiLoggingEnabled: false
                },
                // proxyUrl: "http://localhost:8888" // uncomment to capture traffic with Fiddler
            }
        } as Configuration;

        const msalConfigWithMetadata = await AuthProvider.getMetadata(msalConfig, cacheClient);

        return new AuthProvider(msalConfigWithMetadata, cacheClient);
    }

    private getMsalInstance(sessionId: string): ConfidentialClientApplication {
        return new ConfidentialClientApplication({
            ...this.msalConfig,
            cache: {
                cachePlugin: new DistributedCachePlugin(
                    this.cacheClientWrapper,
                    new PartitionManager(this.cacheClientWrapper, sessionId) // partitionKey homeAccountId
                )
            }
        });
    }

    async prepareTokenRequest(authCodeUrlParameters: AuthorizationUrlRequest, sessionId: string, requestRoute?: string): Promise<{ authCodeUrl: string, state: string }> {

        /**
         * MSAL Node allows you to pass your custom state as state parameter in the Request object.
         * The state parameter can also be used to encode information of the app's state before redirect.
         * You can pass the user's state in the app, such as the page or view they were on, as input to this parameter.
         */
        const state = this.cryptoProvider.base64Encode(
            JSON.stringify({
                csrfToken: this.cryptoProvider.createNewGuid(), // create a GUID for csrf
                redirectTo: requestRoute || '/',
            })
        );

        const msalInstance = this.getMsalInstance(sessionId);

        try {
            const authCodeUrl = await msalInstance.getAuthCodeUrl({
                ...authCodeUrlParameters,
                state,
            });

            return { authCodeUrl, state };
        } catch (error) {
            throw error;
        }
    }

    async getTokenInteractive(tokenRequest: AuthorizationCodeRequest, authCodePayLoad: AuthorizationCodePayload, sessionId: string,): Promise<AuthenticationResult | null> {
        const msalInstance = this.getMsalInstance(sessionId);
        let tokenResponse = null;

        try {
            performance.mark("acquireTokenByCode-start");
            await msalInstance.getTokenCache().getAllAccounts(); // required for triggering beforeCacheACcess
            tokenResponse = await msalInstance.acquireTokenByCode(tokenRequest, authCodePayLoad);
            performance.mark("acquireTokenByCode-end");
            performance.measure("acquireTokenByCode", "acquireTokenByCode-start", "acquireTokenByCode-end");
        } catch (error) {
            throw error;
        }

        return tokenResponse;
    }

    async getTokenSilent(silentRequest: SilentFlowRequest, sessionId: string): Promise<AuthenticationResult | null> {
        const msalInstance = this.getMsalInstance(sessionId);
        let tokenResponse = null;

        try {
            performance.mark("acquireTokenSilent-start");
            await msalInstance.getTokenCache().getAllAccounts(); // required for triggering beforeCacheACcess
            tokenResponse = await msalInstance.acquireTokenSilent(silentRequest);
            performance.mark("acquireTokenSilent-end");
            performance.measure("acquireTokenSilent", "acquireTokenSilent-start", "acquireTokenSilent-end");
        } catch (error) {
            throw error;
        }

        return tokenResponse;
    }

    private static async getMetadata(msalConfig: Configuration, cacheClient: RedisClientType): Promise<Configuration> {
        const msalConfigWithMetadata = msalConfig;
        const clientId = msalConfigWithMetadata.auth.clientId;
        const tenantId = msalConfigWithMetadata.auth.authority!.split("/").pop()!;

        try {
            let [cloudDiscoveryMetadata, authorityMetadata] = await Promise.all([
                cacheClient.get(`${clientId}.${tenantId}.discovery-metadata`),
                cacheClient.get(`${clientId}.${tenantId}.authority-metadata`)
            ]);

            if (!cloudDiscoveryMetadata || !authorityMetadata) {
                [cloudDiscoveryMetadata, authorityMetadata] = await Promise.all([
                    AuthProvider.fetchCloudDiscoveryMetadata(tenantId),
                    AuthProvider.fetchAuthorityMetadata(tenantId)
                ]);

                if (cloudDiscoveryMetadata && authorityMetadata) {
                    await cacheClient.set(`${clientId}.${tenantId}.discovery-metadata`, JSON.stringify(cloudDiscoveryMetadata));
                    await cacheClient.set(`${clientId}.${tenantId}.authority-metadata`, JSON.stringify(authorityMetadata));
                }
            }

            msalConfigWithMetadata.auth.cloudDiscoveryMetadata = typeof cloudDiscoveryMetadata === 'string' ? cloudDiscoveryMetadata : JSON.stringify(cloudDiscoveryMetadata);
            msalConfigWithMetadata.auth.authorityMetadata = typeof authorityMetadata === 'string' ? authorityMetadata : JSON.stringify(authorityMetadata);
        } catch (error) {
            console.log(error);
        }

        return msalConfigWithMetadata;
    }

    private static async fetchCloudDiscoveryMetadata(tenantId: string): Promise<any> {
        const endpoint = 'https://login.microsoftonline.com/common/discovery/instance';

        try {
            const response = await axios.get(endpoint, {
                params: {
                    'api-version': '1.1',
                    'authorization_endpoint': `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
                }
            });
            return await response.data;
        } catch (error) {
            console.log(error);
        }
    }

    private static async fetchAuthorityMetadata(tenantId: string): Promise<any> {
        const endpoint = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;

        try {
            const response = await axios.get(endpoint);
            return await response.data;
        } catch (error) {
            console.log(error);
        }
    }
}
