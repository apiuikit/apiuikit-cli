import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

  it("parses a valid JSON config", () => {
    const file = path.join(dir, "config.json");
    writeFileSync(file, JSON.stringify({ theme: "dark" }));
    expect(readConfigFile(file)).toEqual({ theme: "dark" });
  });

  it("parses a valid YAML config", () => {
    const file = path.join(dir, "config.yaml");
    writeFileSync(file, "theme: dark\nsidebar:\n  collapsed: true\n");
    expect(readConfigFile(file)).toEqual({ theme: "dark", sidebar: { collapsed: true } });
  });

  it("throws a ConfigError for an unsupported extension", () => {
    const file = path.join(dir, "config.txt");
    writeFileSync(file, "theme: dark");
    expect(() => readConfigFile(file)).toThrow(ConfigError);
    expect(() => readConfigFile(file)).toThrow(/Unsupported config file type/);
  });

  it("throws a ConfigError for a missing file", () => {
    expect(() => readConfigFile(path.join(dir, "missing.json"))).toThrow(/No such config file/);
  });

  it("throws a ConfigError when the path is a directory", () => {
    const sub = path.join(dir, "adir.json");
    mkdirSync(sub);
    expect(() => readConfigFile(sub)).toThrow(/Expected a file but got a directory/);
  });

  it("throws a ConfigError for invalid JSON", () => {
    const file = path.join(dir, "bad.json");
    writeFileSync(file, "{ not valid");
    expect(() => readConfigFile(file)).toThrow(/Could not parse/);
  });

  it("throws a ConfigError when the parsed document is not an object", () => {
    const file = path.join(dir, "array.json");
    writeFileSync(file, "[1, 2, 3]");
    expect(() => readConfigFile(file)).toThrow(/does not contain a valid config object/);
  });
});
