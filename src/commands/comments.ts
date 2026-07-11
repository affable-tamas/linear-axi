import { AxiError } from "axi-sdk-js";
import { encode } from "@toon-format/toon";
import {
  rejectUnknownFlags,
  requireFlag,
  takeBoolFlag,
  takeBody,
} from "../args.js";
import { makeGateway } from "../linear.js";
import { renderDetail, renderHelp, renderOutput } from "../toon.js";

export const COMMENTS_HELP = `usage: linear-axi comments create --issue <id> --body "..."
flags:
  --issue (required), --body (required), --dry-run
examples:
  linear-axi comments create --issue ENG-123 --body "Shipped in PR"
  linear-axi comments create --issue ENG-123 --body "Preview" --dry-run
`;

export async function commentsCommand(args: string[]): Promise<string> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help") {
    throw new AxiError("Missing comments subcommand", "VALIDATION_ERROR", [
      COMMENTS_HELP,
    ]);
  }

  if (sub !== "create") {
    throw new AxiError(`Unknown comments subcommand: ${sub}`, "VALIDATION_ERROR", [
      COMMENTS_HELP,
    ]);
  }

  rejectUnknownFlags(
    rest,
    new Set(["--help", "--issue", "--body", "--dry-run"]),
    "comments create",
  );
  const dryRun = takeBoolFlag(rest, "--dry-run");
  const issue = requireFlag(
    rest,
    "--issue",
    "Usage: linear-axi comments create --issue ENG-123 --body \"...\"",
  );
  const body = requireFlag(
    rest,
    "--body",
    "Usage: linear-axi comments create --issue ENG-123 --body \"...\"",
  );

  if (dryRun) {
    return renderOutput([
      encode({
        dry_run: true,
        operation: "comments.create",
        input: { issue, body },
      }),
      renderHelp(["Re-run without --dry-run to apply"]),
    ]);
  }

  const gateway = makeGateway();
  const comment = await gateway.createComment({ issue, body });
  return renderOutput([
    renderDetail("comment", comment, [
      { type: "field", key: "id" },
      { type: "field", key: "author" },
      { type: "field", key: "body" },
    ]),
  ]);
}
