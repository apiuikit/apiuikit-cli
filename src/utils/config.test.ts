import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readConfigFile, ConfigError } from "./config.js";

describe("readConfigFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "apiuikit-config-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses a valid JSON config", async () => {
    const file = path.join(dir, "config.json");
    writeFileSync(file, JSON.stringify({ theme: "dark" }));
    await expect(readConfigFile(file)).resolves.toEqual({ theme: "dark" });
  });

  it("parses a valid YAML config", async () => {
    const file = path.join(dir, "config.yaml");
    writeFileSync(file, "theme: dark\nsidebar:\n  collapsed: true\n");
    await expect(readConfigFile(file)).resolves.toEqual({ theme: "dark", sidebar: { collapsed: true } });
  });

  it("throws a ConfigError for an unsupported extension", async () => {
    const file = path.join(dir, "config.txt");
    writeFileSync(file, "theme: dark");
    await expect(readConfigFile(file)).rejects.toThrow(ConfigError);
    await expect(readConfigFile(file)).rejects.toThrow(/Unsupported config file type/);
  });

  it("throws a ConfigError for a missing file", async () => {
    await expect(readConfigFile(path.join(dir, "missing.json"))).rejects.toThrow(/No such config file/);
  });

  it("throws a ConfigError when the path is a directory", async () => {
    const sub = path.join(dir, "adir.json");
    mkdirSync(sub);
    await expect(readConfigFile(sub)).rejects.toThrow(/Expected a file but got a directory/);
  });

  it("throws a ConfigError for invalid JSON", async () => {
    const file = path.join(dir, "bad.json");
    writeFileSync(file, "{ not valid");
    await expect(readConfigFile(file)).rejects.toThrow(/Could not parse/);
  });

  it("throws a ConfigError when the parsed document is not an object", async () => {
    const file = path.join(dir, "array.json");
    writeFileSync(file, "[1, 2, 3]");
    await expect(readConfigFile(file)).rejects.toThrow(/does not contain a valid config object/);
  });
});

describe("readConfigFile with remote URLs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and parses a config from an http(s) URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ theme: "dark" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(readConfigFile("https://example.com/apiuikit.config.json")).resolves.toEqual({ theme: "dark" });
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/apiuikit.config.json");
  });

  it("throws a ConfigError when the remote request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readConfigFile("https://example.com/config.json")).rejects.toThrow(ConfigError);
    await expect(readConfigFile("https://example.com/config.json")).rejects.toThrow(/Could not reach/);
  });

  it("throws a ConfigError when the remote server returns a non-2xx status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(readConfigFile("https://example.com/config.json")).rejects.toThrow(/failed with status 500/);
  });
});
