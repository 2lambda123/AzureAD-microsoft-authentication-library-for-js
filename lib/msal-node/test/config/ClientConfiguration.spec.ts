import {buildAppConfiguration, ClientConfiguration} from "../../src/config/ClientConfiguration";
import {CACHE} from "../../src/utils/Constants";
import {HttpClient} from "../../src/network/HttpClient";
import {TEST_CONSTANTS} from "../utils/TestConstants";
import {LogLevel, NetworkRequestOptions} from "@azure/msal-common";

describe('ClientConfiguration tests', () => {
    test('builds configuration and assigns default functions', () => {

        const config: ClientConfiguration = buildAppConfiguration({});

        // network options
        expect(config.system!.networkClient).toBeDefined();
        expect(config.system!.networkClient).toBeInstanceOf(HttpClient);
        expect(config.system!.networkClient!.sendGetRequestAsync).toBeDefined();
        expect(
            config.system!.networkClient!.sendPostRequestAsync
        ).toBeDefined();

        // logger options checks
        console.error = jest.fn();
        console.info = jest.fn();
        console.debug = jest.fn();
        console.warn = jest.fn();

        expect(config.system!.loggerOptions).toBeDefined();
        expect(config.system!.loggerOptions!.piiLoggingEnabled).toBe(false);

        config.system!.loggerOptions!.loggerCallback!(
            LogLevel.Error,
            'error',
            false
        );
        config.system!.loggerOptions!.loggerCallback!(
            LogLevel.Info,
            'info',
            false
        );
        config.system!.loggerOptions!.loggerCallback!(
            LogLevel.Verbose,
            'verbose',
            false
        );
        config.system!.loggerOptions!.loggerCallback!(
            LogLevel.Warning,
            'warning',
            false
        );
        config.system!.loggerOptions!.loggerCallback!(
            LogLevel.Warning,
            'warning',
            true
        );

        // expect(console.error).toHaveBeenLastCalledWith('error');
        // expect(console.info).toHaveBeenLastCalledWith('info');
        // expect(console.debug).toHaveBeenLastCalledWith('verbose');
        // expect(console.warn).toHaveBeenLastCalledWith('warning');
        // expect(console.warn).toHaveBeenCalledTimes(1);

        // auth options
        expect(config.auth!.authority).toEqual('');
        expect(config.auth!.clientId).toEqual('');

        // cache options
        expect(config.cache!.cacheLocation).toEqual(CACHE.FILE_CACHE);
        expect(config.cache!.storeAuthStateInCookie).toEqual(false);
    });

    test('builds configuration and assigns default functions', () => {
        const testNetworkResult = {
            testParam: 'testValue',
        };

        const config: ClientConfiguration = {
            auth: {
                clientId: TEST_CONSTANTS.CLIENT_ID,
                authority: TEST_CONSTANTS.AUTHORITY,
            },
            system: {
                networkClient: {
                    sendGetRequestAsync: async (
                        url: string,
                        options?: NetworkRequestOptions
                    ): Promise<any> => {
                        if (url && options) {
                            return testNetworkResult;
                        }
                    },
                    sendPostRequestAsync: async (
                        url: string,
                        options?: NetworkRequestOptions
                    ): Promise<any> => {
                        if (url && options) {
                            return testNetworkResult;
                        }
                    },
                },
                loggerOptions: {
                    loggerCallback: (
                        level: LogLevel,
                        message: string,
                        containsPii: boolean
                    ): void => {
                        if (containsPii) {
                            console.log(
                                `Log level: ${level} Message: ${message}`
                            );
                        }
                    },
                    piiLoggingEnabled: true,
                },
            },
            cache: {
                cacheLocation: TEST_CONSTANTS.CACHE_LOCATION,
                storeAuthStateInCookie: true,
            },
        };

        const testNetworkOptions = {
            headers: new Map(),
            body: '',
        };

        // network options
        expect(
            config.system!.networkClient!.sendGetRequestAsync(
                TEST_CONSTANTS.AUTH_CODE_URL,
                testNetworkOptions
            )
        ).resolves.toEqual(testNetworkResult);
        expect(
            config.system!.networkClient!.sendPostRequestAsync(
                TEST_CONSTANTS.AUTH_CODE_URL,
                testNetworkOptions
            )
        ).resolves.toEqual(testNetworkResult);

        // Logger options checks
        expect(config.system!.loggerOptions).toBeDefined();
        expect(config.system!.loggerOptions!.piiLoggingEnabled).toBe(true);

        // auth options
        expect(config.auth!.authority).toEqual(TEST_CONSTANTS.AUTHORITY);
        expect(config.auth!.clientId).toEqual(TEST_CONSTANTS.CLIENT_ID);

        // cache options
        expect(config.cache!.cacheLocation).toEqual(
            TEST_CONSTANTS.CACHE_LOCATION
        );
        expect(config.cache!.storeAuthStateInCookie).toEqual(true);
    });
});
