/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

export const TEST_CONSTANTS = {
    CLIENT_ID: "b41a6fbb-c728-4e03-aa59-d25b0fd383b6",
    DEFAULT_AUTHORITY: "https://login.microsoftonline.com/common/",
    AUTHORITY: "https://login.microsoftonline.com/TenantId",
    DEFAULT_JWKS_URI_AAD: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
    DEFAULT_JWKS_URI_OIDC: "https://login.microsoftonline.com/common/discovery/keys",
    JWKS_URI_AAD: "https://login.microsoftonline.com/TenantId/discovery/v2.0/keys",
    JWKS_URI_OIDC: "https://login.microsoftonline.com/TenantId/discovery/keys",
    DEFAULT_CLOCK_SKEW: 0,
    DEFAULT_ALGORITHM: "RS256",
    DEFAULT_TYPE: "JWT",
    WELL_KNOWN_ENDPOINT: "https://login.microsoftonline.com/common/.well-known/openid-configuration",
    WELL_KNOWN_ENDPOINT_AAD: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
    NONCE: "123523",
    ISSUER_SIGNING_KEYS: [
        {
          kty: 'RSA',
          e: 'AQAB',
          n: '12oBZRhCiZFJLcPg59LkZZ9mdhSMTKAQZYq32k_ti5SBB6jerkh-WzOMAO664r_qyLkqHUSp3u5SbXtseZEpN3XPWGKSxjsy-1JyEFTdLSYe6f9gfrmxkUF_7DTpq0gn6rntP05g2-wFW50YO7mosfdslfrTJYWHFhJALabAeYirYD7-9kqq9ebfFMF4sRRELbv9oi36As6Q9B3Qb5_C1rAzqfao_PCsf9EPsTZsVVVkA5qoIAr47lo1ipfiBPxUCCNSdvkmDTYgvvRm6ZoMjFbvOtgyts55fXKdMWv7I9HMD5HwE9uW839PWA514qhbcIsXEYSFMPMV6fnlsiZvQQ',
          alg: 'PS256'
        },
        {
          crv: 'P-256',
          kty: 'EC',
          x: 'ySK38C1jBdLwDsNWKzzBHqKYEE5Cgv-qjWvorUXk9fw',
          y: '_LeQBw07cf5t57Iavn4j-BqJsAD1dpoz8gokd3sBsOo',
          alg: 'ES256'
        }
      ]
};

export const TEST_HASH_CONSTANTS = {
    CODE: "OAAABAAAA0TWEUN3YUUq5vuCvmnaQiV2K0FwRHqI7u-VXhnGiX0U5u__oid-BUXdlqsWGfHTWV9cIBzYj_S5OoR06m_-b4CbNA-QMMNTCt6VUiynMIRHJvrJMgzuVzkrwnsyfbtMvvpnUoHLH1_qbdkM3dGQj0YgiN_-CcIIzzqtw5KtGmusuZQK8OYQG-KcDqxw1q56mEan2wWrS2U70gWkB0pylkJrOS09BgSmYKZrPCwO7VAco_e9RP8M1fMVP1k5bXCkBwVTCuWm23IXt1CxxJmtQGGEKxH5lETAFqRpFq_P57QDtzjhAPOy6uwM6IXbk2ZU4s3O81M_CTtm3dUlFsYKaPntCgSELZvL0X-6uv5DNXmymJY5hoxcPWlMOOofU7X6fe3U1fBlUsa4ifgaZQsaqQeQO3LR8rYRu3wBKRpGStIvsanGfF9Sdan66EwOmlsdkDhWNgxzM3v0fAvPEg6nyiD7jyfqXBuJCvlGxXdewj82M9xK32xxqB965b9ubR_Ncjki7T4vF0LiO4r85P9yuWktNc_tbnQ0kqFenzozAVQX4t33i-pCk94Me4FUrirRwLvkfwsn0Zmc_aEPa98YHes3cSvA2JZG71SqciA33dV0sTaFOjecjZgk_3_hFO2iTooI27tEBnnkhZNxDIsGpgE4dM0q1wldP-s4UT9QkRmd_LJke7WLyXsdMC9K4x2P6b8P7cngVEzc6yXwbhsq_p3tY5YFDDUecUclgTgeYy1MgAA",
    INVALID_CODE: "PAAABAAAA0TWEUN3YUUq5vuCvmnaQiV2K0FwRHqI7u-VXhnGiX0U5u__oid-BUXdlqsWGfHTWV9cIBzYj_S5OoR06m_-b4CbNA-QMMNTCt6VUiynMIRHJvrJMgzuVzkrwnsyfbtMvvpnUoHLH1_qbdkM3dGQj0YgiN_-CcIIzzqtw5KtGmusuZQK8OYQG-KcDqxw1q56mEan2wWrS2U70gWkB0pylkJrOS09BgSmYKZrPCwO7VAco_e9RP8M1fMVP1k5bXCkBwVTCuWm23IXt1CxxJmtQGGEKxH5lETAFqRpFq_P57QDtzjhAPOy6uwM6IXbk2ZU4s3O81M_CTtm3dUlFsYKaPntCgSELZvL0X-6uv5DNXmymJY5hoxcPWlMOOofU7X6fe3U1fBlUsa4ifgaZQsaqQeQO3LR8rYRu3wBKRpGStIvsanGfF9Sdan66EwOmlsdkDhWNgxzM3v0fAvPEg6nyiD7jyfqXBuJCvlGxXdewj82M9xK32xxqB965b9ubR_Ncjki7T4vF0LiO4r85P9yuWktNc_tbnQ0kqFenzozAVQX4t33i-pCk94Me4FUrirRwLvkfwsn0Zmc_aEPa98YHes3cSvA2JZG71SqciA33dV0sTaFOjecjZgk_3_hFO2iTooI27tEBnnkhZNxDIsGpgE4dM0q1wldP-s4UT9QkRmd_LJke7WLyXsdMC9K4x2P6b8P7cngVEzc6yXwbhsq_p3tY5YFDDUecUclgTgeYy1MgAA",
    C_HASH: "4_VbjhfR5g6MSxOYZcvQdw",
    ACCESS_TOKEN_FOR_AT_HASH: "ThisIsAnAccessT0ken",
    INVALID_ACCESS_TOKEN_FOR_AT_HASH: "ThisIsNotAnAccessToken",
    AT_HASH: "C3UQODVYE3EWwqgApo3SYA"
};
