import { AxiError } from "axi-sdk-js";
import { encode } from "@toon-format/toon";
import { rejectUnknownFlags, takeFlag } from "../args.js";
import { makeGateway } from "../linear.js";
import { renderHelp, renderOutput } from "../toon.js";

export const RESOLVE_HELP = `usage: linear-axi resolve [--team <key>] [--issue <id>] [--state <name> --team <key>] [--user <email>]
Resolve fuzzy references to canonical Linear ids.
examples:
  linear-axi resolve --team ENG
  linear-axi resolve --issue ENG-123
  linear-axi resolve --state "In Progress" --team ENG
  linear-axi resolve --user jane@company.com
`;

export async function resolveCommand(args: string[]): Promise<string> {
  rejectUnknownFlags(
    args,
    new Set(["--help", "--team", "--issue", "--state", "--user"]),
    "resolve",
  );

  const team = takeFlag(args, "--team");
  const issue = takeFlag(args, "--issue");
  const state = takeFlag(args, "--state");
  const user = takeFlag(args, "--user");

  const gateway = makeGateway();
  let result;

  if (issue) {
    result = await gateway.resolveIssue(issue);
  } else if (user) {
    result = await gateway.resolveUser(user);
  } else if (state) {
    if (!team) {
      throw new AxiError(
        "--team is required when resolving workflow state",
        "VALIDATION_ERROR",
        ["Usage: linear-axi resolve --state \"In Progress\" --team ENG"],
      );
    }
    result = await gateway.resolveState(state, team);
  } else if (team) {
    result = await gateway.resolveTeam(team);
  } else {
    throw new AxiError(
      "Provide one of --team, --issue, --state (with --team), or --user",
      "VALIDATION_ERROR",
      [RESOLVE_HELP],
    );
  }

  if (result.ambiguous) {
    return renderOutput([
      encode({ ambiguous: true, candidates: result.candidates }),
      renderHelp(["Pick one candidate and rerun the mutation with the canonical ref"]),
    ]);
  }

  if (!result.resolved) {
    return renderOutput([
      encode({ resolved: null, message: "0 matches found" }),
      renderHelp(["Run `linear-axi teams list` or broaden the query"]),
    ]);
  }

  return renderOutput([
    encode({ resolved: result.resolved }),
    renderHelp(["Use the resolved id/key in subsequent commands"]),
  ]);
}
