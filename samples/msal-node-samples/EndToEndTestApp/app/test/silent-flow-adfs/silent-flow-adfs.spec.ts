/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import "jest";
import puppeteer from "puppeteer";
import { Screenshot, createFolder, setupCredentials } from "../../../../../e2eTestUtils/TestUtils";
import { NodeCacheTestUtils } from "../../../../../e2eTestUtils/NodeCacheTestUtils";
import { LabClient } from "../../../../../e2eTestUtils/LabClient";
import { LabApiQueryParams } from "../../../../../e2eTestUtils/LabApiQueryParams";
import { AppTypes, AzureEnvironments, FederationProviders, UserTypes } from "../../../../../e2eTestUtils/Constants";
import { 
    clickSignIn, 
    enterCredentialsADFS,
    SCREENSHOT_BASE_FOLDER_NAME,
    SAMPLE_HOME_URL,
    SUCCESSFUL_GRAPH_CALL_ID,
    SUCCESSFUL_GET_ALL_ACCOUNTS_ID,
    validateCacheLocation} from "../testUtils";
    
let username: string;
let accountPwd: string;

const TEST_CACHE_LOCATION = `${__dirname}/data/testCache.json`;

describe("Silent Flow ADFS 2019 Tests", () => {
    jest.setTimeout(10000);
    let browser: puppeteer.Browser;

    beforeAll(async () => {
        await validateCacheLocation(TEST_CACHE_LOCATION);
        createFolder(SCREENSHOT_BASE_FOLDER_NAME);
        const labApiParms: LabApiQueryParams = {
            azureEnvironment: AzureEnvironments.CLOUD,
            appType: AppTypes.CLOUD,
            federationProvider: FederationProviders.ADFS2019,
            userType: UserTypes.FEDERATED
        };

        const labClient = new LabClient();
        const envResponse = await labClient.getVarsByCloudEnvironment(labApiParms);

        [username, accountPwd] = await setupCredentials(envResponse[0], labClient);

        browser = await puppeteer.launch({
            headless: true,
            ignoreDefaultArgs: ["--no-sandbox", "-disable-setuid-sandbox", "--disable-extensions"]
        });
    });

    let context: puppeteer.BrowserContext;
    let page: puppeteer.Page;

    afterAll(async () => {
        await browser.close();
    });

    describe("Acquire Token", () => {
        beforeEach(async () => {
            context = await browser.createIncognitoBrowserContext();
            page = await context.newPage();
            await page.goto(SAMPLE_HOME_URL);
        });
    
        afterEach(async () => {
            await page.close();
            await context.close();
            await NodeCacheTestUtils.resetCache(TEST_CACHE_LOCATION);
        });

        it("Performs acquire token with Auth Code flow", async () => {
            const testName = "ADFSAcquireTokenAuthCode";
            const screenshot = new Screenshot(`${SCREENSHOT_BASE_FOLDER_NAME}/${testName}`);
            await clickSignIn(page, screenshot);
            await enterCredentialsADFS(page, screenshot, username, accountPwd);
            await page.waitForSelector("#acquireTokenSilent");
            await page.click("#acquireTokenSilent");
            const cachedTokens = await NodeCacheTestUtils.waitForTokens(TEST_CACHE_LOCATION, 2000);
            expect(cachedTokens.accessTokens.length).toBe(1);
            expect(cachedTokens.idTokens.length).toBe(1);
            expect(cachedTokens.refreshTokens.length).toBe(1);
        });

        it("Performs acquire token silent", async () => {
            const testName = "ADFSAcquireTokenSilent";
            const screenshot = new Screenshot(`${SCREENSHOT_BASE_FOLDER_NAME}/${testName}`);
            await clickSignIn(page, screenshot);
            await enterCredentialsADFS(page, screenshot, username, accountPwd);
            await page.waitForSelector("#acquireTokenSilent");
            await page.click("#acquireTokenSilent");
            await page.waitForSelector("#graph-called-successfully");
            await screenshot.takeScreenshot(page, "acquireTokenSilentGotTokens");
        });

        it("Refreshes an expired access token", async () => {
            const testName = "ADFSRefreshExpiredToken";
            const screenshot = new Screenshot(`${SCREENSHOT_BASE_FOLDER_NAME}/${testName}`);
            await clickSignIn(page, screenshot);
            await enterCredentialsADFS(page, screenshot, username, accountPwd);
            await page.waitForSelector("#acquireTokenSilent");
    
            let tokens = await NodeCacheTestUtils.waitForTokens(TEST_CACHE_LOCATION, 2000);
            const originalAccessToken = tokens.accessTokens[0];
            await NodeCacheTestUtils.expireAccessTokens(TEST_CACHE_LOCATION);
            tokens = await NodeCacheTestUtils.waitForTokens(TEST_CACHE_LOCATION, 2000);
            const expiredAccessToken = tokens.accessTokens[0];
            await page.click("#acquireTokenSilent");
            await page.waitForSelector(`#${SUCCESSFUL_GRAPH_CALL_ID}`);
            tokens = await NodeCacheTestUtils.waitForTokens(TEST_CACHE_LOCATION, 2000);
            const refreshedAccessToken = tokens.accessTokens[0];
            await screenshot.takeScreenshot(page, "acquireTokenSilentGotTokens");
            const htmlBody = await page.evaluate(() => document.body.innerHTML);
    
            expect(htmlBody).toContain(SUCCESSFUL_GRAPH_CALL_ID);
            expect(Number(originalAccessToken.expiresOn)).toBeGreaterThan(0);
            expect(Number(expiredAccessToken.expiresOn)).toBe(0);
            expect(Number(refreshedAccessToken.expiresOn)).toBeGreaterThan(0);
            expect(refreshedAccessToken.secret).not.toEqual(originalAccessToken.secret);
        });
    });

    describe("Get All Accounts", () => {
        describe("Authenticated", () => {
            beforeEach(async () => {
                context = await browser.createIncognitoBrowserContext();
                page = await context.newPage();
                page.setDefaultNavigationTimeout(0);
                await page.goto(SAMPLE_HOME_URL);
            });
        
            afterEach(async () => {
                await page.close();
                await context.close();
                await NodeCacheTestUtils.resetCache(TEST_CACHE_LOCATION);
            });

            it("Gets all accounts", async () => {
                const testName = "ADFSGetAllAccounts";
                const screenshot = new Screenshot(`${SCREENSHOT_BASE_FOLDER_NAME}/${testName}`);
                await clickSignIn(page, screenshot);
                await enterCredentialsADFS(page, screenshot, username, accountPwd);
                await page.waitForSelector("#getAllAccounts");
                await page.click("#getAllAccounts");
                await page.waitForSelector(`#${SUCCESSFUL_GET_ALL_ACCOUNTS_ID}`);
                await screenshot.takeScreenshot(page, "gotAllAccounts");
                const accounts  = await page.evaluate(() => JSON.parse(document.getElementById("nav-tabContent").children[0].innerHTML));
                const htmlBody = await page.evaluate(() => document.body.innerHTML);
                expect(htmlBody).toContain(SUCCESSFUL_GET_ALL_ACCOUNTS_ID);
                expect(htmlBody).not.toContain("No accounts found in the cache.");
                expect(htmlBody).not.toContain("Failed to get accounts from cache.");
                expect(accounts.length).toBe(1);
            });
        });

        describe("Unauthenticated", () => {
            beforeEach(async () => {
                context = await browser.createIncognitoBrowserContext();
                page = await context.newPage();
                page.setDefaultNavigationTimeout(0);
                await page.goto(SAMPLE_HOME_URL);
            });
        
            afterEach(async () => {
                await page.close();
                await context.close();
                await NodeCacheTestUtils.resetCache(TEST_CACHE_LOCATION);
            });

            it("Returns empty account array", async () => {
                const testName = "ADFSNoCachedAccounts";
                const screenshot = new Screenshot(`${SCREENSHOT_BASE_FOLDER_NAME}/${testName}`);
                await page.goto(`${SAMPLE_HOME_URL}/allAccounts`);
                await page.waitForSelector("#getAllAccounts");
                await page.click("#getAllAccounts");
                await screenshot.takeScreenshot(page, "gotAllAccounts");
                const accounts  = await page.evaluate(() => JSON.parse(document.getElementById("nav-tabContent").children[0].innerHTML));
                const htmlBody = await page.evaluate(() => document.body.innerHTML);
                expect(htmlBody).toContain("No accounts found in the cache.");
                expect(htmlBody).not.toContain("Failed to get accounts from cache.");
                expect(accounts.length).toBe(0);
            });
        });
    });
});