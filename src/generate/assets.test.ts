import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { copyWebComponentAssets } from "./assets.js";

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
