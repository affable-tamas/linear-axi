import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Env = Record<string, string | undefined>;

export function parseDotEnv(content: string): Env {
  const env: Env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function loadEnv(cwd = process.cwd()): Env {
  const merged: Env = { ...process.env };
  const envFile = resolve(cwd, ".env");
  if (existsSync(envFile)) {
    Object.assign(merged, parseDotEnv(readFileSync(envFile, "utf8")));
  }
  return merged;
}
