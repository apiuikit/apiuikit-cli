# @apiuikit/cli

[![npm version](https://img.shields.io/npm/v/@apiuikit/cli.svg?label=%40apiuikit%2Fcli)](https://www.npmjs.com/package/@apiuikit/cli)
[![npm downloads](https://img.shields.io/npm/dm/@apiuikit/cli.svg)](https://www.npmjs.com/package/@apiuikit/cli)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Website](https://img.shields.io/badge/website-apiuikit.com-1473FF.svg)](https://apiuikit.com)

Generate a static API documentation site from a local OpenAPI or AsyncAPI spec — no React, no frontend project required. Powered by [APIUIKit](https://github.com/AceTheCreator/apiuikit).

Built for projects that don't have a React/frontend toolchain in the loop: Java/Spring, Maven, Go, Python, CI/CD pipelines, and docs-only repos.

## Install

```bash
npm install -g @apiuikit/cli
```

Or run it without installing:

```bash
npx @apiuikit/cli generate ./openapi.yaml
```

## Usage

```bash
apiuikit generate <input> [options]
```

`<input>` is a local `.yaml`, `.yml`, or `.json` OpenAPI or AsyncAPI document. The spec type is detected automatically from its top-level `openapi`/`swagger` or `asyncapi` field.

### Options

| Flag | Description | Default |
|---|---|---|
| `-o, --output <dir>` | Output directory for the generated site | `apiuikit-docs` |
| `-c, --config <file>` | JSON or YAML config file passed through to apiuikit | — |
| `-f, --force` | Overwrite the output directory if it already contains files | `false` |

### Examples

```bash
apiuikit generate ./openapi.yaml
apiuikit generate ./asyncapi.json --output ./site
apiuikit generate ./spec.yaml --config ./apiuikit.config.json
apiuikit generate ./spec.yaml --output ./docs --force
```

The generated `index.html`, along with a self-contained script and stylesheet under `assets/`, is fully static — open it directly from disk (`file://`) or serve it from any static host (GitHub Pages, S3, nginx, etc.). No build step, no server, no network calls at runtime.

### Config

`--config` points at a local `.json`, `.yaml`, or `.yml` file whose contents are passed straight through as the `config` prop on the underlying `<apiuikit-openapi-renderer>`/`<apiuikit-asyncapi-renderer>` element — the same `ConfigInterface` used by apiuikit's React and web-component APIs (theme colors, `show`/`expand` toggles for sidebar/servers/schemas/code samples/etc., `topOffset`, custom request/reply labels, and more).

```json
{
  "show": { "sidebar": true, "codeSamples": false },
  "theme": {
    "dark": { "background": "#1a1b26", "surface": "#24283b", "textPrimary": "#c0caf5" }
  }
}
```

```bash
apiuikit generate ./openapi.yaml --config ./apiuikit.config.json
```

### Validating a spec

```bash
apiuikit validate <input> [options]
```

Runs real schema validation against a local OpenAPI or AsyncAPI document, powered by [`@scalar/openapi-parser`](https://www.npmjs.com/package/@scalar/openapi-parser) and [`@asyncapi/parser`](https://www.npmjs.com/package/@asyncapi/parser) — the same parsers `apiuikit` itself uses. Exits with code `1` and prints each error if the spec is invalid, `0` (with any warnings printed) if it's valid.

These parsers are heavy, so they're never bundled with the CLI — they're declared as optional peer dependencies and only fetched the first time you actually run `validate`. If one isn't installed yet, you'll be prompted to install it on the spot; pass `-y`/`--yes` to skip the prompt and install automatically (handy in CI).

| Flag | Description | Default |
|---|---|---|
| `-y, --yes` | Install the required validator package automatically without prompting | `false` |

```bash
apiuikit validate ./openapi.yaml
apiuikit validate ./asyncapi.json
apiuikit validate ./spec.yaml --yes
```

### Previewing the output

```bash
apiuikit serve [dir] [options]
```

Serves a generated site over plain HTTP for local preview. `[dir]` defaults to `apiuikit-docs`, matching `generate`'s default output, so `apiuikit generate spec.yaml && apiuikit serve` works with no extra flags. This is a convenience wrapper around Node's built-in `http` module — it adds zero new dependencies to the CLI, since the generated site needs no server at all (it opens fine straight from `file://`).

| Flag | Description | Default |
|---|---|---|
| `-p, --port <port>` | Preferred port (auto-increments if taken) | `4300` |
| `--open` | Open the site in your default browser | `false` |

```bash
apiuikit serve
apiuikit serve ./site --port 5000
apiuikit serve --open
```

### Help

```bash
apiuikit --help
apiuikit generate --help
apiuikit serve --help
apiuikit validate --help
```

## How it works

`apiuikit generate` reads your spec, detects whether it's OpenAPI or AsyncAPI, and embeds it directly into an `index.html` built around [`@apiuikit/web-component`](https://www.npmjs.com/package/@apiuikit/web-component)'s `<apiuikit-openapi-renderer>` / `<apiuikit-asyncapi-renderer>` custom elements — the same rendering engine used by APIUIKit's React components, packaged as a framework-agnostic web component.

## License

Apache-2.0
