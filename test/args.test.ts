import { describe, expect, it } from "vitest";
import { AxiError } from "axi-sdk-js";
import {
  getFlag,
  MAX_LIMIT,
  rejectUnknownFlags,
  takeBoolFlag,
  takeFlag,
  takeLimit,
} from "../src/args.js";

describe("args", () => {
  it("parses --flag value and --flag=value", () => {
    expect(getFlag(["--team", "ENG"], "--team")).toBe("ENG");
    expect(getFlag(["--team=ENG"], "--team")).toBe("ENG");
  });

  it("takes flags out of args", () => {
    const args = ["--team", "ENG", "list"];
    expect(takeFlag(args, "--team")).toBe("ENG");
    expect(args).toEqual(["list"]);
  });

  it("parses boolean flags", () => {
    const args = ["--dry-run", "list"];
    expect(takeBoolFlag(args, "--dry-run")).toBe(true);
    expect(args).toEqual(["list"]);
  });

  it("parses limit with fallback", () => {
    expect(takeLimit([], 20)).toBe(20);
    expect(takeLimit(["--limit", "5"], 20)).toBe(5);
  });

  it("rejects invalid limit", () => {
    expect(() => takeLimit(["--limit", "0"], 20)).toThrow(AxiError);
    expect(() => takeLimit(["--limit", String(MAX_LIMIT + 1)], 20)).toThrow(
      AxiError,
    );
  });

  it("rejects unknown flags", () => {
    expect(() =>
      rejectUnknownFlags(["--nope"], new Set(["--help", "--team"]), "issues list"),
    ).toThrow(AxiError);
  });
});
