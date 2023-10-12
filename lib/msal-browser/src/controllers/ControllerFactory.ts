/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { TeamsAppOperatingContext } from "../operatingcontext/TeamsAppOperatingContext";
import { StandardOperatingContext } from "../operatingcontext/StandardOperatingContext";
import { IController } from "./IController";
import { Logger } from "@azure/msal-common";
import { Configuration } from "../config/Configuration";
import { version, name } from "../packageMetadata";

export class ControllerFactory {
    protected config: Configuration;
    protected logger: Logger;

    constructor(config: Configuration) {
        this.config = config;
        const loggerOptions = {
            loggerCallback: undefined,
            piiLoggingEnabled: false,
            logLevel: undefined,
            correlationId: undefined,
        };
        this.logger = new Logger(loggerOptions, name, version);
    }

    async createV3Controller(): Promise<IController> {
        const standard = new StandardOperatingContext(this.config);

        await standard.initialize();

        const controller = await import("./StandardController");
        return await controller.StandardController.createController(standard);
    }

    async createController(): Promise<IController | null> {
        const standard = new StandardOperatingContext(this.config);
        const teamsApp = new TeamsAppOperatingContext(this.config);

        const operatingContexts = [
            standard.initialize(),
            teamsApp.initialize(),
        ];

        await Promise.all(operatingContexts);

        if (
            teamsApp.isAvailable() &&
            teamsApp.getConfig().auth.supportsNestedAppAuth
        ) {
            const controller = await import("./NestedAppAuthController");
            return await controller.NestedAppAuthController.createController(
                teamsApp
            );
        } else if (standard.isAvailable()) {
            const controller = await import("./StandardController");
            return await controller.StandardController.createController(
                standard
            );
        } else {
            // Since neither of the actual operating contexts are available keep the UnknownOperatingContextController
            return null;
        }
    }
}
