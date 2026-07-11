import { describe, expect, it } from "vitest";
import { main, TOP_LEVEL_HELP } from "../src/cli.js";

function captureCli(argv: string[]): { output: string; exitCode: number } {
  const chunks: string[] = [];
  let exitCode = 0;
  const originalExit = process.exitCode;
  process.exitCode = 0;

  return main({
    argv,
    stdout: {
      write(chunk: string) {
        chunks.push(chunk);
      },
    },
  }).then(() => {
    exitCode = process.exitCode ?? 0;
    process.exitCode = originalExit;
    return { output: chunks.join(""), exitCode };
  });
}

describe("cli", () => {
  it("prints top-level help", async () => {
    const { output } = await captureCli(["--help"]);
    expect(output.startsWith(TOP_LEVEL_HELP)).toBe(true);
    expect(output).toContain("update:");
  });

  it("prints version", async () => {
    const { output } = await captureCli(["--version"]);
    expect(output.trim()).toBe("0.1.0");
  });

  it("rejects unknown commands", async () => {
    const { output, exitCode } = await captureCli(["nope"]);
    expect(exitCode).toBe(2);
    expect(output).toContain("Unknown command");
  });

  it("shows home without credentials", async () => {
    const env = { ...process.env };
    delete process.env.LINEAR_API_KEY;
    delete process.env.LINEAR_ACCESS_TOKEN;

    const { output } = await captureCli([]);
    expect(output).toContain("description:");
    expect(output).toContain("authenticated: false");

    process.env.LINEAR_API_KEY = env.LINEAR_API_KEY;
    process.env.LINEAR_ACCESS_TOKEN = env.LINEAR_ACCESS_TOKEN;
  });

  it("lists capabilities", async () => {
    const { output } = await captureCli(["capabilities"]);
    expect(output).toContain("capabilities");
    expect(output).toContain("issues list");
  });

  it("returns usage error for missing auth subcommand", async () => {
    const { output, exitCode } = await captureCli(["auth"]);
    expect(exitCode).toBe(2);
    expect(output).toContain("Missing auth subcommand");
  });
});
