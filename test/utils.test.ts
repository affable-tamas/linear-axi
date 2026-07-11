import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isListedInGitignore,
  isNotFoundError,
  parseFieldsFlag,
} from "../src/utils.js";
import { field } from "../src/toon.js";

describe("utils", () => {
  it("detects not-found errors", () => {
    expect(isNotFoundError(new Error("Entity not found"))).toBe(true);
    expect(isNotFoundError(new Error("Rate limit exceeded"))).toBe(false);
  });

  it("parses --fields selections", () => {
    const schema = parseFieldsFlag(
      "identifier,url",
      new Set(["identifier", "title", "url"]),
      [field("title")],
    );
    expect(schema).toHaveLength(2);
    expect(schema[0]).toEqual(field("identifier"));
    expect(schema[1]).toEqual(field("url"));
  });

  it("falls back to .gitignore when git is unavailable", () => {
    const dir = mkdtempSync(join(tmpdir(), "linear-axi-"));
    writeFileSync(join(dir, ".gitignore"), ".env\n");
    expect(isListedInGitignore(".env", dir)).toBe(true);
    expect(isListedInGitignore("secrets.txt", dir)).toBe(false);
  });
});
