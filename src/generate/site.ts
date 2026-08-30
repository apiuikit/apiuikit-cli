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

export interface BuildHtmlOptions {
  type: SpecType;
  title: string;
  specText: string;
  config?: ParsedConfig;
  scriptHref: string;
  styleHref: string;
  headerHtml?: string;
  footerHtml?: string;
}

export function buildHtml({
  type,
  title,
  specText,
  config,
  scriptHref,
  styleHref,
  headerHtml,
  footerHtml,
}: BuildHtmlOptions): string {
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

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<meta name="generator" content="@apiuikit/cli" />
<link rel="stylesheet" href="${styleHref}" />
<style>html,body{margin:0;padding:0;}</style>
</head>
<body>
${headerBlock}<${tag} id="apiuikit-doc"></${tag}>
<script src="${scriptHref}"></script>
<script>
  document.getElementById("apiuikit-doc").spec = ${specLiteral};${configAssignment}
</script>
${footerBlock}</body>
</html>
`;
}
