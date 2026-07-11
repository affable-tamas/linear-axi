import { AxiError } from "axi-sdk-js";
import { rejectUnknownFlags, requireFlag } from "../args.js";
import { makeGateway } from "../linear.js";
import {
  field,
  formatCountLine,
  renderHelp,
  renderList,
  renderOutput,
} from "../toon.js";

export const STATES_HELP = `usage: linear-axi states list --team <key>
examples:
  linear-axi states list --team ENG
`;

const stateSchema = [field("name"), field("type")];

export async function statesCommand(args: string[]): Promise<string> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help") {
    throw new AxiError("Missing states subcommand", "VALIDATION_ERROR", [
      STATES_HELP,
    ]);
  }

  if (sub !== "list") {
    throw new AxiError(`Unknown states subcommand: ${sub}`, "VALIDATION_ERROR", [
      STATES_HELP,
    ]);
  }

  rejectUnknownFlags(rest, new Set(["--help", "--team"]), "states list");
  const team = requireFlag(
    rest,
    "--team",
    "Usage: linear-axi states list --team ENG",
  );
  const gateway = makeGateway();
  const states = await gateway.listStates(team);

  return renderOutput([
    `count: ${formatCountLine(states.length)} states shown`,
    states.length > 0
      ? renderList("states", states, stateSchema)
      : "states: 0 workflow states found",
    renderHelp(
      states.length === 0
        ? ["Check the team key with `linear-axi teams list`"]
        : ["Run `linear-axi issues state --id <id> --state \"<name>\"` to transition"],
    ),
  ]);
}
