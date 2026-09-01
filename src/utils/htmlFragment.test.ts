import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REMOTE_FOOTER_HTML, REMOTE_HEADER_HTML } from "../test/remoteSpecs.js";
import { readHtmlFragmentFile, HtmlFragmentError } from "./htmlFragment.js";

describe("readHtmlFragmentFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "apiuikit-html-fragment-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads the raw contents of an HTML file", async () => {
    const file = path.join(dir, "header.html");
    writeFileSync(file, "<div class=\"banner\">Beta docs</div>");
    await expect(readHtmlFragmentFile(file, "header")).resolves.toBe('<div class="banner">Beta docs</div>');
  });

  it("throws an HtmlFragmentError for a missing header file", async () => {
    await expect(readHtmlFragmentFile(path.join(dir, "missing.html"), "header")).rejects.toThrow(HtmlFragmentError);
    await expect(readHtmlFragmentFile(path.join(dir, "missing.html"), "header")).rejects.toThrow(/No such header file/);
  });

  it("throws an HtmlFragmentError for a missing footer file", async () => {
    await expect(readHtmlFragmentFile(path.join(dir, "missing.html"), "footer")).rejects.toThrow(/No such footer file/);
  });

  it("throws an HtmlFragmentError when the path is a directory", async () => {
    const sub = path.join(dir, "adir.html");
    mkdirSync(sub);
    await expect(readHtmlFragmentFile(sub, "header")).rejects.toThrow(/Expected a file but got a directory/);
  });
});

describe("readHtmlFragmentFile with remote URLs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches header HTML from an http(s) URL", async () => {
    const html = await readHtmlFragmentFile(REMOTE_HEADER_HTML, "header");
    expect(html).toContain("apiuikit-example-header");
    expect(html).toContain("APIUIKit");
  });

  it("fetches footer HTML from an http(s) URL", async () => {
    const html = await readHtmlFragmentFile(REMOTE_FOOTER_HTML, "footer");
    expect(html).toContain("apiuikit-example-footer");
    expect(html).toContain("Docs generated with");
  });

  it("throws an HtmlFragmentError when the remote request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readHtmlFragmentFile("https://example.com/header.html", "header")).rejects.toThrow(HtmlFragmentError);
    await expect(readHtmlFragmentFile("https://example.com/header.html", "header")).rejects.toThrow(/Could not reach/);
  });

  it("throws an HtmlFragmentError when the remote server returns a non-2xx status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(readHtmlFragmentFile("https://example.com/missing.html", "footer")).rejects.toThrow(/failed with status 404/);
  });
});
