# @apiuikit/cli

## 0.5.0

### Minor Changes

- Bump `@apiuikit/web-component` to v1.6.0 for generated docs.

## 0.4.0

### Minor Changes

- bd8eb74: `generate` now accepts a `http://`/`https://` URL for `--header` and `--footer` — HTML fragments are fetched directly, on the same terms as the spec and `--config`.
- bd8eb74: `generate` and `validate` now accept a `http://`/`https://` URL for `<input>`, and `--config` accepts a URL too — the spec/config is fetched directly instead of requiring a local download first.

## 0.3.0

### Minor Changes

- 2607c78: Add `--header`/`--footer` flags to `generate`, letting you inject local HTML files (with their own CSS) before and after the generated documentation. Includes example header/footer fixtures under `examples/branding/`.

## 0.2.0

### Minor Changes

- 1fb3e1c: Add `apiuikit validate <input>` to validate a local OpenAPI or AsyncAPI spec. Validation is powered by `@scalar/openapi-parser` and `@asyncapi/parser` — the same parsers `apiuikit` itself uses — declared as optional peer dependencies so they aren't bundled with the CLI. If a parser isn't installed, an interactive run prompts before installing it as a dev dependency of the current directory; non-interactive runs (CI) fail with manual install instructions unless you pass `--yes` to install without prompting.

## 0.1.1

### Patch Changes

- 4e2a54e: Add a Vitest test suite covering the CLI, generate/serve commands, and utilities, plus a GitHub Actions CI/release pipeline (Changesets + npm trusted publishing).
