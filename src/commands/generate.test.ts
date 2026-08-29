import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";
import { registerGenerateCommand } from "./generate.js";

const OPENAPI_SPEC = "openapi: 3.0.0\ninfo:\n  title: Widgets API\npaths: {}\n";
const ASYNCAPI_SPEC = JSON.stringify({ asyncapi: "2.6.0", info: { title: "Events API" }, channels: {} });

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride(); // throw instead of process.exit(), like the real CLI does at the top level
  registerGenerateCommand(program);
  return program;
}

async function runGenerate(program: Command, args: string[]): Promise<void> {
  await program.parseAsync(["node", "apiuikit", "generate", ...args]);
}

describe("generate command", () => {
  let dir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "apiuikit-generate-"));
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it("generates a site from an OpenAPI spec", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    writeFileSync(input, OPENAPI_SPEC);

    await runGenerate(makeProgram(), [input, "--output", output]);

    expect(process.exitCode).toBeUndefined();
    const html = readFileSync(path.join(output, "index.html"), "utf8");
    expect(html).toContain("<apiuikit-openapi-renderer");
    expect(html).toContain("<title>Widgets API</title>");
    expect(existsSync(path.join(output, "assets", "apiuikit.js"))).toBe(true);
    expect(existsSync(path.join(output, "assets", "apiuikit.css"))).toBe(true);
  });

  it("generates a site from an AsyncAPI spec", async () => {
    const input = path.join(dir, "spec.json");
    const output = path.join(dir, "site");
    writeFileSync(input, ASYNCAPI_SPEC);

    await runGenerate(makeProgram(), [input, "--output", output]);

    const html = readFileSync(path.join(output, "index.html"), "utf8");
    expect(html).toContain("<apiuikit-asyncapi-renderer");
    expect(html).toContain("<title>Events API</title>");
  });

  it("defaults the output directory to apiuikit-docs under the current working directory", async () => {
    const input = path.join(dir, "spec.yaml");
    writeFileSync(input, OPENAPI_SPEC);
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);

    await runGenerate(makeProgram(), [input]);

    expect(existsSync(path.join(dir, "apiuikit-docs", "index.html"))).toBe(true);
    cwdSpy.mockRestore();
  });

  it("passes a config file through to the generated page", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    const configFile = path.join(dir, "config.json");
    writeFileSync(input, OPENAPI_SPEC);
    writeFileSync(configFile, JSON.stringify({ theme: "dark" }));

    await runGenerate(makeProgram(), [input, "--output", output, "--config", configFile]);

    const html = readFileSync(path.join(output, "index.html"), "utf8");
    expect(html).toContain('.config = {"theme":"dark"};');
  });

  it("sets a non-zero exit code and prints an error for a missing input file", async () => {
    const input = path.join(dir, "missing.yaml");
    const output = path.join(dir, "site");

    await runGenerate(makeProgram(), [input, "--output", output]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
    expect(existsSync(output)).toBe(false);
  });

  it("sets a non-zero exit code for a spec missing both openapi and asyncapi fields", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    writeFileSync(input, "info:\n  title: Nothing Useful\n");

    await runGenerate(makeProgram(), [input, "--output", output]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls[0][0]).toContain("Could not detect a valid OpenAPI or AsyncAPI document");
  });

  it("refuses to overwrite a non-empty output directory without --force", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    writeFileSync(input, OPENAPI_SPEC);
    mkdirSync(output);
    writeFileSync(path.join(output, "existing.txt"), "keep me");

    await runGenerate(makeProgram(), [input, "--output", output]);

    expect(process.exitCode).toBe(1);
    expect(existsSync(path.join(output, "existing.txt"))).toBe(true);
    expect(existsSync(path.join(output, "index.html"))).toBe(false);
  });

  it("sets a non-zero exit code when the output path exists and is a file, not a directory", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    writeFileSync(input, OPENAPI_SPEC);
    writeFileSync(output, "I'm a file, not a directory");

    await runGenerate(makeProgram(), [input, "--output", output]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls[0][0]).toContain("exists and is not a directory");
  });

  it("overwrites a non-empty output directory when --force is given", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    writeFileSync(input, OPENAPI_SPEC);
    mkdirSync(output);
    writeFileSync(path.join(output, "existing.txt"), "keep me");

    await runGenerate(makeProgram(), [input, "--output", output, "--force"]);

    expect(process.exitCode).toBeUndefined();
    expect(existsSync(path.join(output, "index.html"))).toBe(true);
  });
});
