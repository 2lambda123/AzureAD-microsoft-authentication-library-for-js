/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import sinon from "sinon";
import { PublicClientApplication } from "../../src/app/PublicClientApplication";
import {
    TEST_CONFIG,
    TEST_TOKENS,
    TEST_DATA_CLIENT_INFO,
    TEST_TOKEN_LIFETIMES,
    RANDOM_TEST_GUID,
    TEST_TOKEN_RESPONSE,
} from "../utils/StringConstants";
import {
    Constants,
    AccountInfo,
    TokenClaims,
    AuthenticationResult,
    AuthenticationScheme,
    RefreshTokenClient,
    CommonSilentFlowRequest,
    NetworkManager,
    RefreshTokenEntity,
    AccountEntity,
} from "@azure/msal-common";
import { CryptoOps } from "../../src/crypto/CryptoOps";
import { BrowserAuthError } from "../../src/error/BrowserAuthError";
import { SilentRefreshClient } from "../../src/interaction_client/SilentRefreshClient";
import { BrowserCacheManager } from "../../src/internals";
import { CLIENT_INFO } from "@azure/msal-common/dist/utils/Constants";

const testIdTokenClaims: TokenClaims = {
    ver: "2.0",
    iss: "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
    sub: "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
    name: "Abe Lincoln",
    preferred_username: "AbeLi@microsoft.com",
    oid: "00000000-0000-0000-66f3-3332eca7ea81",
    tid: "3338040d-6c67-4c5b-b112-36a304b66dad",
    nonce: "123523",
};
const testAccount: AccountInfo = {
    homeAccountId: TEST_DATA_CLIENT_INFO.TEST_HOME_ACCOUNT_ID,
    localAccountId: TEST_DATA_CLIENT_INFO.TEST_UID,
    environment: "login.windows.net",
    tenantId: testIdTokenClaims.tid || "",
    username: testIdTokenClaims.preferred_username || "",
};

