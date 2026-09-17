---
"@apiuikit/cli": minor
---

Add `--out-file-name` to `generate` (with `--single-file`) for a custom HTML filename, and make `serve` auto-detect a single custom-named `.html`/`.htm` file as the entry point when `index.html` is missing. Also map `.htm` to `text/html` so those files render in the browser instead of downloading.
