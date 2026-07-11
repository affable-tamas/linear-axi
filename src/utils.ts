import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FieldDef } from "./toon.js";
import { field } from "./toon.js";

export function parseFieldsFlag(
  raw: string | undefined,
  allowed: ReadonlySet<string>,
  defaults: FieldDef[],
): FieldDef[] {
  if (!raw) {
    return defaults;
  }

  const names = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (names.length === 0) {
    return defaults;
  }

  const invalid = names.filter((name) => !allowed.has(name));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown --fields value(s): ${invalid.join(", ")}. Allowed: ${[...allowed].sort().join(", ")}`,
    );
  }

  return names.map((name) => field(name));
}

function globToRegExp(pattern: string): RegExp {
  const anchored = pattern.startsWith("/");
  const body = anchored ? pattern.slice(1) : pattern;
  const regexBody = body
    .split("/")
    .map((segment) =>
      segment
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "\0")
        .replace(/\*/g, "[^/]*")
        .replace(/\0/g, ".*"),
    )
    .join("/");
  const source = anchored ? `^${regexBody}$` : `(^|/)${regexBody}$`;
  return new RegExp(source);
}

function matchesGitignorePattern(relative: string, pattern: string): boolean {
  const target = relative.split("/").pop() ?? relative;

  if (pattern.startsWith("**/")) {
    const suffix = pattern.slice(3);
    return (
      relative === suffix ||
      relative.endsWith(`/${suffix}`) ||
      target === suffix
    );
  }

  if (!pattern.includes("*") && !pattern.startsWith("/")) {
    if (pattern.endsWith("/")) {
      return (
        relative.startsWith(pattern) || relative === pattern.slice(0, -1)
      );
    }
    return pattern === relative || pattern === target;
  }

  const regex = globToRegExp(pattern);
  return (
    regex.test(relative) ||
    (!pattern.startsWith("/") && regex.test(target))
  );
}

export function isListedInGitignore(relative: string, cwd: string): boolean {
  const gitignorePath = resolve(cwd, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return false;
  }

  const lines = readFileSync(gitignorePath, "utf8")
    .split("\n")
    .map((line) => line.trim());

  let ignored = false;
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("!")) {
      const pattern = line.slice(1).trim();
      if (matchesGitignorePattern(relative, pattern)) {
        ignored = false;
      }
      continue;
    }
    if (matchesGitignorePattern(relative, line)) {
      ignored = true;
    }
  }
  return ignored;
}

export function isPathGitignored(relative: string, cwd: string): boolean {
  const result = spawnSync("git", ["check-ignore", "-q", "--", relative], {
    cwd,
    stdio: "ignore",
  });
  if (result.status === 0) {
    return true;
  }
  if (result.status === 1 && !result.error) {
    return false;
  }
  return isListedInGitignore(relative, cwd);
}

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("could not find") ||
    message.includes("does not exist")
  );
}
