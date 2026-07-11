# AGENTS.md

## Cursor Cloud specific instructions

`linear-axi` is a TypeScript/Node.js (ESM, Node >= 20) CLI that wraps the Linear API with
token-efficient TOON output. There is no server or UI — it is a single terminal command.
Standard dev/build/test commands live in `README.md` ("Develop") and `package.json` scripts
(`dev`, `build`, `build:skill`, `test`, `typecheck`, `check`); use those.

Non-obvious notes:

- Credentials: the CLI needs `LINEAR_API_KEY` (or `LINEAR_ACCESS_TOKEN` / OAuth). In Cursor Cloud
  a `LINEAR_API_KEY` secret is injected as an env var, so `auth status` works out of the box with
  no `.env` file. `loadEnv()` also reads a local `.env` (gitignored) if present.
- Passing flags through npm: `npm run dev <args>` swallows `--flags` (npm consumes them). To pass
  flags either use the `--` separator (`npm run dev -- issues create --team AFF --title x`) or run
  the entry directly: `npx tsx bin/linear-axi.ts issues create --team AFF --title x`.
- Mutations hit the real Linear workspace tied to the API key. Every mutating command supports
  `--dry-run` — prefer it when verifying behavior so you don't create real issues/comments.
- Flag naming is per-subcommand and not always `--id`: e.g. `comments create` uses `--issue`,
  while `issues view/update/assign/state` use `--id`. Run `<command> --help` (or `capabilities`)
  to confirm flags.
- `npm run check` runs `build` + `test` + `build:skill -- --check`; the last step fails if
  `skills/linear-axi/SKILL.md` is stale — regenerate with `npm run build:skill` and commit it.
- `dist/` and `node_modules/` are gitignored; `skills/linear-axi/SKILL.md` is tracked and generated.
