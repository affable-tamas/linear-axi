import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { AxiError } from "axi-sdk-js";
import { parseDotEnv, type Env } from "./env.js";
import { isListedInGitignore } from "./utils.js";

const authorizeEndpoint = "https://linear.app/oauth/authorize";
const tokenEndpoint = "https://api.linear.app/oauth/token";
const defaultRedirectUri = "http://127.0.0.1:14582/oauth/callback";
const defaultClientId = "ccca1dd4294ba5c02db81a5db629ba17";

export const DEFAULT_OAUTH_CLIENT_ID = defaultClientId;

export interface OAuthConnectInput {
  env: Env;
  cwd: string;
  clientId?: string;
  redirectUri?: string;
  scope?: string;
  actor?: string;
  promptConsent: boolean;
  writeEnv: boolean;
  envFile?: string;
  timeoutSeconds?: number;
}

export interface OAuthSession {
  state: string;
  codeVerifier: string;
  authorizeUrl: string;
  redirectUri: string;
  scope: string;
  actor: "user" | "app";
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string | ReadonlyArray<string>;
  refresh_token?: string;
}

export async function connectOAuth(input: OAuthConnectInput): Promise<{
  auth: Record<string, unknown>;
  help: string[];
}> {
  const clientId =
    input.clientId ?? input.env.LINEAR_OAUTH_CLIENT_ID ?? defaultClientId;
  const redirectUri =
    input.redirectUri ??
    input.env.LINEAR_OAUTH_REDIRECT_URI ??
    defaultRedirectUri;
  const scope = input.scope ?? input.env.LINEAR_OAUTH_SCOPE ?? "read,write";
  const actor = normalizeActor(input.actor ?? input.env.LINEAR_OAUTH_ACTOR ?? "user");
  const timeoutSeconds = input.timeoutSeconds ?? 300;
  const envFile = resolve(input.cwd, input.envFile ?? ".env");

  validateLocalRedirectUri(redirectUri);

  if (input.writeEnv) {
    ensureEnvFileCanStoreSecrets(envFile, input.cwd);
  }

  const session = createOAuthSession({
    clientId,
    redirectUri,
    scope,
    actor,
    promptConsent: input.promptConsent,
  });

  process.stderr.write(`Open this Linear OAuth URL:\n${session.authorizeUrl}\n`);
  process.stderr.write(
    "If the browser cannot reach localhost after approval, paste the full callback URL here and press Enter.\n",
  );

  const code = await waitForOAuthCode({
    redirectUri,
    state: session.state,
    timeoutSeconds,
  });

  const token = await exchangeCodeForToken({
    clientId,
    code,
    codeVerifier: session.codeVerifier,
    redirectUri,
  });

  if (input.writeEnv) {
    writeOAuthEnv(envFile, {
      LINEAR_OAUTH_CLIENT_ID: clientId,
      LINEAR_OAUTH_REDIRECT_URI: redirectUri,
      LINEAR_OAUTH_SCOPE: scope,
      LINEAR_OAUTH_ACTOR: actor,
      LINEAR_ACCESS_TOKEN: token.access_token,
      LINEAR_OAUTH_REFRESH_TOKEN: token.refresh_token,
      LINEAR_OAUTH_EXPIRES_AT: new Date(
        Date.now() + token.expires_in * 1000,
      ).toISOString(),
    });
  }

  return {
    auth: {
      connected: true,
      method: "oauth",
      actor,
      scope: normalizeScope(token.scope),
      tokenType: token.token_type,
      expiresIn: token.expires_in,
      refreshToken: token.refresh_token ? "stored" : "missing",
      envFile: input.writeEnv ? collapseCwd(envFile, input.cwd) : "not written",
    },
    help: input.writeEnv
      ? [
          "Run `linear-axi auth status` to verify the saved token",
          "Run `linear-axi teams list` to inspect the connected workspace",
        ]
      : [
          "Rerun with `--write-env` to save tokens to .env",
          "Do not paste OAuth tokens into chat or command logs",
        ],
  };
}

export function createOAuthSession(input: {
  clientId: string;
  redirectUri: string;
  scope: string;
  actor: "user" | "app";
  promptConsent: boolean;
}): OAuthSession {
  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(64));
  const codeChallenge = base64Url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  const url = new URL(authorizeEndpoint);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("actor", input.actor);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (input.promptConsent) {
    url.searchParams.set("prompt", "consent");
  }

  return {
    state,
    codeVerifier,
    authorizeUrl: url.toString(),
    redirectUri: input.redirectUri,
    scope: input.scope,
    actor: input.actor,
  };
}

