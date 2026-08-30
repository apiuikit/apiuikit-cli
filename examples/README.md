# Examples

Sample specs for manually exercising `apiuikit generate` — mixed formats (`.json`/`.yaml`), mixed complexity, both spec types. Pulled from the [apiuikit](https://github.com/AceTheCreator/apiuikit) repo's own demo/example fixtures.

| File | Type | Format | Notes |
|---|---|---|---|
| `openapi/petstore.json` | OpenAPI 3.0 | JSON | Classic Swagger Petstore — small, good smoke test |
| `openapi/petstore.yaml` | OpenAPI 3.0 | YAML | Same document, YAML twin |
| `openapi/netlify.json` | OpenAPI 3.0 | JSON | Large real-world API (~240KB) |
| `openapi/torture.yaml` | OpenAPI 3.1 | YAML | Intentionally complex/edge-case-heavy |
| `asyncapi/streetlights.json` | AsyncAPI 3.1 | JSON | Canonical Streetlights Kafka example |
| `asyncapi/streetlights.yaml` | AsyncAPI 3.1 | YAML | Same document, YAML twin |
| `asyncapi/adeo-kafka.json` | AsyncAPI 3.1 | JSON | Real-world case study |
| `asyncapi/torture.json` | AsyncAPI 3.1 | JSON | Composition torture test |

Run any of them through the CLI, e.g.:

```bash
node bin/apiuikit.js generate examples/openapi/petstore.json --output /tmp/petstore-docs
node bin/apiuikit.js generate examples/asyncapi/torture.json --output /tmp/torture-docs --force
```

Then open `<output>/index.html` directly in a browser.

## Header/footer branding

`branding/header.html` and `branding/footer.html` are sample `--header`/`--footer` fragments — a dark top bar with an APIUIKit wordmark + GitHub/npm links, and a matching footer credit line. Each is self-contained (its `<style>` is scoped to a unique class, per the [README](../README.md#header--footer)), so you can drop either one in as-is or use it as a starting point for your own branding.

```bash
node bin/apiuikit.js generate examples/openapi/petstore.json \
  --header examples/branding/header.html \
  --footer examples/branding/footer.html \
  --output /tmp/petstore-docs --force
```
