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

export function isListedInGitignore(relative: string, cwd: string): boolean {
  const gitignorePath = resolve(cwd, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return false;
  }

  const target = relative.split("/").pop() ?? relative;
  const lines = readFileSync(gitignorePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return lines.some((pattern) => {
    if (pattern === relative || pattern === target) {
      return true;
    }
    if (pattern.endsWith("/") && relative.startsWith(pattern)) {
      return true;
    }
    return pattern === ".env" && target === ".env";
  });
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
