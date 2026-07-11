import { encode } from "@toon-format/toon";
import { renderHelp, renderOutput } from "../toon.js";

export const CAPABILITIES_HELP = `usage: linear-axi capabilities
List stable linear-axi commands for cold-start discovery.
`;

const COMMANDS = [
  { command: "home", stability: "stable", description: "Assigned issues dashboard" },
  { command: "auth status", stability: "stable", description: "Check credentials" },
  { command: "auth login", stability: "stable", description: "OAuth login flow" },
  { command: "teams list", stability: "stable", description: "List workspace teams" },
  { command: "issues list", stability: "stable", description: "List issues with filters" },
  { command: "issues search", stability: "stable", description: "Full-text issue search" },
  { command: "issues view", stability: "stable", description: "Issue detail with comments" },
  { command: "issues create", stability: "stable", description: "Create issue (--dry-run)" },
  { command: "issues update", stability: "stable", description: "Update issue (--dry-run)" },
  { command: "issues assign", stability: "stable", description: "Assign issue (--dry-run)" },
  { command: "issues state", stability: "stable", description: "Change workflow state (--dry-run)" },
  { command: "comments create", stability: "stable", description: "Add comment (--dry-run)" },
  { command: "labels list", stability: "stable", description: "List labels" },
  { command: "states list", stability: "stable", description: "List workflow states" },
  { command: "projects list", stability: "stable", description: "List projects" },
  { command: "users me", stability: "stable", description: "Current viewer identity" },
  { command: "resolve", stability: "stable", description: "Fuzzy ref resolution" },
  { command: "setup hooks", stability: "stable", description: "Install session hooks" },
];

export async function capabilitiesCommand(args: string[]): Promise<string> {
  if (args.length > 0 && args[0] !== "--help") {
    return renderOutput([
      encode({ capabilities: COMMANDS }),
      renderHelp(["Run `linear-axi <command> --help` for subcommand details"]),
    ]);
  }

  return renderOutput([
    encode({ count: COMMANDS.length, capabilities: COMMANDS }),
    renderHelp([
      "Run `linear-axi` for live assigned issues",
      "Run `linear-axi issues list --assignee me` for your queue",
    ]),
  ]);
}
