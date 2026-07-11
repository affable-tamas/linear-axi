import { AxiError } from "axi-sdk-js";

export const MAX_LIMIT = 250;

function flagEqualsPrefix(flag: string): string {
  return `${flag}=`;
}

export function getFlag(args: string[], name: string): string | undefined {
  const equalsPrefix = flagEqualsPrefix(name);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === name) {
      if (i + 1 >= args.length) return undefined;
      return args[i + 1];
    }
    if (arg.startsWith(equalsPrefix)) {
      return arg.slice(equalsPrefix.length);
    }
  }
  return undefined;
}

export function takeFlag(args: string[], flag: string): string | undefined {
  const equalsPrefix = flagEqualsPrefix(flag);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === flag) {
      const val = args[i + 1];
      args.splice(i, 2);
      return val;
    }
    if (arg.startsWith(equalsPrefix)) {
      const val = arg.slice(equalsPrefix.length);
      args.splice(i, 1);
      return val;
    }
  }
  return undefined;
}

export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function takeBoolFlag(args: string[], flag: string): boolean {
  const idx = args.indexOf(flag);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}

export function takeLimit(args: string[], fallback: number): number {
  const raw = takeFlag(args, "--limit");
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new AxiError(
      "--limit must be a positive integer",
      "VALIDATION_ERROR",
      ["Usage: --limit 20"],
    );
  }
  if (n > MAX_LIMIT) {
    throw new AxiError(
      `--limit must be at most ${MAX_LIMIT}`,
      "VALIDATION_ERROR",
      [`Usage: --limit ${MAX_LIMIT}`],
    );
  }
  return n;
}

export function requireFlag(
  args: string[],
  flag: string,
  usage: string,
): string {
  const value = takeFlag(args, flag);
  if (!value) {
    throw new AxiError(`Missing required flag ${flag}`, "VALIDATION_ERROR", [
      usage,
    ]);
  }
  return value;
}

export function rejectUnknownFlags(
  args: string[],
  allowed: ReadonlySet<string>,
  commandLabel: string,
): void {
  const unknown: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help") continue;
    if (!arg.startsWith("--")) continue;
    if (arg.includes("=")) {
      const name = arg.split("=")[0]!;
      if (!allowed.has(name)) unknown.push(name);
      continue;
    }
    if (!allowed.has(arg)) {
      unknown.push(arg);
      if (i + 1 < args.length && !args[i + 1]!.startsWith("--")) {
        i++;
      }
    }
  }
  if (unknown.length > 0) {
    const valid = [...allowed].sort().join(", ");
    throw new AxiError(
      `Unknown flag ${unknown[0]} for \`${commandLabel}\``,
      "VALIDATION_ERROR",
      [`Valid flags: ${valid}, --help`],
    );
  }
}

export function takeBody(args: string[]): string | undefined {
  return takeFlag(args, "--body") ?? takeFlag(args, "--description");
}
