import { describe, expect, it } from "vitest";
import { createOAuthSession } from "../src/oauth.js";

describe("oauth", () => {
  it("creates an OAuth session with PKCE", () => {
    const session = createOAuthSession({
      clientId: "test-client",
      redirectUri: "http://127.0.0.1:14582/oauth/callback",
      scope: "read,write",
      actor: "user",
      promptConsent: true,
    });

    expect(session.authorizeUrl).toContain("linear.app/oauth/authorize");
    expect(session.authorizeUrl).toContain("code_challenge=");
    expect(session.authorizeUrl).toContain("prompt=consent");
    expect(session.state.length).toBeGreaterThan(10);
    expect(session.codeVerifier.length).toBeGreaterThan(10);
  });
});