describe("SilentRefreshClient", () => {
    let silentRefreshClient: SilentRefreshClient;
    let browserCacheManager: BrowserCacheManager

    beforeEach(() => {
        let pca = new PublicClientApplication({
            auth: {
                clientId: TEST_CONFIG.MSAL_CLIENT_ID,
            },
        });

        //Implementation of PCA was moved to controller.
        pca = (pca as any).controller;

        //@ts-ignore
        browserCacheManager = pca.browserStorage;

        sinon
            .stub(CryptoOps.prototype, "createNewGuid")
            .returns(RANDOM_TEST_GUID);
        // @ts-ignore
        silentRefreshClient = new SilentRefreshClient(
            //@ts-ignore
            pca.config,
            //@ts-ignore
            pca.browserStorage,
            //@ts-ignore
            pca.browserCrypto,
            //@ts-ignore
            pca.logger,
            //@ts-ignore
            pca.eventHandler,
            //@ts-ignore
            pca.navigationClient,
            //@ts-ignore
            pca.performanceClient
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
        sinon.restore();
        window.location.hash = "";
        window.sessionStorage.clear();
        window.localStorage.clear();
    });

    describe("acquireToken", () => {
        it("successfully renews token", async () => {
            const testServerTokenResponse = {
                token_type: TEST_CONFIG.TOKEN_TYPE_BEARER,
                scope: TEST_CONFIG.DEFAULT_SCOPES.join(" "),
                expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                ext_expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                access_token: TEST_TOKENS.ACCESS_TOKEN,
                refresh_token: TEST_TOKENS.REFRESH_TOKEN,
                id_token: TEST_TOKENS.IDTOKEN_V2,
            };
            const testTokenResponse: AuthenticationResult = {
                authority: TEST_CONFIG.validAuthority,
                uniqueId: testIdTokenClaims.oid || "",
                tenantId: testIdTokenClaims.tid || "",
                scopes: ["scope1"],
                idToken: testServerTokenResponse.id_token,
                idTokenClaims: testIdTokenClaims,
                accessToken: testServerTokenResponse.access_token,
                fromCache: false,
                correlationId: RANDOM_TEST_GUID,
                expiresOn: new Date(
                    Date.now() + testServerTokenResponse.expires_in * 1000
                ),
                account: testAccount,
                tokenType: AuthenticationScheme.BEARER,
            };
            const silentATStub = sinon
                .stub(
                    RefreshTokenClient.prototype,
                    <any>"acquireTokenByRefreshToken"
                )
                .resolves(testTokenResponse);
            const tokenRequest: CommonSilentFlowRequest = {
                scopes: ["scope1"],
                account: testAccount,
                authority: TEST_CONFIG.validAuthority,
                authenticationScheme: AuthenticationScheme.BEARER,
                correlationId: TEST_CONFIG.CORRELATION_ID,
                forceRefresh: false,
            };
            const expectedTokenRequest: CommonSilentFlowRequest = {
                ...tokenRequest,
                scopes: ["scope1"],
                authority: `${Constants.DEFAULT_AUTHORITY}`,
                correlationId: RANDOM_TEST_GUID,
                forceRefresh: false,
            };
            const tokenResp = await silentRefreshClient.acquireToken(
                tokenRequest
            );
            expect(silentATStub.calledWith(expectedTokenRequest)).toBeTruthy();
            expect(tokenResp).toEqual(testTokenResponse);
        });

        describe("storeInCache tests", () => {
            beforeEach(() => {
                const rtEntity = new RefreshTokenEntity();
                rtEntity.secret = TEST_TOKEN_RESPONSE.body.refresh_token!;
                const accountEntity = new AccountEntity();
                jest.spyOn(BrowserCacheManager.prototype, "getAccount").mockReturnValue(accountEntity);
                jest.spyOn(BrowserCacheManager.prototype, "getRefreshToken").mockReturnValue(rtEntity);
                jest.spyOn(NetworkManager.prototype, "sendPostRequest").mockResolvedValue(TEST_TOKEN_RESPONSE);
            });

            it("does not store idToken if storeInCache.idToken = false", async () => {
                const tokenResp = await silentRefreshClient.acquireToken({
                    authority: TEST_CONFIG.validAuthority,
                    correlationId: TEST_CONFIG.CORRELATION_ID,
                    account: testAccount,
                    forceRefresh: true,
                    scopes: TEST_CONFIG.DEFAULT_SCOPES,
                    storeInCache: {
                        idToken: false
                    }
                });

                // Response should still contain acquired tokens
                expect(tokenResp.idToken).toEqual(TEST_TOKEN_RESPONSE.body.id_token);
                expect(tokenResp.accessToken).toEqual(TEST_TOKEN_RESPONSE.body.access_token);

                // Cache should not contain tokens which were turned off
                const tokenKeys = browserCacheManager.getTokenKeys();
                expect(tokenKeys.idToken).toHaveLength(0);
                expect(tokenKeys.accessToken).toHaveLength(1);
                expect(tokenKeys.refreshToken).toHaveLength(1);
            });

            it("does not store accessToken if storeInCache.accessToken = false", async () => {
                const tokenResp = await silentRefreshClient.acquireToken({
                    authority: TEST_CONFIG.validAuthority,
                    correlationId: TEST_CONFIG.CORRELATION_ID,
                    account: testAccount,
                    forceRefresh: true,
                    scopes: TEST_CONFIG.DEFAULT_SCOPES,
                    storeInCache: {
                        accessToken: false
                    }
                });
                
                // Response should still contain acquired tokens
                expect(tokenResp.idToken).toEqual(TEST_TOKEN_RESPONSE.body.id_token);
                expect(tokenResp.accessToken).toEqual(TEST_TOKEN_RESPONSE.body.access_token);

                // Cache should not contain tokens which were turned off
                const tokenKeys = browserCacheManager.getTokenKeys();
                expect(tokenKeys.idToken).toHaveLength(1);
                expect(tokenKeys.accessToken).toHaveLength(0);
                expect(tokenKeys.refreshToken).toHaveLength(1);
            });

            it("does not store refreshToken if storeInCache.refreshToken = false", async () => {
                const tokenResp = await silentRefreshClient.acquireToken({
                    authority: TEST_CONFIG.validAuthority,
                    correlationId: TEST_CONFIG.CORRELATION_ID,
                    account: testAccount,
                    forceRefresh: true,
                    scopes: TEST_CONFIG.DEFAULT_SCOPES,
                    storeInCache: {
                        refreshToken: false
                    }
                });
                
                // Response should still contain acquired tokens
                expect(tokenResp.idToken).toEqual(TEST_TOKEN_RESPONSE.body.id_token);
                expect(tokenResp.accessToken).toEqual(TEST_TOKEN_RESPONSE.body.access_token);

                // Cache should not contain tokens which were turned off
                const tokenKeys = browserCacheManager.getTokenKeys();
                expect(tokenKeys.idToken).toHaveLength(1);
                expect(tokenKeys.accessToken).toHaveLength(1);
                expect(tokenKeys.refreshToken).toHaveLength(0);
            });
        });
    });

    describe("logout", () => {
        it("logout throws unsupported error", async () => {
            await expect(silentRefreshClient.logout).rejects.toMatchObject(
                BrowserAuthError.createSilentLogoutUnsupportedError()
            );
        });
    });
});
