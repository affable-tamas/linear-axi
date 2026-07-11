import { AxiError } from "axi-sdk-js";
import { rejectUnknownFlags, takeLimit } from "../args.js";
import { makeGateway } from "../linear.js";
import {
  field,
  formatCountLine,
  renderHelp,
  renderList,
  renderOutput,
} from "../toon.js";

export const PROJECTS_HELP = `usage: linear-axi projects list [--limit 20]
  --limit max 250
examples:
  linear-axi projects list
`;

const projectSchema = [field("name"), field("state")];

export async function projectsCommand(args: string[]): Promise<string> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help") {
    throw new AxiError("Missing projects subcommand", "VALIDATION_ERROR", [
      PROJECTS_HELP,
    ]);
  }

  if (sub !== "list") {
    throw new AxiError(`Unknown projects subcommand: ${sub}`, "VALIDATION_ERROR", [
      PROJECTS_HELP,
    ]);
  }

  rejectUnknownFlags(rest, new Set(["--help", "--limit"]), "projects list");
  const limit = takeLimit(rest, 20);
  const gateway = makeGateway();
  const projects = await gateway.listProjects(limit);

  return renderOutput([
    `count: ${formatCountLine(projects.length)} projects shown`,
    projects.length > 0
      ? renderList("projects", projects, projectSchema)
      : "projects: 0 projects found",
    renderHelp(
      projects.length === 0
        ? ["No projects were returned for this workspace"]
        : ["Use project names when filtering issues in Linear"],
    ),
  ]);
}
