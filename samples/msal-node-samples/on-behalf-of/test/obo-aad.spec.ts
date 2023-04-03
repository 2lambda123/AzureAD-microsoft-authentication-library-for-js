/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import puppeteer from "puppeteer";
import { Screenshot, createFolder, setupCredentials } from "../../../e2eTestUtils/TestUtils";
import { NodeCacheTestUtils } from "../../../e2eTestUtils/NodeCacheTestUtils";
import { LabClient } from "../../../e2eTestUtils/LabClient";
import { LabApiQueryParams } from "../../../e2eTestUtils/LabApiQueryParams";
import { AppTypes, AzureEnvironments } from "../../../e2eTestUtils/Constants";
import { enterCredentials, SCREENSHOT_BASE_FOLDER_NAME, validateCacheLocation, SAMPLE_HOME_URL } from "../../testUtils";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const { acquireTokenByCode } = require("../web-app/index");
const { acquireTokenObo } = require("../web-api/index");

const webAppConfig = require("../config/WEB-APP.json");
webAppConfig.authOptions.clientId = process.env.OBO_WEB_APP_CLIENT_ID;
webAppConfig.authOptions.clientSecret = process.env.OBO_WEB_APP_CLIENT_SECRET;

const webApiConfig = require("../config/WEB-API.json");
webApiConfig.authOptions.clientId = process.env.OBO_WEB_API_CLIENT_ID;
webApiConfig.authOptions.clientSecret = process.env.OBO_WEB_API_CLIENT_SECRET;
webApiConfig.webApiUrl = process.env.OBO_WEB_API_URL;
webApiConfig.authOptions.authority = `https://login.microsoftonline.com/${process.env.OBO_WEB_API_TENANT_ID}`;
webApiConfig.discoveryKeysEndpoint = `https://login.microsoftonline.com/${process.env.OBO_WEB_API_TENANT_ID}/discovery/v2.0/keys`;

const TEST_CACHE_LOCATION = `${__dirname}/data/cache.json`;
const cachePlugin = require("../../cachePlugin.js")(TEST_CACHE_LOCATION);

const HOME_ROUTE = `http://localhost:${webAppConfig.serverPort}`;

describe("OBO AAD Tests", () => {
    jest.retryTimes(1);
    jest.setTimeout(45000);
    let browser: puppeteer.Browser;
    let context: puppeteer.BrowserContext;
    let page: puppeteer.Page;
    
    let username: string;
    let accountPwd: string;

    const screenshotFolder = `${SCREENSHOT_BASE_FOLDER_NAME}/obo/aad`;

    beforeAll(async () => {
        await validateCacheLocation(TEST_CACHE_LOCATION);
        // @ts-ignore
        browser = await global.__BROWSER__;

        createFolder(screenshotFolder);

        const labApiParms: LabApiQueryParams = {
            azureEnvironment: AzureEnvironments.CLOUD,
            appType: AppTypes.CLOUD,
        };

        const labClient = new LabClient();
        const envResponse = await labClient.getVarsByCloudEnvironment(labApiParms);
        [username, accountPwd] = await setupCredentials(envResponse[0], labClient);
    });

    afterAll(async () => {
        await browser.close();
    });

    describe("Acquire Token", () => {
        let webAppConfidentialClient: ConfidentialClientApplication;
        let webApiConfidentialClient: ConfidentialClientApplication;
        let webAppServer: any;
        let webApiServer: any;

        const loggerOptions = {
            loggerCallback(loglevel: LogLevel, message: String, containsPii: Boolean) {
                console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: LogLevel.Verbose,
        };

        beforeAll(async () => {
            webAppConfidentialClient = new ConfidentialClientApplication({auth: webAppConfig.authOptions, cache: { cachePlugin }, system: { loggerOptions }});
            webApiConfidentialClient = new ConfidentialClientApplication({auth: webApiConfig.authOptions, cache: { cachePlugin }, system: { loggerOptions }});
            webAppServer = acquireTokenByCode(webAppConfidentialClient, webAppConfig.serverPort, webApiConfig.serverPort, webAppConfig.redirectUri, webApiConfig.webApiUrl);
            webApiServer = acquireTokenObo(webApiConfidentialClient, webApiConfig.serverPort, webApiConfig.authOptions.clientId, webApiConfig.authOptions.authority, webApiConfig.discoveryKeysEndpoint);
            await NodeCacheTestUtils.resetCache(TEST_CACHE_LOCATION);
        });

        afterAll(async () => {
            if (webAppServer) {
                webAppServer.close();
            }

            if (webApiServer) {
                webApiServer.close();
            }
        });

        beforeEach(async () => {
            context = await browser.createIncognitoBrowserContext();
            page = await context.newPage();
            page.setDefaultTimeout(5000);
            page.on("dialog", async dialog => {
                console.log(dialog.message());
                await dialog.dismiss();
            });
        });

        afterEach(async () => {
            await page.close();
            await context.close();
            await NodeCacheTestUtils.resetCache(TEST_CACHE_LOCATION);
        });

        it("Performs acquire token via OBO flow", async () => {
            const screenshot = new Screenshot(`${screenshotFolder}/BaseCase`);
            await page.goto(HOME_ROUTE);
            await enterCredentials(page, screenshot, username, accountPwd);
            await page.waitForFunction(`window.location.href.startsWith("${SAMPLE_HOME_URL}")`);
            
            console.log("1111111111", TEST_CACHE_LOCATION);
            const cachedTokens = await NodeCacheTestUtils.waitForTokens(TEST_CACHE_LOCATION, 2000);
            console.log("done checking cache");
            expect(cachedTokens.accessTokens.length).toBe(2);
            expect(cachedTokens.idTokens.length).toBe(2);
            expect(cachedTokens.refreshTokens.length).toBe(2);

            const accounts = await NodeCacheTestUtils.getAccounts(TEST_CACHE_LOCATION);
            expect(Object.keys(accounts).length).toBe(1);
            const account = Object.values(accounts)[0];
            expect(account.username).toEqual(username);
        });
    });
});
