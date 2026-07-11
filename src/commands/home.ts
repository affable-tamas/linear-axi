import { encode } from "@toon-format/toon";
import { makeGateway } from "../linear.js";
import {
  field,
  formatCountLine,
  renderHelp,
  renderList,
  renderOutput,
} from "../toon.js";

const issueSchema = [
  field("identifier"),
  field("title"),
  field("state"),
];

export async function homeCommand(): Promise<string> {
  const gateway = makeGateway();
  const auth = await gateway.authStatus();
  const blocks: string[] = [encode({ auth })];

  if (!auth.authenticated) {
    blocks.push(
      renderHelp([
        "Set LINEAR_API_KEY or LINEAR_ACCESS_TOKEN",
        "Run `linear-axi auth login --write-env` to connect via OAuth",
        "Run `linear-axi teams list` after auth is configured",
      ]),
    );
    return renderOutput(blocks);
  }

  const { issues } = await gateway.listIssues({ limit: 10, assignee: "me" });
  blocks.push(`count: ${formatCountLine(issues.length)} assigned issues shown`);
  blocks.push(
    issues.length > 0
      ? renderList("issues", issues, issueSchema)
      : "issues: 0 assigned issues shown",
  );
  blocks.push(
    renderHelp([
      "Run `linear-axi issues view --id <identifier>` for details",
      "Run `linear-axi issues search --query \"<term>\"` to search",
    ]),
  );
  return renderOutput(blocks);
}
