import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { copyWebComponentAssets, readWebComponentAssets, removeCopiedWebComponentAssets } from "./assets.js";

const require = createRequire(import.meta.url);

describe("copyWebComponentAssets", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "apiuikit-assets-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("copies the web component's script and stylesheet into an assets/ subdirectory", () => {
    const { scriptHref, styleHref } = copyWebComponentAssets(dir);

    expect(scriptHref).toBe("assets/apiuikit.js");
    expect(styleHref).toBe("assets/apiuikit.css");
    expect(existsSync(path.join(dir, "assets", "apiuikit.js"))).toBe(true);
    expect(existsSync(path.join(dir, "assets", "apiuikit.css"))).toBe(true);
  });

  it("copies the exact bytes of the resolved package files", () => {
    copyWebComponentAssets(dir);

    const jsSource = require.resolve("@apiuikit/web-component");
    const cssSource = require.resolve("@apiuikit/web-component/style.css");

    expect(readFileSync(path.join(dir, "assets", "apiuikit.js"), "utf8")).toBe(readFileSync(jsSource, "utf8"));
    expect(readFileSync(path.join(dir, "assets", "apiuikit.css"), "utf8")).toBe(readFileSync(cssSource, "utf8"));
  });

  it("creates the output directory if it doesn't already exist", () => {
    const nested = path.join(dir, "nested", "output");
    copyWebComponentAssets(nested);
    expect(existsSync(path.join(nested, "assets", "apiuikit.js"))).toBe(true);
  });

  it("wraps a resolution failure with a clear, actionable error message", async () => {
    vi.resetModules();
    vi.doMock("node:module", () => ({
      createRequire: () => ({
        resolve: () => {
          throw new Error("Cannot find module '@apiuikit/web-component'");
        },
      }),
    }));

    const { copyWebComponentAssets: copyWithBrokenResolve } = await import("./assets.js");

    expect(() => copyWithBrokenResolve(dir)).toThrow(/Could not resolve the @apiuikit\/web-component package/);

    vi.doUnmock("node:module");
    vi.resetModules();
  });
});

describe("readWebComponentAssets", () => {
  it("reads the web component's script and stylesheet as UTF-8 strings matching the resolved package files", () => {
    const { scriptContent, styleContent } = readWebComponentAssets();

    const jsSource = require.resolve("@apiuikit/web-component");
    const cssSource = require.resolve("@apiuikit/web-component/style.css");

    expect(scriptContent).toBe(readFileSync(jsSource, "utf8"));
    expect(styleContent).toBe(readFileSync(cssSource, "utf8"));
    expect(scriptContent.length).toBeGreaterThan(0);
    expect(styleContent.length).toBeGreaterThan(0);
  });

  it("wraps a resolution failure with a clear, actionable error message", async () => {
    vi.resetModules();
    vi.doMock("node:module", () => ({
      createRequire: () => ({
        resolve: () => {
          throw new Error("Cannot find module '@apiuikit/web-component'");
        },
      }),
    }));

    const { readWebComponentAssets: readWithBrokenResolve } = await import("./assets.js");

    expect(() => readWithBrokenResolve()).toThrow(/Could not resolve the @apiuikit\/web-component package/);

    vi.doUnmock("node:module");
    vi.resetModules();
  });
});

describe("removeCopiedWebComponentAssets", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "apiuikit-assets-remove-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("is a no-op when assets/ does not exist", () => {
    expect(() => removeCopiedWebComponentAssets(dir)).not.toThrow();
    expect(existsSync(path.join(dir, "assets"))).toBe(false);
  });

  it("removes the copied script and stylesheet and the now-empty assets/ directory", () => {
    copyWebComponentAssets(dir);

    removeCopiedWebComponentAssets(dir);

    expect(existsSync(path.join(dir, "assets", "apiuikit.js"))).toBe(false);
    expect(existsSync(path.join(dir, "assets", "apiuikit.css"))).toBe(false);
    expect(existsSync(path.join(dir, "assets"))).toBe(false);
  });

  it("leaves extra files in assets/ and keeps the directory", () => {
    copyWebComponentAssets(dir);
    writeFileSync(path.join(dir, "assets", "custom.css"), "/* keep me */");

    removeCopiedWebComponentAssets(dir);

    expect(existsSync(path.join(dir, "assets", "apiuikit.js"))).toBe(false);
    expect(existsSync(path.join(dir, "assets", "apiuikit.css"))).toBe(false);
    expect(readFileSync(path.join(dir, "assets", "custom.css"), "utf8")).toBe("/* keep me */");
  });

  it("does not remove a non-directory path named assets", () => {
    const assetsAsFile = path.join(dir, "assets");
    writeFileSync(assetsAsFile, "not a directory");

    removeCopiedWebComponentAssets(dir);

    expect(readFileSync(assetsAsFile, "utf8")).toBe("not a directory");
  });

  it("is a no-op when assets/ exists but does not contain the copied files", () => {
    mkdirSync(path.join(dir, "assets"));
    writeFileSync(path.join(dir, "assets", "notes.txt"), "hello");

    removeCopiedWebComponentAssets(dir);

    expect(readFileSync(path.join(dir, "assets", "notes.txt"), "utf8")).toBe("hello");
  });
});
