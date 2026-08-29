import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertSupportedExtension,
  readSpecFile,
  detectSpecType,
  getSpecTitle,
  SpecError,
} from "./spec.js";

describe("assertSupportedExtension", () => {
  it("accepts .yaml, .yml, and .json", () => {
    expect(assertSupportedExtension("spec.yaml")).toBe(".yaml");
    expect(assertSupportedExtension("spec.yml")).toBe(".yml");
    expect(assertSupportedExtension("spec.json")).toBe(".json");
  });

  it("is case-insensitive", () => {
    expect(assertSupportedExtension("spec.YAML")).toBe(".yaml");
  });

  it("throws a SpecError for unsupported extensions", () => {
    expect(() => assertSupportedExtension("spec.txt")).toThrow(SpecError);
    expect(() => assertSupportedExtension("spec.txt")).toThrow(/Unsupported file type/);
  });

  it("throws a SpecError for a missing extension", () => {
    expect(() => assertSupportedExtension("spec")).toThrow(/\(none\)/);
  });
});

describe("readSpecFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "apiuikit-spec-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses a valid JSON spec", () => {
    const file = path.join(dir, "spec.json");
    writeFileSync(file, JSON.stringify({ openapi: "3.0.0", info: { title: "Test" } }));

    const { parsed, ext, raw } = readSpecFile(file);
    expect(ext).toBe(".json");
    expect(parsed).toEqual({ openapi: "3.0.0", info: { title: "Test" } });
    expect(raw).toContain("openapi");
  });

  it("parses a valid YAML spec", () => {
    const file = path.join(dir, "spec.yaml");
    writeFileSync(file, "openapi: 3.0.0\ninfo:\n  title: Test\n");

    const { parsed, ext } = readSpecFile(file);
    expect(ext).toBe(".yaml");
    expect(parsed).toEqual({ openapi: "3.0.0", info: { title: "Test" } });
  });

  it("throws for an unsupported extension", () => {
    const file = path.join(dir, "spec.txt");
    writeFileSync(file, "openapi: 3.0.0");
    expect(() => readSpecFile(file)).toThrow(SpecError);
  });

  it("throws a SpecError for a missing file", () => {
    const file = path.join(dir, "missing.yaml");
    expect(() => readSpecFile(file)).toThrow(/No such file/);
  });

  it("throws a SpecError when the path is a directory", () => {
    const sub = path.join(dir, "adir.yaml");
    mkdirSync(sub);
    expect(() => readSpecFile(sub)).toThrow(/Expected a file but got a directory/);
  });

  it("throws a SpecError for invalid JSON", () => {
    const file = path.join(dir, "bad.json");
    writeFileSync(file, "{ not valid json");
    expect(() => readSpecFile(file)).toThrow(/Could not parse/);
  });

  it("throws a SpecError for invalid YAML", () => {
    const file = path.join(dir, "bad.yaml");
    writeFileSync(file, "key: [unclosed");
    expect(() => readSpecFile(file)).toThrow(/Could not parse/);
  });

  it("throws a SpecError when the parsed document is not an object", () => {
    const file = path.join(dir, "array.json");
    writeFileSync(file, "[1, 2, 3]");
    expect(() => readSpecFile(file)).toThrow(/does not contain a valid/);
  });

  it("throws a SpecError when the parsed document is a scalar", () => {
    const file = path.join(dir, "scalar.yaml");
    writeFileSync(file, "just a string");
    expect(() => readSpecFile(file)).toThrow(/does not contain a valid/);
  });
});

describe("detectSpecType", () => {
  it("detects asyncapi documents", () => {
    expect(detectSpecType({ asyncapi: "2.6.0" })).toBe("asyncapi");
  });

  it("detects openapi documents", () => {
    expect(detectSpecType({ openapi: "3.0.0" })).toBe("openapi");
  });

  it("detects legacy swagger documents as openapi", () => {
    expect(detectSpecType({ swagger: "2.0" })).toBe("openapi");
  });

  it("throws a SpecError when neither field is present", () => {
    expect(() => detectSpecType({ info: { title: "x" } })).toThrow(SpecError);
    expect(() => detectSpecType({})).toThrow(/Could not detect/);
  });

  it("ignores non-string asyncapi/openapi fields", () => {
    expect(() => detectSpecType({ openapi: 3 })).toThrow(SpecError);
  });
});

describe("getSpecTitle", () => {
  it("returns the spec's title when present", () => {
    expect(getSpecTitle({ info: { title: "My API" } })).toBe("My API");
  });

  it("trims whitespace around the title", () => {
    expect(getSpecTitle({ info: { title: "  Padded  " } })).toBe("Padded");
  });

  it("falls back to the default when info is missing", () => {
    expect(getSpecTitle({})).toBe("API Documentation");
  });

  it("falls back to the default when the title is blank", () => {
    expect(getSpecTitle({ info: { title: "   " } })).toBe("API Documentation");
  });

  it("falls back to the default when the title is not a string", () => {
    expect(getSpecTitle({ info: { title: 123 } })).toBe("API Documentation");
  });

  it("falls back to a custom fallback when provided", () => {
    expect(getSpecTitle(undefined, "Fallback Title")).toBe("Fallback Title");
  });
});
