/// <reference path="../../out/msal.d.ts" />
/// <reference path="../../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../../node_modules/@types/jasmine-ajax/index.d.ts" />

describe("Authority", () => {
    describe("AadAuthority", () => {
        beforeEach(function () {
            jasmine.Ajax.install();
        });

        afterEach(function () {
            jasmine.Ajax.uninstall();
        });

        it("can be created", () => {
            // Arrange
            let url = "https://login.microsoftonline.in/MYTENANT.com";
            let validate = false;

            // Act
            let authority = MSAL.Authority.CreateInstance(url, validate);

            // Assert
            expect(authority.CanonicalAuthority).toEqual("https://login.microsoftonline.in/mytenant.com/");
            expect(authority.AuthorityType).toEqual(MSAL.AuthorityType.Aad);
        });

        it("can be resolved", (done) => {
            // Arrange
            let url = "https://login.microsoftonline.com/6babcaad-604b-40ac-a9d7-9fd97c0b779f";
            let validate = true;
            jasmine.Ajax.stubRequest(/.*openid-configuration/i).andReturn({
                responseText: '{"authorization_endpoint":"https://authorization_endpoint","token_endpoint":"https://token_endpoint","issuer":"https://fakeIssuer"}'
            });

            // Act
            let authority = MSAL.Authority.CreateInstance(url, validate);
            let promise = authority.ResolveEndpointsAsync();

            // Assert
            promise.then((authority) => {
                expect(authority.AuthorityType).toEqual(MSAL.AuthorityType.Aad);
                expect(authority.AuthorizationEndpoint).toEqual("https://authorization_endpoint");
                expect(authority.TokenEndpoint).toEqual("https://token_endpoint");
                expect(authority.SelfSignedJwtAudience).toEqual("https://fakeIssuer");
                done();
            });
        });
    });

    describe("B2cAuthority", () => {
        beforeEach(function () {
            jasmine.Ajax.install();
        });

        afterEach(function () {
            jasmine.Ajax.uninstall();
        });

        it("can be created", () => {
            // Arrange
            let url = "https://login.microsoftonline.in:444/tfp/tenant/policy";
            let validate = false;

            // Act
            let authority = MSAL.Authority.CreateInstance(url, validate);

            // Assert
            expect(authority.CanonicalAuthority).toEqual(`${url}/`);
            expect(authority.AuthorityType).toEqual(MSAL.AuthorityType.B2C);
        });

        it("should fail when path doesnt have enough segments", () => {
            // Arrange
            let url = "https://login.microsoftonline.com/tfp/";
            let validate = false;

            // Act
            let call = () => MSAL.Authority.CreateInstance(url, validate);

            // Assert
            expect(call).toThrow("B2cAuthorityUriInvalidPath");
        });

        it("should fail when validation is not supported", (done) => {
            // Arrange
            let url = "https://login.microsoftonline.in/tfp/tenant/policy";
            let validate = true;

            // Act
            let authority = MSAL.Authority.CreateInstance(url, validate);
            let promise = authority.ResolveEndpointsAsync();

            // Assert
            promise.catch((error) => {
                expect(error).toEqual("UnsupportedAuthorityValidation");
                done();
            });
        });
    });
});