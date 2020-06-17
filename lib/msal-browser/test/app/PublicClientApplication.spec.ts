import * as Mocha from "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;
import sinon from "sinon";
import { PublicClientApplication } from "../../src/app/PublicClientApplication";
import { TEST_CONFIG, TEST_URIS, TEST_HASHES, TEST_TOKENS, TEST_DATA_CLIENT_INFO, TEST_TOKEN_LIFETIMES, RANDOM_TEST_GUID, DEFAULT_OPENID_CONFIG_RESPONSE, testNavUrl, testLogoutUrl } from "../utils/StringConstants";
import { AuthError, ServerError, LogLevel, Constants, IAccount, IdTokenClaims, SPAClient, PromptValue, AuthenticationResult, AuthorizationCodeRequest, AuthorizationUrlRequest, IdToken, PersistentCacheKeys, ClientAuthErrorMessage, SilentFlowRequest } from "@azure/msal-common";
import { AuthCallback } from "../../src/types/AuthCallback";
import { BrowserConfigurationAuthErrorMessage, BrowserConfigurationAuthError } from "../../src/error/BrowserConfigurationAuthError";
import { BrowserUtils } from "../../src/utils/BrowserUtils";
import { BrowserConstants, TemporaryCacheKeys } from "../../src/utils/BrowserConstants";
import { Base64Encode } from "../../src/encode/Base64Encode";
import { XhrClient } from "../../src/network/XhrClient";
import { BrowserAuthErrorMessage, BrowserAuthError } from "../../src/error/BrowserAuthError";
import { RedirectHandler } from "../../src/interaction_handler/RedirectHandler";
import { PopupHandler } from "../../src/interaction_handler/PopupHandler";
import { SilentHandler } from "../../src/interaction_handler/SilentHandler";
import { BrowserStorage } from "../../src/cache/BrowserStorage";
import { CryptoOps } from "../../src/crypto/CryptoOps";

