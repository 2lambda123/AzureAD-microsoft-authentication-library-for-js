/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { INetworkModule } from "@azure/msal-common";
import { FetchClient } from "../network/FetchClient";
import { XhrClient } from "../network/XhrClient";

/**
 * Utility class for browser specific functions
 */
export class BrowserUtils {

    // #region Window Navigation and URL management

    /**
     * Used to redirect the browser to the STS authorization endpoint
     * @param {string} urlNavigate - URL of the authorization endpoint
     * @param {boolean} noHistory - boolean flag, uses .replace() instead of .assign() if true
     */
    static navigateWindow(urlNavigate: string, noHistory?: boolean): void {
        if (noHistory) {
            window.location.replace(urlNavigate);
        } else {
            window.location.assign(urlNavigate);
        }
    }

    /**
     * Clears hash from window url.
     */
    static clearHash(): void {
        window.location.hash = "";
    }

    /**
     * Returns boolean of whether the current window is in an iframe or not.
     */
    static isInIframe(): boolean {
        return window.parent !== window;
    }

    // #endregion

    /**
     * Returns current window URL as redirect uri
     */
    static getDefaultRedirectUri(): string {
        return window.location.href.split("?")[0].split("#")[0];
    }

    /**
     * Returns best compatible network client object. 
     */
    static getBrowserNetworkClient(): INetworkModule {
        if (window.fetch) {
            return new FetchClient();
        } else {
            return new XhrClient();
        }
    }

    static headersToMap(headers: Headers): Map<string, string> {
        const map = new Map<string, string>();
        headers.forEach((value, key) => {
            map.set(key, value);
        });
        return map;
    }
}
