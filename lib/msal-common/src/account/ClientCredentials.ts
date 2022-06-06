/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Client Assertion credential for Confidential Clients
 */
export type ClientAssertionCredential = {
    assertion: string,
    assertionType: string
};

/**
 * Client Credentials set for Confidential Clients
 */
export type ClientCredentials = {
    clientSecret?: string,
    clientAssertion?: ClientAssertionCredential
};
