# linear-axi

Agent-friendly Linear from your shell — built on [AXI](https://axi.md/) principles and [`axi-sdk-js`](https://github.com/kunchenguid/axi/tree/main/packages/axi-sdk-js).

`linear-axi` wraps the Linear API with token-efficient TOON output, contextual next-step suggestions, structured errors, and `--dry-run` on every mutation.

## Install

```sh
npm install -g linear-axi
```

Or run without installing:

```sh
npx -y linear-axi
```

## Setup

Set a Linear API key (recommended for agents and cloud environments):

```dotenv
LINEAR_API_KEY=lin_api_...
```

Get your key at [linear.app/settings/api](https://linear.app/settings/api).

Alternatively, use OAuth:

```sh
linear-axi auth login --write-env --prompt-consent
```

## Quick start

```sh
linear-axi                              # home: assigned issues dashboard
linear-axi auth status
linear-axi teams list
linear-axi issues list --assignee me
linear-axi issues search --query "login bug"
linear-axi issues view --id ENG-123
linear-axi issues create --team ENG --title "Fix auth" --dry-run
linear-axi resolve --team ENG
linear-axi setup hooks                  # ambient context for agents
```

## Agent integration

**Session hooks (primary):**

```sh
linear-axi setup hooks
```

Installs SessionStart hooks for Claude Code, Codex, and OpenCode via `axi-sdk-js`.

**Agent skill (secondary):**

```sh
npx skills add affable-tamas/linear-axi --skill linear-axi
```

## Exit codes

- `0` — success (including idempotent no-ops)
- `1` — runtime, auth, or Linear API failure
- `2` — usage error (unknown flag/command, missing required flag)

## Develop

```sh
npm install
npm run dev auth status
npm test
npm run build
npm run build:skill
npm run check
```

Built with Node.js >= 20, TypeScript, `@linear/sdk`, and `axi-sdk-js`.
