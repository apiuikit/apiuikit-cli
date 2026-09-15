import type { SpecType } from "../utils/spec.js";
import type { ParsedConfig } from "../utils/config.js";

const ELEMENT_TAG: Record<SpecType, string> = {
  openapi: "apiuikit-openapi-renderer",
  asyncapi: "apiuikit-asyncapi-renderer",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * JSON.stringify already produces valid, fully-escaped JS (a string literal
 * for spec text, an object literal for config), but the result can still
 * contain a literal "</script>" if the source data does — which would close
 * the surrounding <script> tag early when the HTML parser sees it. Escaping
 * every "<" to a unicode escape neutralizes that without touching the
 * underlying value.
 */
function toInlineScriptLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * The HTML parser closes a <script> element the instant it sees the literal,
 * case-insensitive byte sequence "</script" in its raw text, regardless of
 * whether that text is JS syntax or just data inside a string/template/regex
 * literal. Unlike toInlineScriptLiteral (which operates on JSON.stringify
 * output and can safely escape every "<"), this inlines raw, non-JSON JS
 * source, so a blanket "<" escape would corrupt real code (comparisons,
 * division, etc). Instead only the exact "</script" sequence is touched,
 * splicing in a backslash — a no-op escape inside a JS string, template, or
 * comment — which breaks the HTML close-tag match without changing what the
 * JS evaluates to.
 */
function neutralizeScriptCloseTags(jsSource: string): string {
  return jsSource.replace(/<\/script/gi, "<\\/script");
}

/**
 * Same idea for the stylesheet. "<" isn't a valid CSS token starter, so a
 * literal "</style" inside otherwise-valid CSS can only appear inside a
 * string or comment, where "\/" is likewise a no-op escape.
 */
function neutralizeStyleCloseTags(cssSource: string): string {
  return cssSource.replace(/<\/style/gi, "<\\/style");
}

export type SiteAssets =
  | { mode: "linked"; scriptHref: string; styleHref: string }
  | { mode: "inline"; scriptContent: string; styleContent: string };

export interface BuildHtmlOptions {
  type: SpecType;
  title: string;
  specText: string;
  config?: ParsedConfig;
  assets: SiteAssets;
  headerHtml?: string;
  footerHtml?: string;
}

export function buildHtml({ type, title, specText, config, assets, headerHtml, footerHtml }: BuildHtmlOptions): string {
  const tag = ELEMENT_TAG[type];
  if (!tag) {
    throw new Error(`Unknown spec type: ${type}`);
  }

  const safeTitle = escapeHtml(title);
  const specLiteral = toInlineScriptLiteral(specText);
  const configAssignment = config
    ? `\n  document.getElementById("apiuikit-doc").config = ${toInlineScriptLiteral(config)};`
    : "";
  const headerBlock = headerHtml ? `${headerHtml}\n` : "";
  const footerBlock = footerHtml ? `${footerHtml}\n` : "";

  const styleTag =
    assets.mode === "linked"
      ? `<link rel="stylesheet" href="${assets.styleHref}" />`
      : `<style>\n${neutralizeStyleCloseTags(assets.styleContent)}\n</style>`;
  const scriptTag =
    assets.mode === "linked"
      ? `<script src="${assets.scriptHref}"></script>`
      : `<script>\n${neutralizeScriptCloseTags(assets.scriptContent)}\n</script>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<meta name="generator" content="@apiuikit/cli" />
${styleTag}
<style>html,body{margin:0;padding:0;}</style>
</head>
<body>
${headerBlock}<${tag} id="apiuikit-doc"></${tag}>
${scriptTag}
<script>
  document.getElementById("apiuikit-doc").spec = ${specLiteral};${configAssignment}
</script>
${footerBlock}</body>
</html>
`;
}
