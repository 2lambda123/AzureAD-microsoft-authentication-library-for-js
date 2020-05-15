import { expect } from "chai";
import { describe, it } from "mocha";
import { WindowUtils } from "../../src/utils/WindowUtils";
import { FramePrefix } from "../../src/utils/Constants";
import { TEST_CONFIG } from "../TestConstants";
import { ClientAuthError } from "../../src/error/ClientAuthError";
import { Logger } from "../../src";

describe("WindowUtils", () => {
    describe("monitorWindowForHash", () => {
        it("times out (popup)", done => {
            const iframe = {
                contentWindow: {
                    location: {
                        href: "http://localhost",
                        hash: ""
                    }
                }
            };

            // @ts-ignore
            WindowUtils.monitorWindowForHash(iframe.contentWindow, 500)
                .catch((err: ClientAuthError) => {
                    done();
                });
        });

        it("times out (iframe)", done => {
            const iframe = {
                contentWindow: {
                    // @ts-ignore
                    location: null // example of scenario that would never otherwise resolve
                }
            };

            // @ts-ignore
            WindowUtils.monitorWindowForHash(iframe.contentWindow, 500, "http://login.microsoftonline.com", true)
                .catch((err: ClientAuthError) => {
                    done();
                });
        });

        it("returns hash", done => {
            const iframe = {
                contentWindow: {
                    location: {
                        href: "http://localhost",
                        hash: ""
                    }
                }
            };

            // @ts-ignore
            WindowUtils.monitorWindowForHash(iframe.contentWindow, 1000)
                .then((hash: string) => {
                    expect(hash).to.equal("#access_token=hello");
                    done();
                });

            setTimeout(() => {
                iframe.contentWindow.location = {
                    href: "http://localhost/#/access_token=hello",
                    hash: "#access_token=hello"
                };
            }, 500);
        });

        it("closed", done => {
            const iframe = {
                contentWindow: {
                    location: {
                        href: "http://localhost",
                        hash: ""
                    },
                    closed: false
                }
            };

            // @ts-ignore
            WindowUtils.monitorWindowForHash(iframe.contentWindow, 1000)
                .catch((error: ClientAuthError) => {
                    expect(error.errorCode).to.equal('user_cancelled');
                    done();
                });

            setTimeout(() => {
                iframe.contentWindow.closed = true;
            }, 500);
        });
    });

    describe("generateFrameName", () => {
        it("test idToken frame name created", () => {
            const scopes = ["s1", "s2", "s3"];
            const authority = TEST_CONFIG.validAuthority;
            const requestSignature = `${scopes.join(" ").toLowerCase()}|${authority}`;

            const idTokenFrameName = WindowUtils.generateFrameName(FramePrefix.ID_TOKEN_FRAME, requestSignature);
            const tokenFrameName = WindowUtils.generateFrameName(FramePrefix.TOKEN_FRAME, requestSignature);

            expect(idTokenFrameName).to.equal(`${FramePrefix.ID_TOKEN_FRAME}|s1 s2 s3|${TEST_CONFIG.validAuthority}`);
            expect(tokenFrameName).to.equal(`${FramePrefix.TOKEN_FRAME}|s1 s2 s3|${TEST_CONFIG.validAuthority}`);
        });
    });

    describe("loadFrameSync", () => {
        it("loads iframe using addHiddenIFrame", () => {
            const logger = new Logger(() => {});
            const iframe = WindowUtils.loadFrameSync("https://test1.com/", "testFrame", logger);

            expect(iframe.getAttribute("id")).to.equal("testFrame");
        });

        it("sets src for iframe", () => {
            const logger = new Logger(() => {});
            const iframe = WindowUtils.loadFrameSync("https://test2.com/", "testFrame2", logger);

            expect(iframe.src).to.equal("https://test2.com/");
        });
    });

    describe("addHiddenIFrame", () => {
        it("returns null if iframeId is undefined", () => {
            const iframe = WindowUtils.addHiddenIFrame(undefined, null);
            expect(iframe).to.equals(null);
        });

        it("creates and returns an iframe with expected attributes", () => {
            const logger = new Logger(() => {});
            const iframe = WindowUtils.addHiddenIFrame("testIframe", logger);

            expect(iframe.getAttribute("id")).to.equals("testIframe");
            expect(iframe.getAttribute("aria-hidden")).to.equals("true");
            expect(iframe.getAttribute("sandbox")).to.equals("allow-scripts allow-same-origin allow-forms");
            expect(iframe.style.visibility).to.equals("hidden");
            expect(iframe.style.position).to.equals("absolute");
            expect(iframe.style.width).to.equals("0px");
            expect(iframe.style.border).to.equals("0px");
        });

        it("sets iframeId if window.frames exists", () => {
            const logger = new Logger(() => {});
            const iframe = WindowUtils.addHiddenIFrame("testId", logger);

            expect(iframe).to.equals(window.frames["testId"]);
        });
    });
});
