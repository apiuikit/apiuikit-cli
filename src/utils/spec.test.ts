import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REMOTE_ASYNCAPI_YAML, REMOTE_OPENAPI_YAML } from "../test/remoteSpecs.js";
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

  it("parses a valid JSON spec", async () => {
    const file = path.join(dir, "spec.json");
    writeFileSync(file, JSON.stringify({ openapi: "3.0.0", info: { title: "Test" } }));

    const { parsed, ext, raw } = await readSpecFile(file);
    expect(ext).toBe(".json");
    expect(parsed).toEqual({ openapi: "3.0.0", info: { title: "Test" } });
    expect(raw).toContain("openapi");
  });

  it("parses a valid YAML spec", async () => {
    const file = path.join(dir, "spec.yaml");
    writeFileSync(file, "openapi: 3.0.0\ninfo:\n  title: Test\n");

    const { parsed, ext } = await readSpecFile(file);
    expect(ext).toBe(".yaml");
    expect(parsed).toEqual({ openapi: "3.0.0", info: { title: "Test" } });
  });

  it("throws for an unsupported extension", async () => {
    const file = path.join(dir, "spec.txt");
    writeFileSync(file, "openapi: 3.0.0");
    await expect(readSpecFile(file)).rejects.toThrow(SpecError);
  });

  it("throws a SpecError for a missing file", async () => {
    const file = path.join(dir, "missing.yaml");
    await expect(readSpecFile(file)).rejects.toThrow(/No such file/);
  });

  it("throws a SpecError when the path is a directory", async () => {
    const sub = path.join(dir, "adir.yaml");
    mkdirSync(sub);
    await expect(readSpecFile(sub)).rejects.toThrow(/Expected a file but got a directory/);
  });

  it("throws a SpecError for invalid JSON", async () => {
    const file = path.join(dir, "bad.json");
    writeFileSync(file, "{ not valid json");
    await expect(readSpecFile(file)).rejects.toThrow(/Could not parse/);
  });

  it("throws a SpecError for invalid YAML", async () => {
    const file = path.join(dir, "bad.yaml");
    writeFileSync(file, "key: [unclosed");
    await expect(readSpecFile(file)).rejects.toThrow(/Could not parse/);
  });

  it("throws a SpecError when the parsed document is not an object", async () => {
    const file = path.join(dir, "array.json");
    writeFileSync(file, "[1, 2, 3]");
    await expect(readSpecFile(file)).rejects.toThrow(/does not contain a valid/);
  });

  it("throws a SpecError when the parsed document is a scalar", async () => {
    const file = path.join(dir, "scalar.yaml");
    writeFileSync(file, "just a string");
    await expect(readSpecFile(file)).rejects.toThrow(/does not contain a valid/);
  });
});

describe("readSpecFile with remote URLs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and parses an OpenAPI spec from an http(s) URL", async () => {
    const { parsed, ext } = await readSpecFile(REMOTE_OPENAPI_YAML);
    expect(ext).toBe(".yaml");
    expect(parsed.openapi).toBe("3.0.0");
    expect(getSpecTitle(parsed)).toBe("Swagger Petstore");
    expect(detectSpecType(parsed)).toBe("openapi");
  });

  it("fetches and parses an AsyncAPI spec from an http(s) URL", async () => {
    const { parsed, ext } = await readSpecFile(REMOTE_ASYNCAPI_YAML);
    expect(ext).toBe(".yml");
    expect(parsed.asyncapi).toBe("3.1.0");
    expect(getSpecTitle(parsed)).toBe("Streetlights Kafka API");
    expect(detectSpecType(parsed)).toBe("asyncapi");
  });

  it("ignores query strings when detecting the extension", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ openapi: "3.0.0" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { ext } = await readSpecFile("https://example.com/spec.json?token=abc");
    expect(ext).toBe(".json");
  });

  it("throws a SpecError when the remote request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readSpecFile("https://example.com/openapi.yaml")).rejects.toThrow(SpecError);
    await expect(readSpecFile("https://example.com/openapi.yaml")).rejects.toThrow(/Could not reach/);
  });

  it("throws a SpecError when the remote server returns a non-2xx status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(readSpecFile("https://example.com/missing.yaml")).rejects.toThrow(/failed with status 404/);
  });

  it("throws for an unsupported extension on a remote URL", async () => {
    await expect(readSpecFile("https://example.com/spec.txt")).rejects.toThrow(/Unsupported file type/);
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
