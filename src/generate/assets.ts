import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

const JS_ASSET_NAME = "apiuikit.js";
const CSS_ASSET_NAME = "apiuikit.css";
const ASSETS_DIR_NAME = "assets";

export interface WebComponentAssets {
  scriptHref: string;
  styleHref: string;
}

/**
 * Copies the self-contained IIFE build of @apiuikit/web-component (script +
 * stylesheet, no dynamic imports) into the generated site's assets/ folder,
 * so the output works standalone — no bundler, no network, opens straight
 * from disk via file://. Resolved via the package's own "exports" map
 * (its default entry is the IIFE build; "./style.css" is an explicit
 * subpath) rather than by reading package.json + guessing at dist/ layout,
 * since "exports" blocks resolving paths that aren't listed there.
 */
export function copyWebComponentAssets(outputDir: string): WebComponentAssets {
  let jsSource: string;
  let cssSource: string;
  try {
    jsSource = require.resolve("@apiuikit/web-component");
    cssSource = require.resolve("@apiuikit/web-component/style.css");
  } catch (error) {
    const err = error as Error;
    throw new Error(
      `Could not resolve the @apiuikit/web-component package. Is @apiuikit/cli installed correctly? (${err.message})`,
    );
  }

  const assetsDir = path.join(outputDir, ASSETS_DIR_NAME);
  mkdirSync(assetsDir, { recursive: true });

  const jsDest = path.join(assetsDir, JS_ASSET_NAME);
  const cssDest = path.join(assetsDir, CSS_ASSET_NAME);
  copyFileSync(jsSource, jsDest);
  copyFileSync(cssSource, cssDest);

  return {
    scriptHref: `${ASSETS_DIR_NAME}/${JS_ASSET_NAME}`,
    styleHref: `${ASSETS_DIR_NAME}/${CSS_ASSET_NAME}`,
  };
}
