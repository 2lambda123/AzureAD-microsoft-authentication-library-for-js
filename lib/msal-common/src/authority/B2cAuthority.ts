/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { Authority } from "./Authority";
import { AuthorityType } from "./AuthorityType";
import { ClientConfigurationError } from "../error/ClientConfigurationError";
import { INetworkModule } from "../network/INetworkModule";

/**
 * The B2CAuthority class extends the Authority class and adds functionality specific to B2C Authorities.
 */
export class B2cAuthority extends Authority {
    static B2CTrustedHostList: string[] = [];

    /**
     * Use when Authority is B2C to provide list of trusted/allowed domains.
     */
    static setKnownAuthorities(knownAuthorities: Array<string>): void {
        if (B2cAuthority.B2CTrustedHostList.length === 0){
            knownAuthorities.forEach(function(authority){
                B2cAuthority.B2CTrustedHostList.push(authority);
            });
        }
    }

    // Set authority type to B2C
    public get authorityType(): AuthorityType {
        return AuthorityType.B2C;
    }

    public constructor(authority: string, networkInterface: INetworkModule) {
        super(authority, networkInterface);
    }

    /**
     * Returns a promise which resolves to the OIDC endpoint
     * Only responds with the endpoint
     */
    public async getOpenIdConfigurationEndpointAsync(): Promise<string> {
        if (this.isInTrustedHostList(this.canonicalAuthorityUrlComponents.HostNameAndPort)) {
            return this.defaultOpenIdConfigurationEndpoint;
        }

        throw ClientConfigurationError.createUntrustedAuthorityError();
    }

    /**
     * Checks to see if the host is in a list of trusted hosts
     * @param {string} The host to look up
     */
    private isInTrustedHostList(host: string): boolean {
        return B2cAuthority.B2CTrustedHostList.indexOf(host) > -1;
    }
}
