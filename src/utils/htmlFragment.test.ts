import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readHtmlFragmentFile, HtmlFragmentError } from "./htmlFragment.js";

describe("readHtmlFragmentFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "apiuikit-html-fragment-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads the raw contents of an HTML file", () => {
    const file = path.join(dir, "header.html");
    writeFileSync(file, "<div class=\"banner\">Beta docs</div>");
    expect(readHtmlFragmentFile(file, "header")).toBe('<div class="banner">Beta docs</div>');
  });

  it("throws an HtmlFragmentError for a missing header file", () => {
    expect(() => readHtmlFragmentFile(path.join(dir, "missing.html"), "header")).toThrow(HtmlFragmentError);
    expect(() => readHtmlFragmentFile(path.join(dir, "missing.html"), "header")).toThrow(/No such header file/);
  });

  it("throws an HtmlFragmentError for a missing footer file", () => {
    expect(() => readHtmlFragmentFile(path.join(dir, "missing.html"), "footer")).toThrow(/No such footer file/);
  });

  it("throws an HtmlFragmentError when the path is a directory", () => {
    const sub = path.join(dir, "adir.html");
    mkdirSync(sub);
    expect(() => readHtmlFragmentFile(sub, "header")).toThrow(/Expected a file but got a directory/);
  });
});
