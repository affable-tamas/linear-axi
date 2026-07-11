import { describe, expect, it, vi } from "vitest";
import { LinearGateway } from "../src/linear.js";

describe("LinearGateway", () => {
  it("resolveIssue rethrows non-not-found API errors", async () => {
    const gateway = new LinearGateway({
      LINEAR_ACCESS_TOKEN: "test-token",
    });
    vi.spyOn(gateway as never, "getClient").mockResolvedValue({
      issue: vi.fn().mockRejectedValue(new Error("Rate limit exceeded")),
    });

    await expect(gateway.resolveIssue("ENG-1")).rejects.toThrow(
      "Rate limit exceeded",
    );
  });

  it("resolveIssue returns empty result for not-found issues", async () => {
    const gateway = new LinearGateway({
      LINEAR_ACCESS_TOKEN: "test-token",
    });
    vi.spyOn(gateway as never, "getClient").mockResolvedValue({
      issue: vi.fn().mockRejectedValue(new Error("Entity not found")),
    });

    await expect(gateway.resolveIssue("ENG-404")).resolves.toEqual({
      candidates: [],
      ambiguous: false,
    });
  });

  it("listIssues requires team when state filter is set", async () => {
    const gateway = new LinearGateway({
      LINEAR_ACCESS_TOKEN: "test-token",
    });

    await expect(
      gateway.listIssues({ limit: 10, state: "Done" }),
    ).rejects.toThrow("--team is required");
  });
});
