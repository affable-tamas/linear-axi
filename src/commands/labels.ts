import { AxiError } from "axi-sdk-js";
import { rejectUnknownFlags, takeFlag } from "../args.js";
import { makeGateway } from "../linear.js";
import {
  field,
  formatCountLine,
  renderHelp,
  renderList,
  renderOutput,
} from "../toon.js";

export const LABELS_HELP = `usage: linear-axi labels list [--team <key>]
examples:
  linear-axi labels list
  linear-axi labels list --team ENG
`;

const labelSchema = [field("name"), field("color")];

export async function labelsCommand(args: string[]): Promise<string> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help") {
    throw new AxiError("Missing labels subcommand", "VALIDATION_ERROR", [
      LABELS_HELP,
    ]);
  }

  if (sub !== "list") {
    throw new AxiError(`Unknown labels subcommand: ${sub}`, "VALIDATION_ERROR", [
      LABELS_HELP,
    ]);
  }

  rejectUnknownFlags(rest, new Set(["--help", "--team"]), "labels list");
  const gateway = makeGateway();
  const labels = await gateway.listLabels(takeFlag(rest, "--team"));

  return renderOutput([
    `count: ${formatCountLine(labels.length)} labels shown`,
    labels.length > 0
      ? renderList("labels", labels, labelSchema)
      : "labels: 0 labels found",
    renderHelp(
      labels.length === 0
        ? ["No labels matched this scope"]
        : ["Use label names when creating or updating issues in Linear"],
    ),
  ]);
}
