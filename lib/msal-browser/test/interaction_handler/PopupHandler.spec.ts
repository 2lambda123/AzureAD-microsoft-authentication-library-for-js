import chai from "chai";
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised);
const expect = chai.expect;
import { PkceCodes, NetworkRequestOptions, LogLevel, AuthorityFactory, AuthorizationCodeRequest, Constants, CacheSchemaType, CacheManager, AuthorizationCodeClient } from "@azure/msal-common";
import { PopupHandler } from "../../src/interaction_handler/PopupHandler";
import { BrowserStorage } from "../../src/cache/BrowserStorage";
import { Configuration, buildConfiguration } from "../../src/config/Configuration";
import { TEST_CONFIG, TEST_URIS, RANDOM_TEST_GUID } from "../utils/StringConstants";
import sinon from "sinon";
import { InteractionHandler } from "../../src/interaction_handler/InteractionHandler";
import { BrowserAuthErrorMessage, BrowserAuthError } from "../../src/error/BrowserAuthError";
import { BrowserConstants } from "../../src/utils/BrowserConstants";

class TestStorageInterface extends CacheManager {
    setItem(key: string, value: string | object, type?: string): void {
        return;
    }
    getItem(key: string, type?: string): string | object {
        return "cacheItem";
    }
    removeItem(key: string, type?: string): boolean {
        return true;
    }
    containsKey(key: string, type?: string): boolean {
        return true;
    }
    getKeys(): string[] {
        return testKeySet;
    }
    clear(): void {
        return;
    }
}

const testPkceCodes = {
    challenge: "TestChallenge",
    verifier: "TestVerifier"
} as PkceCodes;

const testNetworkResult = {
    testParam: "testValue"
};

const testKeySet = ["testKey1", "testKey2"];

const networkInterface = {
	sendGetRequestAsync<T>(
		url: string,
		options?: NetworkRequestOptions
	): T {
		return null;
	},
	sendPostRequestAsync<T>(
		url: string,
		options?: NetworkRequestOptions
	): T {
		return null;
	},
};

