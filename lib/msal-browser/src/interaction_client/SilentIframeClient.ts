/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AuthenticationResult, ICrypto, Logger, StringUtils, PromptValue, CommonAuthorizationCodeRequest, AuthorizationCodeClient, AuthError, PerformanceEvents, Constants, IPerformanceClient } from "@azure/msal-common";
import { StandardInteractionClient } from "./StandardInteractionClient";
import { AuthorizationUrlRequest } from "../request/AuthorizationUrlRequest";
import { BrowserConfiguration } from "../config/Configuration";
import { BrowserCacheManager } from "../cache/BrowserCacheManager";
import { EventHandler } from "../event/EventHandler";
import { INavigationClient } from "../navigation/INavigationClient";
import { BrowserAuthError } from "../error/BrowserAuthError";
import { InteractionType, ApiId } from "../utils/BrowserConstants";
import { SilentHandler } from "../interaction_handler/SilentHandler";
import { SsoSilentRequest } from "../request/SsoSilentRequest";

export class SilentIframeClient extends StandardInteractionClient {
    protected apiId: ApiId;

    constructor(config: BrowserConfiguration, storageImpl: BrowserCacheManager, browserCrypto: ICrypto, logger: Logger, eventHandler: EventHandler, navigationClient: INavigationClient, apiId: ApiId, performanceClient: IPerformanceClient, correlationId?: string) {
        super(config, storageImpl, browserCrypto, logger, eventHandler, navigationClient, performanceClient, correlationId);
        this.apiId = apiId;
    }

    /**
     * Acquires a token silently by opening a hidden iframe to the /authorize endpoint with prompt=none
     * @param request
     */
    async acquireToken(request: SsoSilentRequest): Promise<AuthenticationResult> {
        this.logger.verbose("acquireTokenByIframe called");
        const acquireTokenMeasurement = this.performanceClient.startMeasurement(PerformanceEvents.SilentIframeClientAcquireToken, request.correlationId);
        // Check that we have some SSO data
        if (StringUtils.isEmpty(request.loginHint) && StringUtils.isEmpty(request.sid) && (!request.account || StringUtils.isEmpty(request.account.username))) {
            this.logger.warning("No user hint provided. The authorization server may need more information to complete this request.");
        }

        // Check that prompt is set to none, throw error if it is set to anything else.
        if (request.prompt && request.prompt !== PromptValue.NONE) {
            acquireTokenMeasurement.endMeasurement({
                success: false
            });
            throw BrowserAuthError.createSilentPromptValueError(request.prompt);
        }

        // Create silent request
        const silentRequest: AuthorizationUrlRequest = await this.initializeAuthorizationRequest({
            ...request,
            prompt: PromptValue.NONE
        }, InteractionType.Silent);
        this.browserStorage.updateCacheEntries(silentRequest.state, silentRequest.nonce, silentRequest.authority, silentRequest.loginHint || Constants.EMPTY_STRING, silentRequest.account || null);

        const serverTelemetryManager = this.initializeServerTelemetryManager(this.apiId);

        try {
            // Create auth code request and generate PKCE params
            const authCodeRequest: CommonAuthorizationCodeRequest = await this.initializeAuthorizationCodeRequest(silentRequest);

            // Initialize the client
            const authClient: AuthorizationCodeClient = await this.createAuthCodeClient(serverTelemetryManager, silentRequest.authority, silentRequest.azureCloudOptions);
            this.logger.verbose("Auth code client created");

            // Create authorize request url
            const navigateUrl = await authClient.getAuthCodeUrl(silentRequest);

            return await this.silentTokenHelper(navigateUrl, authCodeRequest, authClient, this.logger)
                .then((result: AuthenticationResult) => {
                    acquireTokenMeasurement.endMeasurement({
                        success: true,
                        fromCache: false
                    });
                    return result;
                });
        } catch (e) {
            if (e instanceof AuthError) {
                (e as AuthError).setCorrelationId(this.correlationId);
            }
            serverTelemetryManager.cacheFailedRequest(e);
            this.browserStorage.cleanRequestByState(silentRequest.state);
            acquireTokenMeasurement.endMeasurement({
                success: false
            });
            throw e;
        }
    }

    /**
     * Currently Unsupported
     */
    logout(): Promise<void> {
        // Synchronous so we must reject
        return Promise.reject(BrowserAuthError.createSilentLogoutUnsupportedError());
    }

    /**
     * Helper which acquires an authorization code silently using a hidden iframe from given url
     * using the scopes requested as part of the id, and exchanges the code for a set of OAuth tokens.
     * @param navigateUrl
     * @param userRequestScopes
     */
    protected async silentTokenHelper(navigateUrl: string, authCodeRequest: CommonAuthorizationCodeRequest, authClient: AuthorizationCodeClient, browserRequestLogger: Logger): Promise<AuthenticationResult> {
        // Create silent handler
        const silentHandler = new SilentHandler(authClient, this.browserStorage, authCodeRequest, browserRequestLogger, this.config.system.navigateFrameWait);
        // Get the frame handle for the silent request
        const msalFrame = await silentHandler.initiateAuthRequest(navigateUrl);
        // Monitor the window for the hash. Return the string value and close the popup when the hash is received. Default timeout is 60 seconds.
        const hash = await silentHandler.monitorIframeForHash(msalFrame, this.config.system.iframeHashTimeout);
        const state = this.validateAndExtractStateFromHash(hash, InteractionType.Silent, authCodeRequest.correlationId);

        // Handle response from hash string
        return silentHandler.handleCodeResponseFromHash(hash, state, authClient.authority, this.networkClient);
    }
}
