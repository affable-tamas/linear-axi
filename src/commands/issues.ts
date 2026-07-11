import { AxiError } from "axi-sdk-js";
import { encode } from "@toon-format/toon";
import {
  rejectUnknownFlags,
  requireFlag,
  takeBoolFlag,
  takeFlag,
  takeLimit,
} from "../args.js";
import { makeGateway } from "../linear.js";
import { parseFieldsFlag } from "../utils.js";
import {
  field,
  formatCountLine,
  renderDetail,
  renderHelp,
  renderList,
  renderOutput,
  truncateText,
  type FieldDef,
} from "../toon.js";

export const ISSUES_HELP = `usage: linear-axi issues <subcommand> [flags]
subcommands[7]:
  list, search, view, create, update, assign, state
flags{list}:
  --assignee me, --team, --state, --limit (default 20), --fields
flags{search}:
  --query (required), --team, --limit (default 20)
flags{view}:
  --id (required), --full
flags{create}:
  --team (required), --title (required), --description, --dry-run
flags{update}:
  --id (required), --title, --description, --dry-run
flags{assign}:
  --id (required), --user (required), --dry-run
flags{state}:
  --id (required), --state (required), --dry-run
examples:
  linear-axi issues list --assignee me
  linear-axi issues search --query "login bug" --team ENG
  linear-axi issues view --id ENG-123 --full
  linear-axi issues create --team ENG --title "Fix auth" --dry-run
`;

const listSchema: FieldDef[] = [
  field("identifier"),
  field("title"),
  field("state"),
  field("assignee"),
];

const LIST_FIELD_NAMES = new Set([
  "id",
  "identifier",
  "title",
  "state",
  "assignee",
  "updatedAt",
  "url",
]);

const commentSchema = [
  field("author"),
  field("body"),
  field("createdAt"),
];

export async function issuesCommand(args: string[]): Promise<string> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help") {
    throw new AxiError("Missing issues subcommand", "VALIDATION_ERROR", [
      ISSUES_HELP,
    ]);
  }

  switch (sub) {
    case "list":
      return issuesList(rest);
    case "search":
      return issuesSearch(rest);
    case "view":
      return issuesView(rest);
    case "create":
      return issuesCreate(rest);
    case "update":
      return issuesUpdate(rest);
    case "assign":
      return issuesAssign(rest);
    case "state":
      return issuesState(rest);
    default:
      throw new AxiError(`Unknown issues subcommand: ${sub}`, "VALIDATION_ERROR", [
        ISSUES_HELP,
      ]);
  }
}

async function issuesList(args: string[]): Promise<string> {
  rejectUnknownFlags(
    args,
    new Set(["--help", "--assignee", "--team", "--state", "--limit", "--fields"]),
    "issues list",
  );
  const assignee = takeFlag(args, "--assignee");
  if (assignee !== undefined && assignee !== "me") {
    throw new AxiError("--assignee only supports `me`", "VALIDATION_ERROR", [
      "Usage: linear-axi issues list --assignee me",
    ]);
  }
  const limit = takeLimit(args, 20);
  let schema: FieldDef[];
  try {
    schema = parseFieldsFlag(
      takeFlag(args, "--fields"),
      LIST_FIELD_NAMES,
      listSchema,
    );
  } catch (error) {
    throw new AxiError(
      error instanceof Error ? error.message : "Invalid --fields value",
      "VALIDATION_ERROR",
      ["Usage: linear-axi issues list --fields identifier,title,state,url"],
    );
  }
  const gateway = makeGateway();
  const { issues } = await gateway.listIssues({
    limit,
    assignee,
    team: takeFlag(args, "--team"),
    state: takeFlag(args, "--state"),
  });

  return renderOutput([
    `count: ${formatCountLine(issues.length)} issues shown`,
    issues.length > 0
      ? renderList("issues", issues, schema)
      : "issues: 0 issues matched this query",
    renderHelp(
      issues.length === 0
        ? ["No issues matched this query"]
        : ["Run `linear-axi issues view --id <identifier>` for details"],
    ),
  ]);
}

async function issuesSearch(args: string[]): Promise<string> {
  rejectUnknownFlags(
    args,
    new Set(["--help", "--query", "--team", "--limit"]),
    "issues search",
  );
  const query = requireFlag(
    args,
    "--query",
    "Usage: linear-axi issues search --query \"login bug\"",
  );
  const limit = takeLimit(args, 20);
  const gateway = makeGateway();
  const issues = await gateway.searchIssues({
    query,
    team: takeFlag(args, "--team"),
    limit,
  });

  return renderOutput([
    `count: ${formatCountLine(issues.length)} issues shown`,
    issues.length > 0
      ? renderList("issues", issues, listSchema)
      : `issues: 0 issues matched "${query}"`,
    renderHelp(
      issues.length === 0
        ? ["Try a broader query or remove --team"]
        : ["Run `linear-axi issues view --id <identifier>` for details"],
    ),
  ]);
}

