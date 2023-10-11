/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { TEST_URIS } from "./StringConstants";
import {
    BrowserUtils,
    BrowserAuthError,
    BrowserAuthErrorMessage,
    InteractionType,
} from "../../src";

describe("BrowserUtils.ts Function Unit Tests", () => {
    const oldWindow = { ...window };
    afterEach(() => {
        window = oldWindow;
        jest.restoreAllMocks();
    });

    it("clearHash() clears the window hash", () => {
        window.location.hash = "thisIsAHash";
        BrowserUtils.clearHash(window);
        expect(window.location.href.includes("#thisIsAHash")).toBe(false);
    });

    it("clearHash() clears the window hash (office addin)", () => {
        // Office.js sets replaceState to null: https://github.com/OfficeDev/office-js/issues/429
        const oldReplaceState = history.replaceState;
        //@ts-ignore
        history.replaceState = null;

        window.location.hash = "thisIsAHash";
        BrowserUtils.clearHash(window);
        expect(window.location.href.includes("#thisIsAHash")).toBe(false);

        history.replaceState = oldReplaceState;
    });

    it("replaceHash replaces the current window hash with the hash from the provided url", () => {
        window.location.hash = "thisIsAHash";
        const url = "http://localhost/#";
        const testHash = "#replacementHash";
        BrowserUtils.replaceHash(url + testHash);
        expect(window.location.hash).toBe(testHash);
    });

    it("replaceHash clears the current window hash when provided url does not have hash", () => {
        window.location.hash = "thisIsAHash";
        const url = "http://localhost/";
        BrowserUtils.replaceHash(url);
        expect(window.location.hash).toBe("");
    });

    it("isInIframe() returns false if window parent is the same as the current window", () => {
        jest.spyOn(window, "parent", "get").mockReturnValue(window);
        expect(BrowserUtils.isInIframe()).toBe(false);
    });

    it("isInIframe() returns true if window parent is not the same as the current window", () => {
        expect(BrowserUtils.isInIframe()).toBe(false);
        // @ts-ignore
        jest.spyOn(window, "parent", "get").mockReturnValue(null);
        expect(BrowserUtils.isInIframe()).toBe(true);
    });

    it("isInPopup() returns false if window is undefined", () => {
        // @ts-ignore
        jest.spyOn(global, "window", "get").mockReturnValue(undefined);
        expect(BrowserUtils.isInPopup()).toBe(false);
    });

    it("isInPopup() returns false if window opener is not the same as the current window but window name does not starts with 'msal.'", () => {
        window.opener = { ...window };
        window.name = "non-msal-popup";
        expect(BrowserUtils.isInPopup()).toBe(false);
    });

    it("isInPopup() returns false if window opener is the same as the current window", () => {
        window.opener = window;
        window.name = "msal.";
        expect(BrowserUtils.isInPopup()).toBe(false);
    });

    it("isInPopup() returns true if window opener is not the same as the current window and the window name starts with 'msal.'", () => {
        expect(BrowserUtils.isInPopup()).toBe(false);
        window.opener = { ...window };
        window.name = "msal.popupwindow";
        expect(BrowserUtils.isInPopup()).toBe(true);
    });

    it("getCurrentUri() returns current location uri of browser", () => {
        expect(BrowserUtils.getCurrentUri()).toBe(TEST_URIS.TEST_REDIR_URI);
    });

    describe("blockRedirectInIframe", () => {
        it("throws when inside an iframe", (done) => {
            jest.spyOn(window, "parent", "get").mockReturnValue({ ...window });
            try {
                BrowserUtils.blockRedirectInIframe(
                    InteractionType.Redirect,
                    false
                );
            } catch (e) {
                const browserAuthError = e as BrowserAuthError;
                expect(browserAuthError.errorCode).toBe(
                    BrowserAuthErrorMessage.redirectInIframeError.code
                );
                done();
            }
        });

        it("doesnt throw when inside an iframe and redirects are allowed", () => {
            jest.spyOn(window, "parent", "get").mockReturnValue({ ...window });
            BrowserUtils.blockRedirectInIframe(InteractionType.Redirect, true);
        });

        it("doesnt throw when not inside an iframe", () => {
            BrowserUtils.blockRedirectInIframe(InteractionType.Redirect, false);
        });
    });
});
