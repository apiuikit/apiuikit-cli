---
"@apiuikit/cli": minor
---

Add `apiuikit validate <input>` to validate a local OpenAPI or AsyncAPI spec. Validation is powered by `@scalar/openapi-parser` and `@asyncapi/parser` — the same parsers `apiuikit` itself uses — declared as optional peer dependencies so they aren't bundled with the CLI. If a parser isn't installed, an interactive run prompts before installing it as a dev dependency of the current directory; non-interactive runs (CI) fail with manual install instructions unless you pass `--yes` to install without prompting.
