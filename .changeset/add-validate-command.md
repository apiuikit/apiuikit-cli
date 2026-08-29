---
"@apiuikit/cli": minor
---

Add `apiuikit validate <input>` to validate a local OpenAPI or AsyncAPI spec. Validation is powered by `@scalar/openapi-parser` and `@asyncapi/parser` — the same parsers `apiuikit` itself uses — declared as optional peer dependencies so they aren't bundled with the CLI. If a parser isn't installed, `validate` prompts to install it on demand (or pass `--yes` to install automatically without prompting).
