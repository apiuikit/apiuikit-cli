import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { run } from "./cli.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as {
  version: string;
};

describe("run", () => {
  let dir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "apiuikit-cli-"));
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    // commander writes its own usage/error output straight to stderr, bypassing console.error
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it("prints help and does not exit when called with no arguments", async () => {
    await run(["node", "apiuikit"]);

    expect(exitSpy).not.toHaveBeenCalled();
    const output = [...logSpy.mock.calls.flat(), ...stdoutSpy.mock.calls.flat()].join("\n");
    expect(output).toContain("apiuikit");
  });

  it("prints the package version and exits 0 for --version", async () => {
    await run(["node", "apiuikit", "--version"]);

    expect(exitSpy).toHaveBeenCalledWith(0);
    const output = stdoutSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("");
    expect(output).toContain(pkg.version);
  });

  it("exits non-zero for an unknown command", async () => {
    await run(["node", "apiuikit", "not-a-real-command"]);

    expect(exitSpy).toHaveBeenCalled();
    expect(exitSpy.mock.calls[0][0]).not.toBe(0);
  });

  it("delegates to the generate command and sets exitCode without calling process.exit on a handled error", async () => {
    await run(["node", "apiuikit", "generate", path.join(dir, "missing.yaml")]);

    expect(process.exitCode).toBe(1);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("delegates to the generate command end-to-end for a valid spec", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    writeFileSync(input, "openapi: 3.0.0\ninfo:\n  title: CLI Test\n");

    await run(["node", "apiuikit", "generate", input, "--output", output]);

    expect(process.exitCode).toBeUndefined();
    expect(existsSync(path.join(output, "index.html"))).toBe(true);
  });
});
