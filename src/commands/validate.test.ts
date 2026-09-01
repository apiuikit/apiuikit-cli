import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";

const validateOpenApiDocument = vi.fn();
const validateAsyncApiDocument = vi.fn();

vi.mock("../validate/parsers.js", () => ({
  validateOpenApiDocument: (...args: unknown[]) => validateOpenApiDocument(...args),
  validateAsyncApiDocument: (...args: unknown[]) => validateAsyncApiDocument(...args),
}));

import { REMOTE_ASYNCAPI_YAML, REMOTE_OPENAPI_YAML } from "../test/remoteSpecs.js";

const { registerValidateCommand } = await import("./validate.js");

const OPENAPI_SPEC = "openapi: 3.0.0\ninfo:\n  title: Widgets API\n  version: 1.0.0\npaths: {}\n";
const ASYNCAPI_SPEC = JSON.stringify({ asyncapi: "2.6.0", info: { title: "Events API", version: "1.0.0" }, channels: {} });

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerValidateCommand(program);
  return program;
}

async function runValidate(program: Command, args: string[]): Promise<void> {
  await program.parseAsync(["node", "apiuikit", "validate", ...args]);
}

describe("validate command", () => {
  let dir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "apiuikit-validatecmd-"));
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;
    validateOpenApiDocument.mockReset();
    validateAsyncApiDocument.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it("reports success and exit code 0 for a valid OpenAPI spec", async () => {
    const input = path.join(dir, "spec.yaml");
    writeFileSync(input, OPENAPI_SPEC);
    validateOpenApiDocument.mockResolvedValue({ valid: true, issues: [] });

    await runValidate(makeProgram(), [input]);

    expect(validateOpenApiDocument).toHaveBeenCalledTimes(1);
    expect(validateAsyncApiDocument).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    expect(logSpy.mock.calls.flat().join("\n")).toMatch(/OpenAPI spec is valid/);
  });

  it("reports failure and exit code 1 for an invalid OpenAPI spec", async () => {
    const input = path.join(dir, "spec.yaml");
    writeFileSync(input, OPENAPI_SPEC);
    validateOpenApiDocument.mockResolvedValue({
      valid: false,
      issues: [{ severity: "error", message: "must have required property 'paths'", path: "paths" }],
    });

    await runValidate(makeProgram(), [input]);

    expect(process.exitCode).toBe(1);
    expect(logSpy.mock.calls.flat().join("\n")).toMatch(/must have required property/);
  });

  it("validates AsyncAPI specs through validateAsyncApiDocument", async () => {
    const input = path.join(dir, "spec.json");
    writeFileSync(input, ASYNCAPI_SPEC);
    validateAsyncApiDocument.mockResolvedValue({ valid: true, issues: [] });

    await runValidate(makeProgram(), [input]);

    expect(validateAsyncApiDocument).toHaveBeenCalledTimes(1);
    expect(validateOpenApiDocument).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it("passes --yes through as assumeYes", async () => {
    const input = path.join(dir, "spec.yaml");
    writeFileSync(input, OPENAPI_SPEC);
    validateOpenApiDocument.mockResolvedValue({ valid: true, issues: [] });

    await runValidate(makeProgram(), [input, "--yes"]);

    expect(validateOpenApiDocument).toHaveBeenCalledWith(expect.anything(), { assumeYes: true });
  });

  it("prints an error and exits 1 when the file has an unsupported extension", async () => {
    const input = path.join(dir, "spec.txt");
    writeFileSync(input, "not a spec");

    await runValidate(makeProgram(), [input]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls.flat().join("\n")).toMatch(/Unsupported file type/);
    expect(validateOpenApiDocument).not.toHaveBeenCalled();
  });

  it("prints an error and exits 1 when the optional parser package is unavailable", async () => {
    const input = path.join(dir, "spec.yaml");
    writeFileSync(input, OPENAPI_SPEC);
    validateOpenApiDocument.mockRejectedValue(new Error("@scalar/openapi-parser is required to validate OpenAPI documents, but it isn't installed."));

    await runValidate(makeProgram(), [input]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls.flat().join("\n")).toMatch(/isn't installed/);
  });

  it("validates a remote OpenAPI spec URL", async () => {
    validateOpenApiDocument.mockResolvedValue({ valid: true, issues: [] });

    await runValidate(makeProgram(), [REMOTE_OPENAPI_YAML]);

    expect(validateOpenApiDocument).toHaveBeenCalledTimes(1);
    expect(validateAsyncApiDocument).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
    expect(logSpy.mock.calls.flat().join("\n")).toMatch(/OpenAPI spec is valid/);
  });

  it("validates a remote AsyncAPI spec URL", async () => {
    validateAsyncApiDocument.mockResolvedValue({ valid: true, issues: [] });

    await runValidate(makeProgram(), [REMOTE_ASYNCAPI_YAML]);

    expect(validateAsyncApiDocument).toHaveBeenCalledTimes(1);
    expect(validateOpenApiDocument).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it("prints an error and exits 1 when the remote spec URL fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    vi.stubGlobal("fetch", fetchMock);

    await runValidate(makeProgram(), ["https://example.com/openapi.yaml"]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls.flat().join("\n")).toMatch(/Could not reach/);

    vi.unstubAllGlobals();
  });
});
