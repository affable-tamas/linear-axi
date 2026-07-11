import { describe, expect, it } from "vitest";
import { formatCountLine } from "../src/toon.js";

describe("issues view comment count", () => {
  it("does not duplicate the word shown", () => {
    const line = `comments: ${formatCountLine(0, 0)}`;
    expect(line).toBe("comments: 0 shown");
    expect(line).not.toContain("shown shown");
  });

  it("formats partial comment pages without a misleading total", () => {
    const line = `comments: ${formatCountLine(5, undefined)}`;
    expect(line).toBe("comments: 5 shown");
  });

  it("formats known totals", () => {
    const line = `comments: ${formatCountLine(5, 12)}`;
    expect(line).toBe("comments: 5 of 12 total");
  });
});
