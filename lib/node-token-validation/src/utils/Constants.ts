/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

export const Constants = {
    DEFAULT_AUTHORITY: "https://login.microsoftonline.com/common/"
};

/**
 * HTTP method constants
 */
export enum HttpMethod {
    GET = "get",
    POST = "post",
}

/**
 * JWT constants
 */
export const JwtConstants = {
    ALGORITHM: "alg",
    RSA_256: "RS256",
    X5T: "x5t", 
    X5C: "x5c",
    AUDIENCE: "aud",
    EXPIRATION_TIME: "exp",
    ISSUER: "iss",
    SUBJECT: "sub",
    NOT_BEFORE: "nbf",
    JWT_ID: "jti",
};

/**
 * Token Types
 */
export const TokenType = {
    JWT: "JWT"
};