describe("PopupHandler.ts Unit Tests", () => {

    let browserStorage: BrowserStorage;
    let popupHandler: PopupHandler;
    beforeEach(() => {
        const appConfig: Configuration = {
            auth: {
                clientId: TEST_CONFIG.MSAL_CLIENT_ID
            }
        };
		const configObj = buildConfiguration(appConfig);
		const authorityInstance = AuthorityFactory.createInstance(configObj.auth.authority, networkInterface);
        const authCodeModule = new AuthorizationCodeClient({
            authOptions: {
				...configObj.auth,
				authority: authorityInstance,
			},
            systemOptions: {
                tokenRenewalOffsetSeconds:
                    configObj.system.tokenRenewalOffsetSeconds
            },
            cryptoInterface: {
                createNewGuid: (): string => {
                    return "newGuid";
                },
                base64Decode: (input: string): string => {
                    return "testDecodedString";
                },
                base64Encode: (input: string): string => {
                    return "testEncodedString";
                },
                generatePkceCodes: async (): Promise<PkceCodes> => {
                    return testPkceCodes;
                },
            },
            storageInterface: new TestStorageInterface(),
            networkInterface: {
                sendGetRequestAsync: async (
                    url: string,
                    options?: NetworkRequestOptions
                ): Promise<any> => {
                    return testNetworkResult;
                },
                sendPostRequestAsync: async (
                    url: string,
                    options?: NetworkRequestOptions
                ): Promise<any> => {
                    return testNetworkResult;
                },
            },
            loggerOptions: {
                loggerCallback: (
                    level: LogLevel,
                    message: string,
                    containsPii: boolean
                ): void => {
                    if (containsPii) {
                        console.log(`Log level: ${level} Message: ${message}`);
                    }
                },
                piiLoggingEnabled: true,
            },
        });
        browserStorage = new BrowserStorage(TEST_CONFIG.MSAL_CLIENT_ID, configObj.cache);
        popupHandler = new PopupHandler(authCodeModule, browserStorage);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("Constructor", () => {

        it("creates a valid PopupHandler", () => {
            expect(popupHandler instanceof PopupHandler).to.be.true;
            expect(popupHandler instanceof InteractionHandler).to.be.true;
        });
    });

    describe("initiateAuthRequest()", () => {

        it("throws error if request uri is empty", () => {
			const testTokenReq: AuthorizationCodeRequest = {
				redirectUri: `${TEST_URIS.DEFAULT_INSTANCE}/`,
				code: "thisIsATestCode",
				scopes: TEST_CONFIG.DEFAULT_SCOPES,
				codeVerifier: TEST_CONFIG.TEST_VERIFIER,
				authority: `${Constants.DEFAULT_AUTHORITY}/`,
				correlationId: RANDOM_TEST_GUID
			};
            expect(() => popupHandler.initiateAuthRequest("", testTokenReq)).to.throw(BrowserAuthErrorMessage.emptyNavigateUriError.desc);
            expect(() => popupHandler.initiateAuthRequest("", testTokenReq)).to.throw(BrowserAuthError);

            expect(() => popupHandler.initiateAuthRequest(null, testTokenReq)).to.throw(BrowserAuthErrorMessage.emptyNavigateUriError.desc);
            expect(() => popupHandler.initiateAuthRequest(null, testTokenReq)).to.throw(BrowserAuthError);
        });

        it("opens a popup window", () => {
			const testTokenReq: AuthorizationCodeRequest = {
				redirectUri: `${TEST_URIS.DEFAULT_INSTANCE}/`,
				code: "thisIsATestCode",
				scopes: TEST_CONFIG.DEFAULT_SCOPES,
				codeVerifier: TEST_CONFIG.TEST_VERIFIER,
				authority: `${Constants.DEFAULT_AUTHORITY}/`,
				correlationId: RANDOM_TEST_GUID
			};
            // sinon.stub(window, "open").returns(window);
            window.focus = (): void => {
                return;
            };

            window.open = (url?: string, target?: string, features?: string, replace?: boolean): Window => {
                return window;
            };

            const popupWindow = popupHandler.initiateAuthRequest(TEST_URIS.ALTERNATE_INSTANCE, testTokenReq);
            expect(browserStorage.getItem(browserStorage.generateCacheKey(BrowserConstants.INTERACTION_STATUS_KEY), CacheSchemaType.TEMPORARY)).to.be.eq(BrowserConstants.INTERACTION_IN_PROGRESS_VALUE);
        });
    });

    describe("monitorPopupForHash", () => {
        it("times out", done => {
            const popup = {
                location: {
                    href: "http://localhost",
                    hash: ""
                },
                close: () => {}
            };

            // @ts-ignore
            popupHandler.monitorPopupForHash(popup, 500)
                .catch(() => {
                    done();
                });
        });

        it("returns hash", done => {
            const popup = {
                location: {
                    href: "http://localhost",
                    hash: ""
                },
                close: () => {}
            };

            // @ts-ignore
            popupHandler.monitorPopupForHash(popup, 1000)
                .then((hash: string) => {
                    expect(hash).to.equal("#code=hello");
                    done();
                });

            setTimeout(() => {
                popup.location = {
                    href: "http://localhost/#/code=hello",
                    hash: "#code=hello"
                };
            }, 500);
        });

        it("closed", done => {
            const popup = {
                location: {
                    href: "http://localhost",
                    hash: ""
                },
                close: () => {},
                closed: false
            };

            // @ts-ignore
            popupHandler.monitorPopupForHash(popup, 1000)
                .catch((error) => {
                    expect(error.errorCode).to.equal('user_cancelled');
                    done();
                });

            setTimeout(() => {
                popup.closed = true;
            }, 500);
        });
    });
});