async function waitForOAuthCode(input: {
  redirectUri: string;
  state: string;
  timeoutSeconds: number;
}): Promise<string> {
  const redirectUrl = new URL(input.redirectUri);
  const port = Number(redirectUrl.port);
  const host = redirectUrl.hostname;
  const callbackPath = redirectUrl.pathname;
  let settled = false;
  let manualBuffer = "";

  return new Promise((resolvePromise, rejectPromise) => {
    const cleanup = (server: ReturnType<typeof createServer>) => {
      clearTimeout(timer);
      process.stdin.off("data", onManualCallback);
      process.stdin.pause();
      server.closeAllConnections();
      server.close();
    };

    const settle = (code: string | Error) => {
      if (settled) return;
      settled = true;
      cleanup(server);
      if (code instanceof Error) {
        rejectPromise(code);
      } else {
        resolvePromise(code);
      }
    };

    const onManualCallback = (chunk: Buffer | string) => {
      manualBuffer += chunk.toString();
      let newlineIndex = manualBuffer.search(/\r?\n/);
      while (newlineIndex !== -1) {
        const line = manualBuffer.slice(0, newlineIndex).trim();
        manualBuffer = manualBuffer.slice(
          newlineIndex +
            (manualBuffer[newlineIndex] === "\r" &&
            manualBuffer[newlineIndex + 1] === "\n"
              ? 2
              : 1),
        );
        if (line.length > 0) {
          try {
            settle(readOAuthCodeFromCallbackUrl(line, callbackPath, input.state));
          } catch (error) {
            settle(error instanceof Error ? error : new Error(String(error)));
          }
          return;
        }
        newlineIndex = manualBuffer.search(/\r?\n/);
      }
    };

    const server = createServer((request, response) => {
      handleCallbackRequest(request, response, callbackPath, input.state, settle);
    });

    const timer = setTimeout(() => {
      settle(
        new AxiError(
          "Timed out waiting for Linear OAuth callback",
          "TIMEOUT",
          ["Rerun `linear-axi auth login` and complete browser authorization"],
        ),
      );
    }, input.timeoutSeconds * 1000);

    server.on("error", (cause) => {
      settle(
        new AxiError(readableError(cause), "RUNTIME_ERROR", [
          "Check that the redirect URI port is available",
        ]),
      );
    });

    process.stdin.on("data", onManualCallback);
    process.stdin.resume();
    server.listen(port, host);
  });
}

function handleCallbackRequest(
  request: IncomingMessage,
  response: ServerResponse,
  callbackPath: string,
  expectedState: string,
  settle: (code: string | Error) => void,
): void {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  if (requestUrl.pathname !== callbackPath) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found");
    return;
  }

  const state = requestUrl.searchParams.get("state") ?? "";
  if (state !== expectedState) {
    response.writeHead(400, { "content-type": "text/plain" });
    response.end("Invalid OAuth state");
    settle(
      new AxiError("Invalid OAuth state", "AUTH_ERROR", [
        "Restart `linear-axi auth login` with a fresh authorize URL",
      ]),
    );
    return;
  }

  const error = requestUrl.searchParams.get("error");
  if (error) {
    response.writeHead(400, { "content-type": "text/plain" });
    response.end("Linear authorization failed");
    settle(
      new AxiError(`Linear OAuth returned ${error}`, "AUTH_ERROR", [
        "Retry after approving the requested Linear access",
      ]),
    );
    return;
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    response.writeHead(400, { "content-type": "text/plain" });
    response.end("Missing OAuth code");
    settle(
      new AxiError("OAuth callback missing authorization code", "AUTH_ERROR", [
        "Restart `linear-axi auth login` and complete Linear authorization",
      ]),
    );
    return;
  }

  response.writeHead(200, { "content-type": "text/plain" });
  response.end("Linear authorization complete. You can close this tab.");
  settle(code);
}

function readOAuthCodeFromCallbackUrl(
  callbackUrl: string,
  callbackPath: string,
  expectedState: string,
): string {
  let requestUrl: URL;
  try {
    requestUrl = new URL(callbackUrl);
  } catch {
    throw new AxiError(
      "Pasted OAuth callback URL is not valid",
      "VALIDATION_ERROR",
      ["Paste the full callback URL from the browser address bar"],
    );
  }

  if (requestUrl.pathname !== callbackPath) {
    throw new AxiError(
      "Callback URL path did not match redirect URI",
      "VALIDATION_ERROR",
      ["Paste the full callback URL from the browser"],
    );
  }

  const state = requestUrl.searchParams.get("state") ?? "";
  if (state !== expectedState) {
    throw new AxiError("Callback URL had invalid state", "AUTH_ERROR", [
      "Restart `linear-axi auth login`",
    ]);
  }

  const error = requestUrl.searchParams.get("error");
  if (error) {
    throw new AxiError(`Linear OAuth returned ${error}`, "AUTH_ERROR", []);
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    throw new AxiError("Callback URL missing authorization code", "AUTH_ERROR", []);
  }

  return code;
}

async function exchangeCodeForToken(input: {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code: input.code,
    code_verifier: input.codeVerifier,
  });
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new AxiError(readOAuthError(json, response.status), "AUTH_ERROR", [
      "Check OAuth redirect URI and rerun `linear-axi auth login`",
    ]);
  }
  return tokenResponse(json);
}

