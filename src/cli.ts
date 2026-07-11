import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAxiCli } from "axi-sdk-js";
import { homeCommand } from "./commands/home.js";
import { authCommand, AUTH_HELP } from "./commands/auth.js";
import { teamsCommand, TEAMS_HELP } from "./commands/teams.js";
import { issuesCommand, ISSUES_HELP } from "./commands/issues.js";
import { commentsCommand, COMMENTS_HELP } from "./commands/comments.js";
import { labelsCommand, LABELS_HELP } from "./commands/labels.js";
import { statesCommand, STATES_HELP } from "./commands/states.js";
import { projectsCommand, PROJECTS_HELP } from "./commands/projects.js";
import { usersCommand, USERS_HELP } from "./commands/users.js";
import { resolveCommand, RESOLVE_HELP } from "./commands/resolve.js";
import {
  capabilitiesCommand,
  CAPABILITIES_HELP,
} from "./commands/capabilities.js";
import { setupCommand, SETUP_HELP } from "./commands/setup.js";

export const DESCRIPTION =
  "Browse and manage Linear issues, teams, and comments with token-efficient TOON output.";

const VERSION = readPackageVersion();

export const TOP_LEVEL_HELP = `usage: linear-axi [command] [args] [flags]
commands[12]:
  (none)=home, auth, teams, issues, comments, labels, states, projects, users, resolve, capabilities, setup
flags[2]:
  --help, -v/--version
examples:
  linear-axi
  linear-axi auth status
  linear-axi issues list --assignee me
  linear-axi issues view --id ENG-123
  linear-axi issues create --team ENG --title "Fix auth" --dry-run
  linear-axi resolve --team ENG
  linear-axi setup hooks
`;

const COMMAND_HELP: Record<string, string> = {
  auth: AUTH_HELP,
  teams: TEAMS_HELP,
  issues: ISSUES_HELP,
  comments: COMMENTS_HELP,
  labels: LABELS_HELP,
  states: STATES_HELP,
  projects: PROJECTS_HELP,
  users: USERS_HELP,
  resolve: RESOLVE_HELP,
  capabilities: CAPABILITIES_HELP,
  setup: SETUP_HELP,
};

type MainOptions = {
  argv?: string[];
  stdout?: Pick<NodeJS.WriteStream, "write">;
};

export async function main(options: MainOptions = {}): Promise<void> {
  await runAxiCli({
    ...(options.argv ? { argv: options.argv } : {}),
    ...(options.stdout ? { stdout: options.stdout } : {}),
    description: DESCRIPTION,
    version: VERSION,
    topLevelHelp: TOP_LEVEL_HELP,
    initialize: () => {},
    home: homeCommand,
    getCommandHelp: (command) => COMMAND_HELP[command],
    commands: {
      auth: authCommand,
      teams: teamsCommand,
      issues: issuesCommand,
      comments: commentsCommand,
      labels: labelsCommand,
      states: statesCommand,
      projects: projectsCommand,
      users: usersCommand,
      resolve: resolveCommand,
      capabilities: capabilitiesCommand,
      setup: setupCommand,
    },
  });
}

function readPackageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    join(here, "..", "package.json"),
    join(here, "..", "..", "package.json"),
  ]) {
    if (!existsSync(candidate)) continue;
    const parsed = JSON.parse(readFileSync(candidate, "utf8")) as {
      version?: unknown;
    };
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  }
  return "0.0.0";
}
