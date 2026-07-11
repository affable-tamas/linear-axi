import { AxiError } from "axi-sdk-js";
import { encode } from "@toon-format/toon";
import { rejectUnknownFlags, takeLimit } from "../args.js";
import { makeGateway } from "../linear.js";
import {
  field,
  formatCountLine,
  renderHelp,
  renderList,
  renderOutput,
} from "../toon.js";

export const TEAMS_HELP = `usage: linear-axi teams list [--limit 50]
  --limit max 250
examples:
  linear-axi teams list
  linear-axi teams list --limit 25
`;

const teamSchema = [field("key"), field("name")];

export async function teamsCommand(args: string[]): Promise<string> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help") {
    throw new AxiError("Missing teams subcommand", "VALIDATION_ERROR", [
      TEAMS_HELP,
    ]);
  }

  if (sub !== "list") {
    throw new AxiError(`Unknown teams subcommand: ${sub}`, "VALIDATION_ERROR", [
      TEAMS_HELP,
    ]);
  }

  rejectUnknownFlags(rest, new Set(["--help", "--limit"]), "teams list");
  const limit = takeLimit(rest, 50);
  const gateway = makeGateway();
  const teams = await gateway.listTeams(limit);

  return renderOutput([
    `count: ${formatCountLine(teams.length)} teams shown`,
    teams.length > 0
      ? renderList("teams", teams, teamSchema)
      : "teams: 0 teams found",
    renderHelp(
      teams.length === 0
        ? ["No teams were returned for this Linear account"]
        : ["Run `linear-axi issues list --team <key>` to list team issues"],
    ),
  ]);
}
