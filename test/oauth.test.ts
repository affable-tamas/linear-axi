import { describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOAuthSession, persistRefreshedOAuthTokens } from "../src/oauth.js";

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

  it("persists refreshed OAuth tokens to an existing ignored .env", () => {
    const dir = mkdtempSync(join(tmpdir(), "linear-axi-oauth-"));
    writeFileSync(join(dir, ".gitignore"), ".env\n");
    const envFile = join(dir, ".env");
    writeFileSync(
      envFile,
      "LINEAR_ACCESS_TOKEN=old-token\nLINEAR_OAUTH_REFRESH_TOKEN=old-refresh\n",
    );
    chmodSync(envFile, 0o600);

    const persisted = persistRefreshedOAuthTokens({
      cwd: dir,
      env: {
        LINEAR_OAUTH_CLIENT_ID: "client-id",
        LINEAR_ACCESS_TOKEN: "new-token",
        LINEAR_OAUTH_REFRESH_TOKEN: "new-refresh",
        LINEAR_OAUTH_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
      },
    });

    expect(persisted).toBe(true);
    const content = readFileSync(envFile, "utf8");
    expect(content).toContain("LINEAR_ACCESS_TOKEN=new-token");
    expect(content).toContain("LINEAR_OAUTH_REFRESH_TOKEN=new-refresh");
    expect(content).toContain("LINEAR_OAUTH_EXPIRES_AT=2099-01-01T00:00:00.000Z");
  });

  it("skips persistence when .env is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "linear-axi-oauth-"));
    expect(
      persistRefreshedOAuthTokens({
        cwd: dir,
        env: { LINEAR_ACCESS_TOKEN: "token" },
      }),
    ).toBe(false);
  });
});
