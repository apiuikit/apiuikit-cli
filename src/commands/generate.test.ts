import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";
import { REMOTE_ASYNCAPI_YAML, REMOTE_OPENAPI_YAML } from "../test/remoteSpecs.js";
import { REMOTE_FOOTER_HTML, REMOTE_HEADER_HTML } from "../test/remoteSpecs.js";
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

  it("injects header and footer HTML files into the generated page", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    const headerFile = path.join(dir, "header.html");
    const footerFile = path.join(dir, "footer.html");
    writeFileSync(input, OPENAPI_SPEC);
    writeFileSync(headerFile, '<div class="my-header">Beta docs</div>');
    writeFileSync(footerFile, '<footer class="my-footer">&copy; 2026</footer>');

    await runGenerate(makeProgram(), [input, "--output", output, "--header", headerFile, "--footer", footerFile]);

    const html = readFileSync(path.join(output, "index.html"), "utf8");
    const headerIndex = html.indexOf('<div class="my-header">Beta docs</div>');
    const elementIndex = html.indexOf("<apiuikit-openapi-renderer");
    const footerIndex = html.indexOf('<footer class="my-footer">&copy; 2026</footer>');
    const bodyCloseIndex = html.indexOf("</body>");
    expect(headerIndex).toBeGreaterThan(-1);
    expect(headerIndex).toBeLessThan(elementIndex);
    expect(footerIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeLessThan(bodyCloseIndex);
  });

  it("sets a non-zero exit code and prints an error for a missing header file", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    writeFileSync(input, OPENAPI_SPEC);

    await runGenerate(makeProgram(), [input, "--output", output, "--header", path.join(dir, "missing.html")]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls[0][0]).toContain("No such header file");
    expect(existsSync(output)).toBe(false);
  });

  it("sets a non-zero exit code and prints an error for a missing footer file", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    writeFileSync(input, OPENAPI_SPEC);

    await runGenerate(makeProgram(), [input, "--output", output, "--footer", path.join(dir, "missing.html")]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls[0][0]).toContain("No such footer file");
    expect(existsSync(output)).toBe(false);
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

  it("generates a site from a remote OpenAPI spec URL", async () => {
    const output = path.join(dir, "site-openapi");

    await runGenerate(makeProgram(), [REMOTE_OPENAPI_YAML, "--output", output]);

    expect(process.exitCode).toBeUndefined();
    const html = readFileSync(path.join(output, "index.html"), "utf8");
    expect(html).toContain("<apiuikit-openapi-renderer");
    expect(html).toContain("<title>Swagger Petstore</title>");
  });

  it("generates a site from a remote AsyncAPI spec URL", async () => {
    const output = path.join(dir, "site-asyncapi");

    await runGenerate(makeProgram(), [REMOTE_ASYNCAPI_YAML, "--output", output]);

    expect(process.exitCode).toBeUndefined();
    const html = readFileSync(path.join(output, "index.html"), "utf8");
    expect(html).toContain("<apiuikit-asyncapi-renderer");
    expect(html).toContain("<title>Streetlights Kafka API</title>");
  });

  it("injects remote header and footer HTML URLs into the generated page", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site-remote-branding");
    writeFileSync(input, OPENAPI_SPEC);

    await runGenerate(makeProgram(), [
      input,
      "--output",
      output,
      "--header",
      REMOTE_HEADER_HTML,
      "--footer",
      REMOTE_FOOTER_HTML,
    ]);

    const html = readFileSync(path.join(output, "index.html"), "utf8");
    const headerIndex = html.indexOf("apiuikit-example-header");
    const elementIndex = html.indexOf("<apiuikit-openapi-renderer");
    const footerIndex = html.indexOf("apiuikit-example-footer");
    const bodyCloseIndex = html.indexOf("</body>");
    expect(headerIndex).toBeGreaterThan(-1);
    expect(headerIndex).toBeLessThan(elementIndex);
    expect(footerIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeLessThan(bodyCloseIndex);
  });

  it("fetches a config file over http(s) when --config is a URL", async () => {
    const input = path.join(dir, "spec.yaml");
    const output = path.join(dir, "site");
    writeFileSync(input, OPENAPI_SPEC);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ theme: "dark" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await runGenerate(makeProgram(), [
      input,
      "--output",
      output,
      "--config",
      "https://example.com/apiuikit.config.json",
    ]);

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/apiuikit.config.json");
    const html = readFileSync(path.join(output, "index.html"), "utf8");
    expect(html).toContain('.config = {"theme":"dark"};');

    vi.unstubAllGlobals();
  });

  it("sets a non-zero exit code and prints an error when the remote spec URL fails", async () => {
    const output = path.join(dir, "site");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await runGenerate(makeProgram(), ["https://example.com/missing.yaml", "--output", output]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls[0][0]).toContain("failed with status 404");
    expect(existsSync(output)).toBe(false);

    vi.unstubAllGlobals();
  });
});
