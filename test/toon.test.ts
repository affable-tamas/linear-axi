import { describe, expect, it } from "vitest";
import {
  extract,
  field,
  formatCountLine,
  renderHelp,
  renderList,
  truncateText,
} from "../src/toon.js";

describe("toon", () => {
  it("extracts field schemas", () => {
    const result = extract(
      { identifier: "ENG-1", title: "Fix bug", state: "Open" },
      [field("identifier"), field("title"), field("state")],
    );
    expect(result).toEqual({
      identifier: "ENG-1",
      title: "Fix bug",
      state: "Open",
    });
  });

  it("renders help blocks", () => {
    expect(renderHelp(["Run `linear-axi teams list`"])).toBe(
      "help[1]:\n  Run `linear-axi teams list`",
    );
  });

  it("renders list TOON", () => {
    const output = renderList(
      "issues",
      [{ identifier: "ENG-1", title: "Fix", state: "Open" }],
      [field("identifier"), field("title"), field("state")],
    );
    expect(output).toContain("issues[1]");
    expect(output).toContain("ENG-1");
  });

  it("truncates long text with hint", () => {
    const text = "a".repeat(2000);
    const result = truncateText(text, 1200, false);
    expect(result.truncated).toBe(true);
    expect(result.text).toContain("--full");
  });

  it("formats count lines", () => {
    expect(formatCountLine(3, 10)).toBe("3 of 10 total");
    expect(formatCountLine(5)).toBe("5 shown");
  });
});