describe("PublicClientApplication.ts Class Unit Tests", () => {

    const testLoggerCallback = (level: LogLevel, message: string, containsPii: boolean): void => {
        if (containsPii) {
            console.log(`Log level: ${level} Message: ${message}`);
        }
    };

    const authCallback: AuthCallback = (authErr: AuthError, response: AuthenticationResult) => {
        if (authErr) {
            expect(authErr instanceof AuthError, `${authErr}`).to.be.true;
        } else if (response) {
            console.log(response);
        } else {
            console.log("This shouldn't print, check the test");
        }
	};
	
	const cacheConfig = {
		cacheLocation: BrowserConstants.CACHE_LOCATION_SESSION,
		storeAuthStateInCookie: false
	};

    let pca: PublicClientApplication;
    beforeEach(() => {
        pca = new PublicClientApplication({
            auth: {
                clientId: TEST_CONFIG.MSAL_CLIENT_ID
            }
        });
    });

    afterEach(() => {
        sinon.restore();
        window.location.hash = "";
        window.sessionStorage.clear();
        window.localStorage.clear();
    });

    describe("Constructor tests", () => {

        it("passes null check", () => {
            expect(pca).to.be.not.null;
            expect(pca instanceof PublicClientApplication).to.be.true;
        });

        it("navigates and caches hash if navigateToLoginRequestUri is true", () => {
            window.location.hash = TEST_HASHES.TEST_SUCCESS_CODE_HASH;
            window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.ORIGIN_URI}`, TEST_URIS.TEST_REDIR_URI);
            sinon.stub(BrowserUtils, "getCurrentUri").returns("notAUri");
            sinon.stub(BrowserUtils, "navigateWindow").callsFake((urlNavigate: string, noHistory?: boolean) => {
                expect(noHistory).to.be.true;
                expect(urlNavigate).to.be.eq(TEST_URIS.TEST_REDIR_URI);
            });
            pca = new PublicClientApplication({
                auth: {
                    clientId: TEST_CONFIG.MSAL_CLIENT_ID
                }
            });
            expect(window.sessionStorage.getItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.URL_HASH}`)).to.be.eq(TEST_HASHES.TEST_SUCCESS_CODE_HASH);
        });

        it("ADFS authority throws error", () => {

            expect(() =>{
                new PublicClientApplication({
                    auth: {
                        clientId: TEST_CONFIG.MSAL_CLIENT_ID,
                        authority: TEST_CONFIG.ADFS_AUTHORITY
                    }
                });

            }).to.throw(ClientAuthErrorMessage.invalidAuthorityType.desc);

        });
    });

    describe("Redirect Flow Unit tests", () => {

        describe("handleRedirectCallback()", () => {

            it("throws error if callback is not valid", async () => {
                await expect(pca.handleRedirectCallback(null)).rejectedWith(BrowserConfigurationAuthErrorMessage.invalidCallbackObject.desc);
                await expect(pca.handleRedirectCallback(null)).rejectedWith(BrowserConfigurationAuthError);
            });

            it("does nothing if no hash is detected", () => {
                pca.handleRedirectCallback(authCallback);
                expect(window.localStorage.length).to.be.eq(0);
                expect(window.sessionStorage.length).to.be.eq(0);
            });

            it("gets hash from cache and processes response", async () => {
                const b64Encode = new Base64Encode();
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.ORIGIN_URI}`, TEST_URIS.TEST_REDIR_URI);
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.REQUEST_STATE}`, RANDOM_TEST_GUID);
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.URL_HASH}`, TEST_HASHES.TEST_SUCCESS_CODE_HASH);
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${BrowserConstants.INTERACTION_STATUS_KEY}`, BrowserConstants.INTERACTION_IN_PROGRESS_VALUE);
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.NONCE_IDTOKEN}${Constants.RESOURCE_DELIM}${RANDOM_TEST_GUID}`, "123523");
                const testTokenReq: AuthorizationCodeRequest = {
					redirectUri: `${TEST_URIS.DEFAULT_INSTANCE}/`,
					code: "thisIsATestCode",
                    scopes: TEST_CONFIG.DEFAULT_SCOPES,
                    codeVerifier: TEST_CONFIG.TEST_VERIFIER,
                    authority: `${Constants.DEFAULT_AUTHORITY}/`,
                    correlationId: RANDOM_TEST_GUID
                };
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.REQUEST_PARAMS}`, b64Encode.encode(JSON.stringify(testTokenReq)));
                const testServerTokenResponse = {
                    headers: null,
                    status: 200,
                    body: {
                        token_type: TEST_CONFIG.TOKEN_TYPE_BEARER,
                        scope: TEST_CONFIG.DEFAULT_SCOPES.join(" "),
                        expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                        ext_expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                        access_token: TEST_TOKENS.ACCESS_TOKEN,
                        refresh_token: TEST_TOKENS.REFRESH_TOKEN,
                        id_token: TEST_TOKENS.IDTOKEN_V2,
                        client_info: TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO
                    }
                };
                const testIdTokenClaims: IdTokenClaims = {
                    "ver": "2.0",
                    "iss": "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
                    "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
                    "name": "Abe Lincoln",
                    "preferred_username": "AbeLi@microsoft.com",
                    "oid": "00000000-0000-0000-66f3-3332eca7ea81",
                    "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
                    "nonce": "123523",
                };
                const testAccount: IAccount = {
                    homeAccountId: TEST_DATA_CLIENT_INFO.TEST_HOME_ACCOUNT_ID,
                    environment: "login.windows.net",
                    tenantId: testIdTokenClaims.tid,
                    username: testIdTokenClaims.preferred_username
                };
                const testTokenResponse: AuthenticationResult = {
                    uniqueId: testIdTokenClaims.oid,
                    tenantId: testIdTokenClaims.tid,
                    scopes: TEST_CONFIG.DEFAULT_SCOPES,
                    idToken: testServerTokenResponse.body.id_token,
                    idTokenClaims: testIdTokenClaims,
                    accessToken: testServerTokenResponse.body.access_token,
                    expiresOn: new Date(Date.now() + (testServerTokenResponse.body.expires_in * 1000)),
                    account: testAccount
                };
                sinon.stub(XhrClient.prototype, "sendGetRequestAsync").resolves(DEFAULT_OPENID_CONFIG_RESPONSE);
                sinon.stub(XhrClient.prototype, "sendPostRequestAsync").resolves(testServerTokenResponse);
                pca = new PublicClientApplication({
                    auth: {
                        clientId: TEST_CONFIG.MSAL_CLIENT_ID
                    }
                });

                const tokenResponse = await pca.handleRedirectPromise();
                expect(tokenResponse.uniqueId).to.be.eq(testTokenResponse.uniqueId);
                expect(tokenResponse.tenantId).to.be.eq(testTokenResponse.tenantId);
                expect(tokenResponse.scopes).to.be.deep.eq(testTokenResponse.scopes);
                expect(tokenResponse.idToken).to.be.eq(testTokenResponse.idToken);
                expect(tokenResponse.idTokenClaims).to.be.contain(testTokenResponse.idTokenClaims);
                expect(tokenResponse.accessToken).to.be.eq(testTokenResponse.accessToken);
                // expect(testTokenResponse.expiresOn.getMilliseconds() >= tokenResponse.expiresOn.getMilliseconds()).to.be.true;
                expect(window.sessionStorage.length).to.be.eq(4);
            });

            it("gets hash from cache and processes error", (done) => {
				const testAuthCodeRequest: AuthorizationCodeRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: ["scope1", "scope2"],
					code: ""
				};
				const browserCrypto = new CryptoOps();
				window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.REQUEST_PARAMS}`, browserCrypto.base64Encode(JSON.stringify(testAuthCodeRequest)));
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.ORIGIN_URI}`, TEST_URIS.TEST_REDIR_URI);
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.REQUEST_STATE}`, RANDOM_TEST_GUID);
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.URL_HASH}`, TEST_HASHES.TEST_ERROR_HASH);
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${BrowserConstants.INTERACTION_STATUS_KEY}`, BrowserConstants.INTERACTION_IN_PROGRESS_VALUE);

				pca = new PublicClientApplication({
					auth: {
						clientId: TEST_CONFIG.MSAL_CLIENT_ID
					}
				});
				pca.handleRedirectCallback((authErr: AuthError, response: AuthenticationResult) => {
					expect(response).to.be.undefined;
					expect(authErr instanceof ServerError).to.be.true;
					done();
                });
            });

            it("processes hash if navigateToLoginRequestUri is false", (done) => {
                const b64Encode = new Base64Encode();
                window.location.hash = TEST_HASHES.TEST_SUCCESS_CODE_HASH;
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.ORIGIN_URI}`, TEST_URIS.TEST_REDIR_URI);
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.REQUEST_STATE}`, RANDOM_TEST_GUID);
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${BrowserConstants.INTERACTION_STATUS_KEY}`, BrowserConstants.INTERACTION_IN_PROGRESS_VALUE);
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.NONCE_IDTOKEN}${Constants.RESOURCE_DELIM}${RANDOM_TEST_GUID}`, "123523");
                const testTokenReq: AuthorizationCodeRequest = {
					redirectUri: `${TEST_URIS.DEFAULT_INSTANCE}/`,
					code: "thisIsATestCode",
                    scopes: TEST_CONFIG.DEFAULT_SCOPES,
                    codeVerifier: TEST_CONFIG.TEST_VERIFIER,
                    authority: `${Constants.DEFAULT_AUTHORITY}/`,
                    correlationId: RANDOM_TEST_GUID
                };
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${TemporaryCacheKeys.REQUEST_PARAMS}`, b64Encode.encode(JSON.stringify(testTokenReq)));
                const testServerTokenResponse = {
                    headers: null,
                    status: 200,
                    body: {
                        token_type: TEST_CONFIG.TOKEN_TYPE_BEARER,
                        scope: TEST_CONFIG.DEFAULT_SCOPES.join(" "),
                        expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                        ext_expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                        access_token: TEST_TOKENS.ACCESS_TOKEN,
                        refresh_token: TEST_TOKENS.REFRESH_TOKEN,
                        id_token: TEST_TOKENS.IDTOKEN_V2,
                        client_info: TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO
                    }
                };
                const testIdTokenClaims: IdTokenClaims = {
                    "ver": "2.0",
                    "iss": "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
                    "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
                    "name": "Abe Lincoln",
                    "preferred_username": "AbeLi@microsoft.com",
                    "oid": "00000000-0000-0000-66f3-3332eca7ea81",
                    "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
                    "nonce": "123523",
                };
                const testAccount: IAccount = {
                    homeAccountId: TEST_DATA_CLIENT_INFO.TEST_HOME_ACCOUNT_ID,
                    environment: "login.windows.net",
                    tenantId: testIdTokenClaims.tid,
                    username: testIdTokenClaims.preferred_username
                };
                const testTokenResponse: AuthenticationResult = {
                    uniqueId: testIdTokenClaims.oid,
                    tenantId: testIdTokenClaims.tid,
                    scopes: TEST_CONFIG.DEFAULT_SCOPES,
                    idToken: testServerTokenResponse.body.id_token,
                    idTokenClaims: testIdTokenClaims,
                    accessToken: testServerTokenResponse.body.access_token,
                    expiresOn: new Date(Date.now() + (testServerTokenResponse.body.expires_in * 1000)),
                    account: testAccount
                };
                sinon.stub(XhrClient.prototype, "sendGetRequestAsync").resolves(DEFAULT_OPENID_CONFIG_RESPONSE);
                sinon.stub(XhrClient.prototype, "sendPostRequestAsync").resolves(testServerTokenResponse);
                pca = new PublicClientApplication({
                    auth: {
                        clientId: TEST_CONFIG.MSAL_CLIENT_ID,
                        navigateToLoginRequestUrl: false
                    }
                });
                pca.handleRedirectCallback((authErr: AuthError, tokenResponse: AuthenticationResult) => {
                    if (authErr) {
                        console.error(authErr);
                        return;
                    }
                    expect(tokenResponse.uniqueId).to.be.eq(testTokenResponse.uniqueId);
                    expect(tokenResponse.tenantId).to.be.eq(testTokenResponse.tenantId);
                    expect(tokenResponse.scopes).to.be.deep.eq(testTokenResponse.scopes);
                    expect(tokenResponse.idToken).to.be.eq(testTokenResponse.idToken);
                    expect(tokenResponse.idTokenClaims).to.be.contain(testTokenResponse.idTokenClaims);
                    expect(tokenResponse.accessToken).to.be.eq(testTokenResponse.accessToken);
                    // expect(testTokenResponse.expiresOn.getMilliseconds() >= tokenResponse.expiresOn.getMilliseconds()).to.be.true;
                    expect(window.sessionStorage.length).to.be.eq(4);
                    expect(window.location.hash).to.be.empty;
                    done();
                });
            });
        });

        describe("loginRedirect", () => {

            it("loginRedirect throws an error if interaction is currently in progress", async () => {
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${BrowserConstants.INTERACTION_STATUS_KEY}`, BrowserConstants.INTERACTION_IN_PROGRESS_VALUE);
				await expect(pca.loginRedirect(null)).to.be.rejectedWith(BrowserAuthErrorMessage.interactionInProgress.desc);
				await expect(pca.loginRedirect(null)).to.be.rejectedWith(BrowserAuthError);
            });

            it("loginRedirect navigates to created login url", (done) => {
                sinon.stub(RedirectHandler.prototype, "initiateAuthRequest").callsFake((navigateUrl): Window => {
					expect(navigateUrl).to.be.eq(testNavUrl);
					done();
                    return window;
				});
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
				const loginRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: ["user.read", TEST_CONFIG.MSAL_CLIENT_ID]
				};
                pca.loginRedirect(loginRequest);
            });

			it("Updates cache entries correctly", async () => {
				const emptyRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: []
				};
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
				sinon.stub(BrowserUtils, "navigateWindow").callsFake((urlNavigate: string, noHistory?: boolean) => {
					expect(noHistory).to.be.undefined;
					expect(urlNavigate).to.be.not.empty;
				});
				const browserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, cacheConfig);
				await pca.loginRedirect(emptyRequest);
				expect(browserStorage.getItem(TemporaryCacheKeys.REQUEST_STATE)).to.be.deep.eq(RANDOM_TEST_GUID);
				expect(browserStorage.getItem(`${TemporaryCacheKeys.NONCE_IDTOKEN}|${RANDOM_TEST_GUID}`)).to.be.eq(RANDOM_TEST_GUID);
				expect(browserStorage.getItem(`${TemporaryCacheKeys.AUTHORITY}|${RANDOM_TEST_GUID}`)).to.be.eq(`${Constants.DEFAULT_AUTHORITY}/`);
			});

			it("Caches token request correctly", async () => {
				const tokenRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: [TEST_CONFIG.MSAL_CLIENT_ID],
					correlationId: RANDOM_TEST_GUID
				};
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
				sinon.stub(BrowserUtils, "navigateWindow").callsFake((urlNavigate: string, noHistory?: boolean) => {
					expect(noHistory).to.be.undefined;
					expect(urlNavigate).to.be.not.empty;
				});
				const browserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, cacheConfig);
				const browserCrypto = new CryptoOps();
				await pca.loginRedirect(tokenRequest);
				const cachedRequest: AuthorizationCodeRequest = JSON.parse(browserCrypto.base64Decode(browserStorage.getItem(TemporaryCacheKeys.REQUEST_PARAMS)));
				expect(cachedRequest.scopes).to.be.deep.eq([TEST_CONFIG.MSAL_CLIENT_ID]);
				expect(cachedRequest.codeVerifier).to.be.deep.eq(TEST_CONFIG.TEST_VERIFIER);
				expect(cachedRequest.authority).to.be.deep.eq(`${Constants.DEFAULT_AUTHORITY}/`);
				expect(cachedRequest.correlationId).to.be.deep.eq(RANDOM_TEST_GUID);
			});

			it("Cleans cache before error is thrown", async () => {
				const emptyRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: []
				};
				const browserStorage: BrowserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, cacheConfig);
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				const loginUrlErr = "loginUrlErr";
				sinon.stub(SPAClient.prototype, "createLoginUrl").throws(new BrowserAuthError(loginUrlErr));
				await expect(pca.loginRedirect(emptyRequest)).to.be.rejectedWith(loginUrlErr);
				await expect(pca.loginRedirect(emptyRequest)).to.be.rejectedWith(BrowserAuthError);
				expect(browserStorage.getKeys()).to.be.empty;
			});

			it("Uses adal token from cache if it is present.", async () => {
				const idTokenClaims: IdTokenClaims = {
					"iss": "https://sts.windows.net/fa15d692-e9c7-4460-a743-29f2956fd429/",
					"exp": "1536279024",
					"name": "abeli",
					"nonce": "123523",
					"oid": "05833b6b-aa1d-42d4-9ec0-1b2bb9194438",
					"sub": "5_J9rSss8-jvt_Icu6ueRNL8xXb8LF4Fsg_KooC2RJQ",
					"tid": "fa15d692-e9c7-4460-a743-29f2956fd429",
					"ver": "1.0",
					"upn": "AbeLincoln@contoso.com"
				};
				sinon.stub(IdToken, "extractIdToken").returns(idTokenClaims);
				const browserStorage: BrowserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, cacheConfig);
				browserStorage.setItem(PersistentCacheKeys.ADAL_ID_TOKEN, TEST_TOKENS.IDTOKEN_V1);
				const loginUrlSpy = sinon.spy(SPAClient.prototype, "createLoginUrl");
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
				sinon.stub(BrowserUtils, "navigateWindow").callsFake((urlNavigate: string, noHistory?: boolean) => {
					expect(noHistory).to.be.undefined;
					expect(urlNavigate).to.be.not.empty;
				});
				const emptyRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: []
				};
				await pca.loginRedirect(emptyRequest);
				const validatedRequest: AuthorizationUrlRequest = {
					...emptyRequest,
					loginHint: idTokenClaims.upn,
					state: RANDOM_TEST_GUID,
					correlationId: RANDOM_TEST_GUID,
					authority: `${Constants.DEFAULT_AUTHORITY}/`,
					nonce: RANDOM_TEST_GUID,
					codeChallenge: TEST_CONFIG.TEST_CHALLENGE,
					codeChallengeMethod: Constants.S256_CODE_CHALLENGE_METHOD
				};
				expect(loginUrlSpy.calledWith(validatedRequest)).to.be.true;
			});
	
			it("Does not use adal token from cache if it is present and SSO params have been given.", async () => {
				const idTokenClaims: IdTokenClaims = {
					"iss": "https://sts.windows.net/fa15d692-e9c7-4460-a743-29f2956fd429/",
					"exp": "1536279024",
					"name": "abeli",
					"nonce": "123523",
					"oid": "05833b6b-aa1d-42d4-9ec0-1b2bb9194438",
					"sub": "5_J9rSss8-jvt_Icu6ueRNL8xXb8LF4Fsg_KooC2RJQ",
					"tid": "fa15d692-e9c7-4460-a743-29f2956fd429",
					"ver": "1.0",
					"upn": "AbeLincoln@contoso.com"
				};
				sinon.stub(IdToken, "extractIdToken").returns(idTokenClaims);
				const browserStorage: BrowserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, cacheConfig);
				browserStorage.setItem(PersistentCacheKeys.ADAL_ID_TOKEN, TEST_TOKENS.IDTOKEN_V1);
				const loginUrlSpy = sinon.spy(SPAClient.prototype, "createLoginUrl");
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
				sinon.stub(BrowserUtils, "navigateWindow").callsFake((urlNavigate: string, noHistory?: boolean) => {
					expect(noHistory).to.be.undefined;
					expect(urlNavigate).to.be.not.empty;
				});
				const loginRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: [],
					loginHint: "AbeLi@microsoft.com"
				};
				await pca.loginRedirect(loginRequest);
				const validatedRequest: AuthorizationUrlRequest = {
					...loginRequest,
					state: RANDOM_TEST_GUID,
					correlationId: RANDOM_TEST_GUID,
					authority: `${Constants.DEFAULT_AUTHORITY}/`,
					nonce: RANDOM_TEST_GUID,
					codeChallenge: TEST_CONFIG.TEST_CHALLENGE,
					codeChallengeMethod: Constants.S256_CODE_CHALLENGE_METHOD
				};
				expect(loginUrlSpy.calledWith(validatedRequest)).to.be.true;
			});
        });

        describe("acquireTokenRedirect", () => {

            it("acquireTokenRedirect throws an error if interaction is currently in progress", async () => {
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${BrowserConstants.INTERACTION_STATUS_KEY}`, BrowserConstants.INTERACTION_IN_PROGRESS_VALUE);
                await expect(pca.acquireTokenRedirect(null)).to.be.rejectedWith(BrowserAuthErrorMessage.interactionInProgress.desc);
				await expect(pca.acquireTokenRedirect(null)).to.be.rejectedWith(BrowserAuthError);
            });

            it("acquireTokenRedirect navigates to created login url", (done) => {
                sinon.stub(RedirectHandler.prototype, "initiateAuthRequest").callsFake((navigateUrl): Window => {
					expect(navigateUrl).to.be.eq(testNavUrl);
					done();
                    return window;
				});
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
				const loginRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: ["user.read", TEST_CONFIG.MSAL_CLIENT_ID]
				};
                pca.acquireTokenRedirect(loginRequest);
            });

			it("Updates cache entries correctly", async () => {
				const testScope = "testscope";
				const emptyRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: [testScope]
				};
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
				sinon.stub(BrowserUtils, "navigateWindow").callsFake((urlNavigate: string, noHistory?: boolean) => {
					expect(noHistory).to.be.undefined;
					expect(urlNavigate).to.be.not.empty;
				});
				const browserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, cacheConfig);
				await pca.loginRedirect(emptyRequest);
				expect(browserStorage.getItem(TemporaryCacheKeys.REQUEST_STATE)).to.be.deep.eq(RANDOM_TEST_GUID);
				expect(browserStorage.getItem(`${TemporaryCacheKeys.NONCE_IDTOKEN}|${RANDOM_TEST_GUID}`)).to.be.eq(RANDOM_TEST_GUID);
				expect(browserStorage.getItem(`${TemporaryCacheKeys.AUTHORITY}|${RANDOM_TEST_GUID}`)).to.be.eq(`${Constants.DEFAULT_AUTHORITY}/`);
			});
	
			it("Caches token request correctly", async () => {
				const testScope = "testscope";
				const tokenRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: [testScope],
					correlationId: RANDOM_TEST_GUID
				};
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
				sinon.stub(BrowserUtils, "navigateWindow").callsFake((urlNavigate: string, noHistory?: boolean) => {
					expect(noHistory).to.be.undefined;
					expect(urlNavigate).to.be.not.empty;
				});
				const browserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, cacheConfig);
				const browserCrypto = new CryptoOps();
				await pca.acquireTokenRedirect(tokenRequest);
				const cachedRequest: AuthorizationCodeRequest = JSON.parse(browserCrypto.base64Decode(browserStorage.getItem(TemporaryCacheKeys.REQUEST_PARAMS)));
				expect(cachedRequest.scopes).to.be.deep.eq([testScope]);
				expect(cachedRequest.codeVerifier).to.be.deep.eq(TEST_CONFIG.TEST_VERIFIER);
				expect(cachedRequest.authority).to.be.deep.eq(`${Constants.DEFAULT_AUTHORITY}/`);
				expect(cachedRequest.correlationId).to.be.deep.eq(RANDOM_TEST_GUID);
			});

			it("Cleans cache before error is thrown", async () => {
				const testScope = "testscope";
				const emptyRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: [testScope]
				};
				const browserStorage: BrowserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, cacheConfig);
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				const loginUrlErr = "loginUrlErr";
				sinon.stub(SPAClient.prototype, "createAcquireTokenUrl").throws(new BrowserAuthError(loginUrlErr));
				await expect(pca.acquireTokenRedirect(emptyRequest)).to.be.rejectedWith(loginUrlErr);
				await expect(pca.acquireTokenRedirect(emptyRequest)).to.be.rejectedWith(BrowserAuthError);
				expect(browserStorage.getKeys()).to.be.empty;
			});

			it("Uses adal token from cache if it is present.", async () => {
				const testScope = "testscope";
				const idTokenClaims: IdTokenClaims = {
					"iss": "https://sts.windows.net/fa15d692-e9c7-4460-a743-29f2956fd429/",
					"exp": "1536279024",
					"name": "abeli",
					"nonce": "123523",
					"oid": "05833b6b-aa1d-42d4-9ec0-1b2bb9194438",
					"sub": "5_J9rSss8-jvt_Icu6ueRNL8xXb8LF4Fsg_KooC2RJQ",
					"tid": "fa15d692-e9c7-4460-a743-29f2956fd429",
					"ver": "1.0",
					"upn": "AbeLincoln@contoso.com"
				};
				sinon.stub(IdToken, "extractIdToken").returns(idTokenClaims);
				const browserStorage: BrowserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, cacheConfig);
				browserStorage.setItem(PersistentCacheKeys.ADAL_ID_TOKEN, TEST_TOKENS.IDTOKEN_V1);
				const acquireTokenUrlSpy = sinon.spy(SPAClient.prototype, "createAcquireTokenUrl");
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
				sinon.stub(BrowserUtils, "navigateWindow").callsFake((urlNavigate: string, noHistory?: boolean) => {
					expect(noHistory).to.be.undefined;
					expect(urlNavigate).to.be.not.empty;
				});
				const emptyRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: [testScope]
				};
				await pca.acquireTokenRedirect(emptyRequest);
				const validatedRequest: AuthorizationUrlRequest = {
					...emptyRequest,
					loginHint: idTokenClaims.upn,
					state: RANDOM_TEST_GUID,
					correlationId: RANDOM_TEST_GUID,
					authority: `${Constants.DEFAULT_AUTHORITY}/`,
					nonce: RANDOM_TEST_GUID,
					codeChallenge: TEST_CONFIG.TEST_CHALLENGE,
					codeChallengeMethod: Constants.S256_CODE_CHALLENGE_METHOD
				};
				expect(acquireTokenUrlSpy.calledWith(validatedRequest)).to.be.true;
			});
	
			it("Does not use adal token from cache if it is present and SSO params have been given.", async () => {
				const idTokenClaims: IdTokenClaims = {
					"iss": "https://sts.windows.net/fa15d692-e9c7-4460-a743-29f2956fd429/",
					"exp": "1536279024",
					"name": "abeli",
					"nonce": "123523",
					"oid": "05833b6b-aa1d-42d4-9ec0-1b2bb9194438",
					"sub": "5_J9rSss8-jvt_Icu6ueRNL8xXb8LF4Fsg_KooC2RJQ",
					"tid": "fa15d692-e9c7-4460-a743-29f2956fd429",
					"ver": "1.0",
					"upn": "AbeLincoln@contoso.com"
				};
				sinon.stub(IdToken, "extractIdToken").returns(idTokenClaims);
				const browserStorage: BrowserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, cacheConfig);
				browserStorage.setItem(PersistentCacheKeys.ADAL_ID_TOKEN, TEST_TOKENS.IDTOKEN_V1);
				const acquireTokenUrlSpy = sinon.spy(SPAClient.prototype, "createAcquireTokenUrl");
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
				sinon.stub(BrowserUtils, "navigateWindow").callsFake((urlNavigate: string, noHistory?: boolean) => {
					expect(noHistory).to.be.undefined;
					expect(urlNavigate).to.be.not.empty;
				});
				const testScope = "testscope";
				const loginRequest: AuthorizationUrlRequest = {
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: [testScope],
					loginHint: "AbeLi@microsoft.com"
				};
				await pca.acquireTokenRedirect(loginRequest);
				const validatedRequest: AuthorizationUrlRequest = {
					...loginRequest,
					state: RANDOM_TEST_GUID,
					correlationId: RANDOM_TEST_GUID,
					authority: `${Constants.DEFAULT_AUTHORITY}/`,
					nonce: RANDOM_TEST_GUID,
					codeChallenge: TEST_CONFIG.TEST_CHALLENGE,
					codeChallengeMethod: Constants.S256_CODE_CHALLENGE_METHOD
				};
				expect(acquireTokenUrlSpy.calledWith(validatedRequest)).to.be.true;
			});
        });
    });

    describe("Popup Flow Unit tests", () => {

        describe("loginPopup", () => {

            it("throws error if interaction is in progress", async () => {
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${BrowserConstants.INTERACTION_STATUS_KEY}`, BrowserConstants.INTERACTION_IN_PROGRESS_VALUE);
                await expect(pca.loginPopup(null)).to.be.rejectedWith(BrowserAuthErrorMessage.interactionInProgress.desc);
                await expect(pca.loginPopup(null)).to.be.rejectedWith(BrowserAuthError);
            });

            it("resolves the response successfully", async () => {
                const testServerTokenResponse = {
                    token_type: TEST_CONFIG.TOKEN_TYPE_BEARER,
                    scope: TEST_CONFIG.DEFAULT_SCOPES.join(" "),
                    expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                    ext_expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                    access_token: TEST_TOKENS.ACCESS_TOKEN,
                    refresh_token: TEST_TOKENS.REFRESH_TOKEN,
                    id_token: TEST_TOKENS.IDTOKEN_V2
                };
                const testIdTokenClaims: IdTokenClaims = {
                    "ver": "2.0",
                    "iss": "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
                    "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
                    "name": "Abe Lincoln",
                    "preferred_username": "AbeLi@microsoft.com",
                    "oid": "00000000-0000-0000-66f3-3332eca7ea81",
                    "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
                    "nonce": "123523",
                };
                const testAccount: IAccount = {
                    homeAccountId: TEST_DATA_CLIENT_INFO.TEST_HOME_ACCOUNT_ID,
                    environment: "login.windows.net",
                    tenantId: testIdTokenClaims.tid,
                    username: testIdTokenClaims.preferred_username
                };
                const testTokenResponse: AuthenticationResult = {
                    uniqueId: testIdTokenClaims.oid,
                    tenantId: testIdTokenClaims.tid,
                    scopes: TEST_CONFIG.DEFAULT_SCOPES,
                    idToken: testServerTokenResponse.id_token,
                    idTokenClaims: testIdTokenClaims,
                    accessToken: testServerTokenResponse.access_token,
                    expiresOn: new Date(Date.now() + (testServerTokenResponse.expires_in * 1000)),
                    account: testAccount
                };
                sinon.stub(SPAClient.prototype, "createLoginUrl").resolves(testNavUrl);
                sinon.stub(PopupHandler.prototype, "initiateAuthRequest").callsFake((requestUrl: string): Window => {
                    expect(requestUrl).to.be.eq(testNavUrl);
                    return window;
                });
                sinon.stub(PopupHandler.prototype, "monitorWindowForHash").resolves(TEST_HASHES.TEST_SUCCESS_CODE_HASH);
				sinon.stub(PopupHandler.prototype, "handleCodeResponse").resolves(testTokenResponse);
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
                const tokenResp = await pca.loginPopup(null);
                expect(tokenResp).to.be.deep.eq(testTokenResponse);
            });

            it("catches error and cleans cache before rethrowing", async () => {
                const testError = "Error in creating a login url";
                sinon.stub(SPAClient.prototype, "createLoginUrl").resolves(testNavUrl);
				sinon.stub(PopupHandler.prototype, "initiateAuthRequest").throws(testError);
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
                try {
                    const tokenResp = await pca.loginPopup(null);
                } catch (e) {
                    expect(window.sessionStorage).to.be.empty;
                    expect(`${e}`).to.be.eq(testError);
                }
            });
        });

        describe("acquireTokenPopup", () => {

            it("throws error if interaction is in progress", async () => {
                window.sessionStorage.setItem(`${Constants.CACHE_PREFIX}.${TEST_CONFIG.MSAL_CLIENT_ID}.${BrowserConstants.INTERACTION_STATUS_KEY}`, BrowserConstants.INTERACTION_IN_PROGRESS_VALUE);
                await expect(pca.acquireTokenPopup({
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: ["scope"]
				})).rejectedWith(BrowserAuthErrorMessage.interactionInProgress.desc);
                await expect(pca.acquireTokenPopup({
					redirectUri: TEST_URIS.TEST_REDIR_URI,
					scopes: ["scope"]
				})).rejectedWith(BrowserAuthError);
            });

            it("resolves the response successfully", async () => {
                const testServerTokenResponse = {
                    token_type: TEST_CONFIG.TOKEN_TYPE_BEARER,
                    scope: TEST_CONFIG.DEFAULT_SCOPES.join(" "),
                    expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                    ext_expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                    access_token: TEST_TOKENS.ACCESS_TOKEN,
                    refresh_token: TEST_TOKENS.REFRESH_TOKEN,
                    id_token: TEST_TOKENS.IDTOKEN_V2
                };
                const testIdTokenClaims: IdTokenClaims = {
                    "ver": "2.0",
                    "iss": "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
                    "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
                    "name": "Abe Lincoln",
                    "preferred_username": "AbeLi@microsoft.com",
                    "oid": "00000000-0000-0000-66f3-3332eca7ea81",
                    "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
                    "nonce": "123523",
                };
                const testAccount: IAccount = {
                    homeAccountId: TEST_DATA_CLIENT_INFO.TEST_HOME_ACCOUNT_ID,
                    environment: "login.windows.net",
                    tenantId: testIdTokenClaims.tid,
                    username: testIdTokenClaims.preferred_username
                };
                const testTokenResponse: AuthenticationResult = {
                    uniqueId: testIdTokenClaims.oid,
                    tenantId: testIdTokenClaims.tid,
                    scopes: TEST_CONFIG.DEFAULT_SCOPES,
                    idToken: testServerTokenResponse.id_token,
                    idTokenClaims: testIdTokenClaims,
                    accessToken: testServerTokenResponse.access_token,
                    expiresOn: new Date(Date.now() + (testServerTokenResponse.expires_in * 1000)),
                    account: testAccount
                };
                sinon.stub(SPAClient.prototype, "createAcquireTokenUrl").resolves(testNavUrl);
                sinon.stub(PopupHandler.prototype, "initiateAuthRequest").callsFake((requestUrl: string): Window => {
                    expect(requestUrl).to.be.eq(testNavUrl);
                    return window;
                });
                sinon.stub(PopupHandler.prototype, "monitorWindowForHash").resolves(TEST_HASHES.TEST_SUCCESS_CODE_HASH);
				sinon.stub(PopupHandler.prototype, "handleCodeResponse").resolves(testTokenResponse);
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
                const tokenResp = await pca.acquireTokenPopup({
					redirectUri: TEST_URIS.TEST_REDIR_URI,
                    scopes: TEST_CONFIG.DEFAULT_SCOPES
                });
                expect(tokenResp).to.be.deep.eq(testTokenResponse);
            });

            it("catches error and cleans cache before rethrowing", async () => {
                const testError = "Error in creating a login url";
                sinon.stub(SPAClient.prototype, "createAcquireTokenUrl").resolves(testNavUrl);
				sinon.stub(PopupHandler.prototype, "initiateAuthRequest").throws(testError);
				sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
					challenge: TEST_CONFIG.TEST_CHALLENGE,
					verifier: TEST_CONFIG.TEST_VERIFIER
				});
				sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
                try {
                    const tokenResp = await pca.acquireTokenPopup({
						redirectUri: TEST_URIS.TEST_REDIR_URI,
                        scopes: TEST_CONFIG.DEFAULT_SCOPES
                    });
                } catch (e) {
                    expect(window.sessionStorage).to.be.empty;
                    expect(`${e}`).to.be.eq(testError);
                }
            });
        });
    });

    describe("ssoSilent() Tests", () => {

        it("throws error if loginHint or sid are empty", async () => {
            await expect(pca.ssoSilent({
				redirectUri: TEST_URIS.TEST_REDIR_URI,
				scopes: [TEST_CONFIG.MSAL_CLIENT_ID]
			})).to.be.rejectedWith(BrowserAuthError);
            await expect(pca.ssoSilent({
				redirectUri: TEST_URIS.TEST_REDIR_URI,
				scopes: [TEST_CONFIG.MSAL_CLIENT_ID]
			})).to.be.rejectedWith(BrowserAuthErrorMessage.silentSSOInsufficientInfoError.desc);
        });

        it("throws error if prompt is not set to 'none'", async () => {
            const req: AuthorizationUrlRequest = {
				redirectUri: TEST_URIS.TEST_REDIR_URI,
				scopes: [TEST_CONFIG.MSAL_CLIENT_ID],
                prompt: PromptValue.SELECT_ACCOUNT,
                loginHint: "testLoginHint"
            };

            await expect(pca.ssoSilent(req)).to.be.rejectedWith(BrowserAuthError);
            await expect(pca.ssoSilent(req)).to.be.rejectedWith(BrowserAuthErrorMessage.silentPromptValueError.desc);
        });

        it("successfully returns a token response", async () => {
            const testServerTokenResponse = {
                token_type: TEST_CONFIG.TOKEN_TYPE_BEARER,
                scope: TEST_CONFIG.DEFAULT_SCOPES.join(" "),
                expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                ext_expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                access_token: TEST_TOKENS.ACCESS_TOKEN,
                refresh_token: TEST_TOKENS.REFRESH_TOKEN,
                id_token: TEST_TOKENS.IDTOKEN_V2
            };
            const testIdTokenClaims: IdTokenClaims = {
                "ver": "2.0",
                "iss": "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
                "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
                "name": "Abe Lincoln",
                "preferred_username": "AbeLi@microsoft.com",
                "oid": "00000000-0000-0000-66f3-3332eca7ea81",
                "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
                "nonce": "123523",
            };
            const testAccount: IAccount = {
                homeAccountId: TEST_DATA_CLIENT_INFO.TEST_HOME_ACCOUNT_ID,
                environment: "login.windows.net",
                tenantId: testIdTokenClaims.tid,
                username: testIdTokenClaims.preferred_username
            };
            const testTokenResponse: AuthenticationResult = {
                uniqueId: testIdTokenClaims.oid,
                tenantId: testIdTokenClaims.tid,
                scopes: TEST_CONFIG.DEFAULT_SCOPES,
                idToken: testServerTokenResponse.id_token,
                idTokenClaims: testIdTokenClaims,
                accessToken: testServerTokenResponse.access_token,
                expiresOn: new Date(Date.now() + (testServerTokenResponse.expires_in * 1000)),
                account: testAccount
            };
            sinon.stub(SPAClient.prototype, "createLoginUrl").resolves(testNavUrl);
            const loadFrameSyncSpy = sinon.spy(SilentHandler.prototype, <any>"loadFrameSync");
            sinon.stub(SilentHandler.prototype, "monitorFrameForHash").resolves(TEST_HASHES.TEST_SUCCESS_CODE_HASH);
			sinon.stub(SilentHandler.prototype, "handleCodeResponse").resolves(testTokenResponse);
			sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
				challenge: TEST_CONFIG.TEST_CHALLENGE,
				verifier: TEST_CONFIG.TEST_VERIFIER
			});
			sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
            const tokenResp = await pca.ssoSilent({
				redirectUri: TEST_URIS.TEST_REDIR_URI,
                scopes: TEST_CONFIG.DEFAULT_SCOPES,
                loginHint: "testLoginHint"
            });
            expect(loadFrameSyncSpy.calledOnce).to.be.true;
            expect(tokenResp).to.be.deep.eq(testTokenResponse);
        });
    });

    describe("Acquire Token Silent (Iframe) Tests", () => {

        it("successfully renews token", async () => {
            const testServerTokenResponse = {
                token_type: TEST_CONFIG.TOKEN_TYPE_BEARER,
                scope: TEST_CONFIG.DEFAULT_SCOPES.join(" "),
                expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                ext_expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                access_token: TEST_TOKENS.ACCESS_TOKEN,
                refresh_token: TEST_TOKENS.REFRESH_TOKEN,
                id_token: TEST_TOKENS.IDTOKEN_V2
            };
            const testIdTokenClaims: IdTokenClaims = {
                "ver": "2.0",
                "iss": "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
                "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
                "name": "Abe Lincoln",
                "preferred_username": "AbeLi@microsoft.com",
                "oid": "00000000-0000-0000-66f3-3332eca7ea81",
                "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
                "nonce": "123523",
            };
            const testAccount: IAccount = {
                homeAccountId: TEST_DATA_CLIENT_INFO.TEST_HOME_ACCOUNT_ID,
                environment: "login.windows.net",
                tenantId: testIdTokenClaims.tid,
                username: testIdTokenClaims.preferred_username
            };
            const testTokenResponse: AuthenticationResult = {
                uniqueId: testIdTokenClaims.oid,
                tenantId: testIdTokenClaims.tid,
                scopes: TEST_CONFIG.DEFAULT_SCOPES,
                idToken: testServerTokenResponse.id_token,
                idTokenClaims: testIdTokenClaims,
                accessToken: testServerTokenResponse.access_token,
                expiresOn: new Date(Date.now() + (testServerTokenResponse.expires_in * 1000)),
                account: testAccount
            };
            sinon.stub(SPAClient.prototype, "getValidToken").resolves(testTokenResponse);
            const tokenResp = await pca.acquireTokenSilent({
                scopes: TEST_CONFIG.DEFAULT_SCOPES,
                account: testAccount
            });
            expect(tokenResp).to.be.deep.eq(testTokenResponse);
        });

        it("throws error that getValidToken throws", async () => {
            const testError = "Error in creating a login url";
            const testAccount: IAccount = {
                homeAccountId: TEST_DATA_CLIENT_INFO.TEST_HOME_ACCOUNT_ID,
                environment: "login.windows.net",
                tenantId: "testTenantId",
                username: "username@contoso.com"
            };
            sinon.stub(SPAClient.prototype, "getValidToken").throws(testError);
            try {
                const tokenResp = await pca.acquireTokenSilent({
                    scopes: TEST_CONFIG.DEFAULT_SCOPES,
                    account: testAccount
                });
            } catch (e) {
                expect(`${e}`).to.contain(testError);
                expect(window.sessionStorage).to.be.empty;
            }
        });

        it("Falls back to silent handler if thrown error is a refresh token expired error", async () => {
            const invalidGrantError: ServerError = new ServerError("invalid_grant", "AADSTS700081: The refresh token has expired due to maximum lifetime. The token was issued on xxxxxxx and the maximum allowed lifetime for this application is 1.00:00:00.\r\nTrace ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx\r\nCorrelation ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx\r\nTimestamp: 2020-0x-0x XX:XX:XXZ");
            sinon.stub(SPAClient.prototype, "getValidToken").rejects(invalidGrantError);
            const testServerTokenResponse = {
                token_type: TEST_CONFIG.TOKEN_TYPE_BEARER,
                scope: TEST_CONFIG.DEFAULT_SCOPES.join(" "),
                expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                ext_expires_in: TEST_TOKEN_LIFETIMES.DEFAULT_EXPIRES_IN,
                access_token: TEST_TOKENS.ACCESS_TOKEN,
                refresh_token: TEST_TOKENS.REFRESH_TOKEN,
                id_token: TEST_TOKENS.IDTOKEN_V2
            };
            const testIdTokenClaims: IdTokenClaims = {
                "ver": "2.0",
                "iss": "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
                "sub": "AAAAAAAAAAAAAAAAAAAAAIkzqFVrSaSaFHy782bbtaQ",
                "name": "Abe Lincoln",
                "preferred_username": "AbeLi@microsoft.com",
                "oid": "00000000-0000-0000-66f3-3332eca7ea81",
                "tid": "3338040d-6c67-4c5b-b112-36a304b66dad",
                "nonce": "123523",
            };
            const testAccount: IAccount = {
                homeAccountId: TEST_DATA_CLIENT_INFO.TEST_HOME_ACCOUNT_ID,
                environment: "login.windows.net",
                tenantId: testIdTokenClaims.tid,
                username: testIdTokenClaims.preferred_username
            };
            const testTokenResponse: AuthenticationResult = {
                uniqueId: testIdTokenClaims.oid,
                tenantId: testIdTokenClaims.tid,
                scopes: TEST_CONFIG.DEFAULT_SCOPES,
                idToken: testServerTokenResponse.id_token,
                idTokenClaims: testIdTokenClaims,
                accessToken: testServerTokenResponse.access_token,
                expiresOn: new Date(Date.now() + (testServerTokenResponse.expires_in * 1000)),
                account: testAccount
            };
            const createAcqTokenStub = sinon.stub(SPAClient.prototype, "createAcquireTokenUrl").resolves(testNavUrl);
			const silentTokenHelperStub = sinon.stub(pca, <any>"silentTokenHelper").resolves(testTokenResponse);
			sinon.stub(CryptoOps.prototype, "generatePkceCodes").resolves({
				challenge: TEST_CONFIG.TEST_CHALLENGE,
				verifier: TEST_CONFIG.TEST_VERIFIER
			});
			sinon.stub(CryptoOps.prototype, "createNewGuid").returns(RANDOM_TEST_GUID);
			const urlRequest: AuthorizationUrlRequest = {
				scopes: TEST_CONFIG.DEFAULT_SCOPES,
				redirectUri: "",
				prompt: "none",
				state: RANDOM_TEST_GUID,
				correlationId: RANDOM_TEST_GUID,
				authority: `${Constants.DEFAULT_AUTHORITY}/`,
				nonce: RANDOM_TEST_GUID
			};
			const codeRequest: AuthorizationCodeRequest = {
				...urlRequest,
				code: "",
				codeVerifier: TEST_CONFIG.TEST_VERIFIER
            };
            const silentFlowRequest: SilentFlowRequest = {
                scopes: TEST_CONFIG.DEFAULT_SCOPES,
                account: testAccount
            }
            const tokenResp = await pca.acquireTokenSilent(silentFlowRequest);
			
            expect(tokenResp).to.be.deep.eq(testTokenResponse);
            expect(createAcqTokenStub.calledOnce).to.be.true;
            expect(silentTokenHelperStub.calledWith(testNavUrl)).to.be.true;
        });
    });

    describe("logout", () => {

        it("passes logoutUri from authModule to window nav util", () => {
            sinon.stub(SPAClient.prototype, "logout").resolves(testLogoutUrl);
            sinon.stub(BrowserUtils, "navigateWindow").callsFake((urlNavigate: string, noHistory: boolean) => {
                expect(urlNavigate).to.be.eq(testLogoutUrl);
                console.log(noHistory);
            });
            const testAccount: IAccount = {
                homeAccountId: TEST_DATA_CLIENT_INFO.TEST_HOME_ACCOUNT_ID,
                environment: "login.windows.net",
                tenantId: "testTenantId",
                username: "test@contoso.com"
            };
            pca.logout(testAccount);
        });
    });

    describe("Getters and Setters Unit Tests", () => {

        const pca_alternate_redirUris = new PublicClientApplication({
            auth: {
                clientId: TEST_CONFIG.MSAL_CLIENT_ID,
                redirectUri: TEST_URIS.TEST_ALTERNATE_REDIR_URI,
                postLogoutRedirectUri: TEST_URIS.TEST_LOGOUT_URI
            }
        });

        it("getRedirectUri returns the currently configured redirect uri", () => {
            expect(pca.getRedirectUri()).to.be.eq(TEST_URIS.TEST_REDIR_URI);
            expect(pca_alternate_redirUris.getRedirectUri()).to.be.eq(TEST_URIS.TEST_ALTERNATE_REDIR_URI);
        });

        it("getPostLogoutRedirectUri returns the currently configured post logout redirect uri", () => {
            expect(pca.getPostLogoutRedirectUri()).to.be.eq(TEST_URIS.TEST_REDIR_URI);
            expect(pca_alternate_redirUris.getPostLogoutRedirectUri()).to.be.eq(TEST_URIS.TEST_LOGOUT_URI);
        });
    });
});
