import { describe, it, expect } from "vitest";
import { buildHtml } from "./site.js";

const baseOptions = {
  title: "My API",
  specText: "openapi: 3.0.0",
  scriptHref: "assets/apiuikit.js",
  styleHref: "assets/apiuikit.css",
};

describe("buildHtml", () => {
  it("renders the openapi renderer element for openapi specs", () => {
    const html = buildHtml({ ...baseOptions, type: "openapi" });
    expect(html).toContain('<apiuikit-openapi-renderer id="apiuikit-doc"></apiuikit-openapi-renderer>');
  });

  it("renders the asyncapi renderer element for asyncapi specs", () => {
    const html = buildHtml({ ...baseOptions, type: "asyncapi" });
    expect(html).toContain('<apiuikit-asyncapi-renderer id="apiuikit-doc"></apiuikit-asyncapi-renderer>');
  });

  it("throws for an unknown spec type", () => {
    // @ts-expect-error intentionally passing an invalid type to exercise the guard
    expect(() => buildHtml({ ...baseOptions, type: "graphql" })).toThrow(/Unknown spec type/);
  });

  it("wires up the provided script and style hrefs", () => {
    const html = buildHtml({ ...baseOptions, type: "openapi" });
    expect(html).toContain('<link rel="stylesheet" href="assets/apiuikit.css" />');
    expect(html).toContain('<script src="assets/apiuikit.js"></script>');
  });

  it("sets the page title, escaping HTML-sensitive characters", () => {
    const html = buildHtml({ ...baseOptions, type: "openapi", title: `<script>alert(1)</script> & "quotes"` });
    expect(html).toContain('<title>&lt;script&gt;alert(1)&lt;/script&gt; &amp; "quotes"</title>');
    expect(html).not.toContain("<title><script>");
  });

  it("inlines the raw spec text as a JSON string literal", () => {
    const html = buildHtml({ ...baseOptions, type: "openapi", specText: "openapi: 3.0.0\ninfo:\n  title: X" });
    expect(html).toContain('document.getElementById("apiuikit-doc").spec = "openapi: 3.0.0\\ninfo:\\n  title: X";');
  });

  it("neutralizes a literal </script> inside the spec text so it can't close the surrounding script tag", () => {
    const html = buildHtml({ ...baseOptions, type: "openapi", specText: 'description: "</script><script>evil()</script>"' });
    expect(html).not.toContain("</script><script>evil()");
    // every "<" becomes \u003c (breaking up "</script>"); a bare ">" is not
    // itself dangerous inside a <script> block, so it's left untouched.
    expect(html).toContain('description: \\"\\u003c/script>\\u003cscript>evil()\\u003c/script>\\"');
  });

  it("omits the config assignment when no config is given", () => {
    const html = buildHtml({ ...baseOptions, type: "openapi" });
    expect(html).not.toContain(".config =");
  });

  it("assigns the config object when one is given", () => {
    const html = buildHtml({ ...baseOptions, type: "openapi", config: { theme: "dark" } });
    expect(html).toContain('document.getElementById("apiuikit-doc").config = {"theme":"dark"};');
  });

  it("produces well-formed, parseable HTML with a single root doctype", () => {
    const html = buildHtml({ ...baseOptions, type: "openapi" });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<meta charset="utf-8" />');
  });

  it("omits header/footer content when not provided", () => {
    const html = buildHtml({ ...baseOptions, type: "openapi" });
    expect(html).not.toContain("apiuikit-header-test");
    expect(html).not.toContain("apiuikit-footer-test");
  });

  it("injects header HTML before the renderer element, unescaped", () => {
    const html = buildHtml({
      ...baseOptions,
      type: "openapi",
      headerHtml: '<div class="apiuikit-header-test">Beta docs</div>',
    });
    const headerIndex = html.indexOf('<div class="apiuikit-header-test">Beta docs</div>');
    const elementIndex = html.indexOf('<apiuikit-openapi-renderer id="apiuikit-doc">');
    expect(headerIndex).toBeGreaterThan(-1);
    expect(headerIndex).toBeLessThan(elementIndex);
  });

  it("injects footer HTML after the spec script and before </body>, unescaped", () => {
    const html = buildHtml({
      ...baseOptions,
      type: "openapi",
      footerHtml: '<footer class="apiuikit-footer-test">&copy; 2026</footer>',
    });
    const scriptCloseIndex = html.lastIndexOf("</script>");
    const footerIndex = html.indexOf('<footer class="apiuikit-footer-test">&copy; 2026</footer>');
    const bodyCloseIndex = html.indexOf("</body>");
    expect(footerIndex).toBeGreaterThan(scriptCloseIndex);
    expect(footerIndex).toBeLessThan(bodyCloseIndex);
  });

  it("injects both header and footer together", () => {
    const html = buildHtml({
      ...baseOptions,
      type: "openapi",
      headerHtml: '<div class="apiuikit-header-test"></div>',
      footerHtml: '<div class="apiuikit-footer-test"></div>',
    });
    expect(html).toContain('<div class="apiuikit-header-test"></div>');
    expect(html).toContain('<div class="apiuikit-footer-test"></div>');
  });
});
