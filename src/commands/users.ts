import { AxiError } from "axi-sdk-js";
import { rejectUnknownFlags } from "../args.js";
import { makeGateway } from "../linear.js";
import { field, renderDetail, renderOutput } from "../toon.js";

export const USERS_HELP = `usage: linear-axi users me
examples:
  linear-axi users me
`;

export async function usersCommand(args: string[]): Promise<string> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help") {
    throw new AxiError("Missing users subcommand", "VALIDATION_ERROR", [
      USERS_HELP,
    ]);
  }

  if (sub !== "me") {
    throw new AxiError(`Unknown users subcommand: ${sub}`, "VALIDATION_ERROR", [
      USERS_HELP,
    ]);
  }

  rejectUnknownFlags(rest, new Set(["--help"]), "users me");
  const gateway = makeGateway();
  const user = await gateway.usersMe();

  return renderOutput([
    renderDetail("user", user, [
      field("name"),
      field("email"),
      field("id"),
    ]),
  ]);
}
