import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";

const listen = vi.fn();
const createStaticServer = vi.fn();
const openInBrowser = vi.fn();

vi.mock("../serve/server.js", () => ({
  createStaticServer: (...args: unknown[]) => createStaticServer(...args),
  listen: (...args: unknown[]) => listen(...args),
}));
vi.mock("../serve/open-browser.js", () => ({
  openInBrowser: (...args: unknown[]) => openInBrowser(...args),
}));

const { registerServeCommand } = await import("./serve.js");

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerServeCommand(program);
  return program;
}

async function runServe(program: Command, args: string[]): Promise<void> {
  await program.parseAsync(["node", "apiuikit", "serve", ...args]);
}

describe("serve command", () => {
  let dir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const fakeServer = { on: vi.fn(), close: vi.fn() };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "apiuikit-servecmd-"));
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "on").mockReturnValue(process);
    createStaticServer.mockReturnValue(fakeServer);
    listen.mockResolvedValue({ port: 4300, host: "127.0.0.1" });
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    listen.mockReset();
    createStaticServer.mockReset();
    openInBrowser.mockReset();
    rmSync(dir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it("serves an existing directory and reports its URL", async () => {
    writeFileSync(path.join(dir, "index.html"), "<h1>hi</h1>");

    await runServe(makeProgram(), [dir]);

    expect(process.exitCode).toBeUndefined();
    expect(createStaticServer).toHaveBeenCalledWith(dir);
    expect(listen).toHaveBeenCalledWith(fakeServer, 4300);
    expect(logSpy.mock.calls.flat().join("\n")).toContain("http://127.0.0.1:4300/");
  });

  it("warns when the directory has no index.html but still serves it", async () => {
    await runServe(makeProgram(), [dir]);

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain("No index.html found");
    expect(process.exitCode).toBeUndefined();
  });

  it("passes the requested port through to listen()", async () => {
    writeFileSync(path.join(dir, "index.html"), "ok");
    listen.mockResolvedValue({ port: 5000, host: "127.0.0.1" });

    await runServe(makeProgram(), [dir, "--port", "5000"]);

    expect(listen).toHaveBeenCalledWith(fakeServer, 5000);
  });

  it("opens the browser when --open is given", async () => {
    writeFileSync(path.join(dir, "index.html"), "ok");

    await runServe(makeProgram(), [dir, "--open"]);

    expect(openInBrowser).toHaveBeenCalledWith("http://127.0.0.1:4300/");
  });

  it("does not open the browser by default", async () => {
    writeFileSync(path.join(dir, "index.html"), "ok");

    await runServe(makeProgram(), [dir]);

    expect(openInBrowser).not.toHaveBeenCalled();
  });

  it("sets a non-zero exit code for a directory that doesn't exist", async () => {
    const missing = path.join(dir, "nope");

    await runServe(makeProgram(), [missing]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
    expect(createStaticServer).not.toHaveBeenCalled();
  });

  it("sets a non-zero exit code for an invalid port", async () => {
    writeFileSync(path.join(dir, "index.html"), "ok");

    await runServe(makeProgram(), [dir, "--port", "not-a-port"]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls[0][0]).toContain("Invalid port");
    expect(createStaticServer).not.toHaveBeenCalled();
  });

  it("sets a non-zero exit code for an out-of-range port", async () => {
    writeFileSync(path.join(dir, "index.html"), "ok");

    await runServe(makeProgram(), [dir, "--port", "99999"]);

    expect(process.exitCode).toBe(1);
    expect(createStaticServer).not.toHaveBeenCalled();
  });
});
