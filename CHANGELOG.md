# @apiuikit/cli

## 0.2.0

### Minor Changes

- 1fb3e1c: Add `apiuikit validate <input>` to validate a local OpenAPI or AsyncAPI spec. Validation is powered by `@scalar/openapi-parser` and `@asyncapi/parser` — the same parsers `apiuikit` itself uses — declared as optional peer dependencies so they aren't bundled with the CLI. If a parser isn't installed, an interactive run prompts before installing it as a dev dependency of the current directory; non-interactive runs (CI) fail with manual install instructions unless you pass `--yes` to install without prompting.

## 0.1.1

### Patch Changes

- 4e2a54e: Add a Vitest test suite covering the CLI, generate/serve commands, and utilities, plus a GitHub Actions CI/release pipeline (Changesets + npm trusted publishing).
