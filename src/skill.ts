export const SKILL_NAME = "linear-axi";

export const SKILL_DESCRIPTION =
  "Linear AXI CLI workflow. Use when agents need to inspect or mutate Linear teams, issues, or comments through token-efficient TOON output.";

export const SKILL_BODY = `# Linear AXI

Use \`linear-axi\` as the Linear interface for agents. It prints TOON on stdout and uses AXI exits: \`0\` success, \`1\` runtime/auth/API failure, \`2\` usage error.

Invoke it as \`npx -y linear-axi <command>\` when the binary is not on PATH.

## Commands

\`\`\`sh
npx -y linear-axi
npx -y linear-axi auth status
npx -y linear-axi auth login --write-env --prompt-consent
npx -y linear-axi teams list --limit 50
npx -y linear-axi issues list --assignee me --limit 20
npx -y linear-axi issues search --query "login bug"
npx -y linear-axi issues view --id <issue-id-or-key>
npx -y linear-axi issues create --team <key> --title "..." --dry-run
npx -y linear-axi comments create --issue <issue-id-or-key> --body "..."
npx -y linear-axi resolve --team <key>
npx -y linear-axi setup hooks
\`\`\`

## Rules

1. Check auth before live work when credentials are uncertain.
   Completion criterion: \`auth status\` returns \`authenticated: true\`, or the user is told to set \`LINEAR_API_KEY\` or \`LINEAR_ACCESS_TOKEN\`.

2. Preview mutations with \`--dry-run\` before applying them.
   Completion criterion: run the dry-run command first unless the user explicitly asked for the exact live mutation.

3. Read TOON stdout directly.
   Completion criterion: do not rerun only to confirm an empty state or error; structured output is authoritative unless the command exits non-zero.

4. Let usage errors self-correct.
   Completion criterion: after exit \`2\`, use the \`help\` field from stdout to repair the command in one step.

5. Keep credentials out of output and prompts.
   Completion criterion: never ask the user to paste tokens; only ask them to configure environment variables outside the transcript.

6. For OAuth login, paste callback URLs into the still-running CLI when loopback fails.
   Completion criterion: keep \`auth login\` alive and paste the full \`http://127.0.0.1:...\` callback URL into stdin; do not paste tokens in the final answer.
`;

export function createSkillMarkdown(): string {
  return `---
name: ${SKILL_NAME}
description: >
  ${SKILL_DESCRIPTION}
---

${SKILL_BODY}`;
}