function validateLocalRedirectUri(redirectUri: string): void {
  try {
    const redirectUrl = new URL(redirectUri);
    const port = Number(redirectUrl.port);
    if (!redirectUrl.port || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("missing port");
    }
    if (!isLoopbackHost(redirectUrl.hostname)) {
      throw new Error("non-loopback host");
    }
  } catch {
    throw new AxiError(
      "redirect URI must be a local callback with explicit port",
      "VALIDATION_ERROR",
      ["Use --redirect-uri http://127.0.0.1:14582/oauth/callback"],
    );
  }
}

function ensureEnvFileCanStoreSecrets(envFile: string, cwd: string): void {
  const relative = relativeToCwd(envFile, cwd);
  if (relative.startsWith("/")) {
    throw new AxiError(
      "refusing to write OAuth tokens outside the current repo",
      "VALIDATION_ERROR",
      ["Use a repo-local .env file"],
    );
  }
  const result = spawnSync("git", ["check-ignore", "-q", "--", relative], {
    cwd,
    stdio: "ignore",
  });
  if (result.status === 0 || isListedInGitignore(relative, cwd)) {
    return;
  }
  throw new AxiError(
    "refusing to write OAuth tokens to a tracked env file",
    "VALIDATION_ERROR",
    ["Add `.env` to .gitignore, then rerun with `--write-env`"],
  );
}

function writeOAuthEnv(
  envFile: string,
  values: Record<string, string | undefined>,
): void {
  const existing = existsSync(envFile)
    ? parseDotEnv(readFileSync(envFile, "utf8"))
    : {};
  const next = { ...existing, ...values };
  const orderedKeys = [
    "LINEAR_OAUTH_CLIENT_ID",
    "LINEAR_OAUTH_REDIRECT_URI",
    "LINEAR_OAUTH_SCOPE",
    "LINEAR_OAUTH_ACTOR",
    "LINEAR_ACCESS_TOKEN",
    "LINEAR_OAUTH_REFRESH_TOKEN",
    "LINEAR_OAUTH_EXPIRES_AT",
  ];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const key of orderedKeys) {
    const value = next[key];
    if (value !== undefined && value.length > 0) {
      lines.push(`${key}=${quoteDotEnv(value)}`);
      seen.add(key);
    }
  }
  for (const [key, value] of Object.entries(next).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!seen.has(key) && value !== undefined) {
      lines.push(`${key}=${quoteDotEnv(value)}`);
    }
  }
  writeFileSync(envFile, `${lines.join("\n")}\n`, { mode: 0o600 });
  chmodSync(envFile, 0o600);
}

function normalizeActor(actor: string): "user" | "app" {
  if (actor === "user" || actor === "app") return actor;
  throw new AxiError("--actor must be `user` or `app`", "VALIDATION_ERROR", []);
}

function tokenResponse(json: Record<string, unknown>): OAuthTokenResponse {
  if (
    typeof json.access_token !== "string" ||
    typeof json.token_type !== "string" ||
    typeof json.expires_in !== "number" ||
    (typeof json.scope !== "string" && !Array.isArray(json.scope))
  ) {
    throw new AxiError(
      "Linear OAuth token response missing expected fields",
      "AUTH_ERROR",
      [],
    );
  }
  return {
    access_token: json.access_token,
    token_type: json.token_type,
    expires_in: json.expires_in,
    scope: json.scope as string | ReadonlyArray<string>,
    refresh_token:
      typeof json.refresh_token === "string" ? json.refresh_token : undefined,
  };
}

function readOAuthError(json: Record<string, unknown>, status: number): string {
  const description =
    typeof json.error_description === "string"
      ? json.error_description
      : undefined;
  const error = typeof json.error === "string" ? json.error : undefined;
  return description ?? error ?? `Linear OAuth failed with HTTP ${status}`;
}

function base64Url(bytes: Buffer): string {
  return bytes
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function isLoopbackHost(host: string): boolean {
  return (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]"
  );
}

function normalizeScope(scope: string | ReadonlyArray<string>): string {
  return typeof scope === "string" ? scope : scope.join(" ");
}

function quoteDotEnv(value: string): string {
  if (/^[A-Za-z0-9_./:@,+-]+$/.test(value)) return value;
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n")}"`;
}

function relativeToCwd(file: string, cwd: string): string {
  const cwdWithSlash = resolve(cwd);
  const absolute = resolve(file);
  return absolute.startsWith(`${cwdWithSlash}/`)
    ? absolute.slice(cwdWithSlash.length + 1)
    : absolute;
}

function collapseCwd(file: string, cwd: string): string {
  const relative = relativeToCwd(file, cwd);
  return relative.startsWith("/") ? file : relative;
}

export async function refreshOAuthToken(input: {
  clientId: string;
  refreshToken: string;
}): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: input.clientId,
    refresh_token: input.refreshToken,
  });
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new AxiError(readOAuthError(json, response.status), "AUTH_ERROR", [
      "Rerun `linear-axi auth login --write-env` to reconnect OAuth",
    ]);
  }
  return tokenResponse(json);
}

function readableError(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message.replaceAll(/\s+/g, " ").trim();
  }
  return "Linear OAuth request failed";
}