async function issuesView(args: string[]): Promise<string> {
  rejectUnknownFlags(args, new Set(["--help", "--id", "--full"]), "issues view");
  const id = requireFlag(
    args,
    "--id",
    "Usage: linear-axi issues view --id ENG-123",
  );
  const full = takeBoolFlag(args, "--full");
  const gateway = makeGateway();
  const { issue, comments, commentTotal } = await gateway.viewIssue(id);
  const description = truncateText(issue.description, 1200, full);

  const blocks = [
    renderDetail(
      "issue",
      { ...issue, description: description.text },
      [
        field("identifier"),
        field("title"),
        field("state"),
        field("assignee"),
        field("team"),
        field("description"),
      ],
    ),
    `comments: ${formatCountLine(comments.length, commentTotal)}`,
  ];

  if (comments.length > 0) {
    blocks.push(renderList("comments", comments, commentSchema));
  }

  const help: string[] = [];
  if (description.truncated) {
    help.push(`Run \`linear-axi issues view --id ${issue.identifier} --full\``);
  }
  if (help.length > 0) {
    blocks.push(renderHelp(help));
  }

  return renderOutput(blocks);
}

async function issuesCreate(args: string[]): Promise<string> {
  rejectUnknownFlags(
    args,
    new Set([
      "--help",
      "--team",
      "--title",
      "--description",
      "--dry-run",
    ]),
    "issues create",
  );
  const dryRun = takeBoolFlag(args, "--dry-run");
  const team = requireFlag(
    args,
    "--team",
    "Usage: linear-axi issues create --team ENG --title \"...\"",
  );
  const title = requireFlag(args, "--title", "Usage: linear-axi issues create --team ENG --title \"...\"");
  const description = takeFlag(args, "--description");

  if (dryRun) {
    return renderOutput([
      encode({
        dry_run: true,
        operation: "issues.create",
        input: { team, title, description },
      }),
      renderHelp(["Re-run without --dry-run to apply"]),
    ]);
  }

  const gateway = makeGateway();
  const issue = await gateway.createIssue({ team, title, description });
  return renderOutput([
    renderDetail("issue", issue, listSchema),
    renderHelp([`Run \`linear-axi issues view --id ${issue.identifier}\` for details`]),
  ]);
}

async function issuesUpdate(args: string[]): Promise<string> {
  rejectUnknownFlags(
    args,
    new Set(["--help", "--id", "--title", "--description", "--dry-run"]),
    "issues update",
  );
  const dryRun = takeBoolFlag(args, "--dry-run");
  const id = requireFlag(args, "--id", "Usage: linear-axi issues update --id ENG-123 --title \"...\"");
  const title = takeFlag(args, "--title");
  const description = takeFlag(args, "--description");

  if (!title && !description) {
    throw new AxiError(
      "At least one of --title or --description is required",
      "VALIDATION_ERROR",
      ["Usage: linear-axi issues update --id ENG-123 --title \"...\""],
    );
  }

  if (dryRun) {
    return renderOutput([
      encode({
        dry_run: true,
        operation: "issues.update",
        input: { id, title, description },
      }),
      renderHelp(["Re-run without --dry-run to apply"]),
    ]);
  }

  const gateway = makeGateway();
  const issue = await gateway.updateIssue({ id, title, description });
  return renderOutput([
    renderDetail("issue", issue, listSchema),
    renderHelp([`Run \`linear-axi issues view --id ${issue.identifier}\``]),
  ]);
}

async function issuesAssign(args: string[]): Promise<string> {
  rejectUnknownFlags(
    args,
    new Set(["--help", "--id", "--user", "--dry-run"]),
    "issues assign",
  );
  const dryRun = takeBoolFlag(args, "--dry-run");
  const id = requireFlag(args, "--id", "Usage: linear-axi issues assign --id ENG-123 --user jane@co.com");
  const user = requireFlag(args, "--user", "Usage: linear-axi issues assign --id ENG-123 --user jane@co.com");

  if (dryRun) {
    return renderOutput([
      encode({ dry_run: true, operation: "issues.assign", input: { id, user } }),
      renderHelp(["Re-run without --dry-run to apply"]),
    ]);
  }

  const gateway = makeGateway();
  const { issue, noop } = await gateway.assignIssue({ id, user });
  return renderOutput([
    noop
      ? encode({ issue: issue.identifier, assignee: issue.assignee, noop: true })
      : renderDetail("issue", issue, listSchema),
    ...(noop
      ? []
      : [renderHelp([`Run \`linear-axi issues view --id ${issue.identifier}\``])]),
  ]);
}

async function issuesState(args: string[]): Promise<string> {
  rejectUnknownFlags(
    args,
    new Set(["--help", "--id", "--state", "--dry-run"]),
    "issues state",
  );
  const dryRun = takeBoolFlag(args, "--dry-run");
  const id = requireFlag(args, "--id", "Usage: linear-axi issues state --id ENG-123 --state Done");
  const state = requireFlag(args, "--state", "Usage: linear-axi issues state --id ENG-123 --state Done");

  if (dryRun) {
    return renderOutput([
      encode({ dry_run: true, operation: "issues.state", input: { id, state } }),
      renderHelp(["Re-run without --dry-run to apply"]),
    ]);
  }

  const gateway = makeGateway();
  const result = await gateway.setIssueState({ id, state });
  return renderOutput([
    result.noop
      ? encode({ issue: result.issue.identifier, state: result.issue.state, noop: true })
      : renderDetail("issue", result.issue, listSchema),
    ...(result.noop
      ? []
      : [renderHelp([`Run \`linear-axi issues view --id ${result.issue.identifier}\``])]),
  ]);
}
