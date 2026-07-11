import { AxiError } from "axi-sdk-js";
import { encode } from "@toon-format/toon";
import { loadEnv } from "../env.js";
import { connectOAuth } from "../oauth.js";
import { makeGateway } from "../linear.js";
import {
  rejectUnknownFlags,
  takeBoolFlag,
  takeFlag,
} from "../args.js";
import { renderHelp, renderOutput } from "../toon.js";

export const AUTH_HELP = `usage: linear-axi auth <status|login>
subcommands[2]:
  status, login
flags{login}:
  --write-env, --prompt-consent, --client-id, --redirect-uri, --scope, --actor, --timeout
examples:
  linear-axi auth status
  linear-axi auth login --write-env --prompt-consent
`;

export async function authCommand(args: string[]): Promise<string> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help") {
    throw new AxiError("Missing auth subcommand", "VALIDATION_ERROR", [
      AUTH_HELP,
    ]);
  }

  switch (sub) {
    case "status":
      return authStatus(rest);
    case "login":
      return authLogin(rest);
    default:
      throw new AxiError(`Unknown auth subcommand: ${sub}`, "VALIDATION_ERROR", [
        AUTH_HELP,
      ]);
  }
}

async function authStatus(args: string[]): Promise<string> {
  rejectUnknownFlags(args, new Set(["--help"]), "auth status");
  const gateway = makeGateway();
  const auth = await gateway.authStatus();
  const help =
    auth.authenticated
      ? []
      : [
          "Set LINEAR_API_KEY or LINEAR_ACCESS_TOKEN",
          "Run `linear-axi auth login --write-env` to connect via OAuth",
        ];
  return renderOutput([
    encode({ auth }),
    ...(help.length > 0 ? [renderHelp(help)] : []),
  ]);
}

async function authLogin(args: string[]): Promise<string> {
  const allowed = new Set([
    "--help",
    "--write-env",
    "--prompt-consent",
    "--client-id",
    "--redirect-uri",
    "--scope",
    "--actor",
    "--timeout",
  ]);
  rejectUnknownFlags(args, allowed, "auth login");

  const timeoutRaw = takeFlag(args, "--timeout");
  if (
    timeoutRaw !== undefined &&
    (!/^[0-9]+$/.test(timeoutRaw) ||
      Number(timeoutRaw) < 30 ||
      Number(timeoutRaw) > 3600)
  ) {
    throw new AxiError(
      "--timeout must be an integer between 30 and 3600",
      "VALIDATION_ERROR",
      ["Usage: linear-axi auth login --timeout 300"],
    );
  }

  const result = await connectOAuth({
    env: loadEnv(),
    cwd: process.cwd(),
    clientId: takeFlag(args, "--client-id"),
    redirectUri: takeFlag(args, "--redirect-uri"),
    scope: takeFlag(args, "--scope"),
    actor: takeFlag(args, "--actor"),
    promptConsent: takeBoolFlag(args, "--prompt-consent"),
    writeEnv: takeBoolFlag(args, "--write-env"),
    timeoutSeconds:
      timeoutRaw === undefined ? undefined : Number(timeoutRaw),
  });

  return renderOutput([
    encode({ auth: result.auth }),
    renderHelp(result.help),
  ]);
}
