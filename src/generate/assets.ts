import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

const JS_ASSET_NAME = "apiuikit.js";
const CSS_ASSET_NAME = "apiuikit.css";
const ASSETS_DIR_NAME = "assets";

export interface WebComponentAssets {
  scriptHref: string;
  styleHref: string;
}

export interface WebComponentAssetContents {
  scriptContent: string;
  styleContent: string;
}

interface ResolvedWebComponentPaths {
  jsPath: string;
  cssPath: string;
}

/**
 * Resolved via the package's own "exports" map (its default entry is the
 * IIFE build; "./style.css" is an explicit subpath) rather than by reading
 * package.json + guessing at dist/ layout, since "exports" blocks resolving
 * paths that aren't listed there.
 */
function resolveWebComponentPaths(): ResolvedWebComponentPaths {
  try {
    return {
      jsPath: require.resolve("@apiuikit/web-component"),
      cssPath: require.resolve("@apiuikit/web-component/style.css"),
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(
      `Could not resolve the @apiuikit/web-component package. Is @apiuikit/cli installed correctly? (${err.message})`,
    );
  }
}

/**
 * Copies the self-contained IIFE build of @apiuikit/web-component (script +
 * stylesheet, no dynamic imports) into the generated site's assets/ folder,
 * so the output works standalone — no bundler, no network, opens straight
 * from disk via file://.
 */
export function copyWebComponentAssets(outputDir: string): WebComponentAssets {
  const { jsPath, cssPath } = resolveWebComponentPaths();

  const assetsDir = path.join(outputDir, ASSETS_DIR_NAME);
  mkdirSync(assetsDir, { recursive: true });

  const jsDest = path.join(assetsDir, JS_ASSET_NAME);
  const cssDest = path.join(assetsDir, CSS_ASSET_NAME);
  copyFileSync(jsPath, jsDest);
  copyFileSync(cssPath, cssDest);

  return {
    scriptHref: `${ASSETS_DIR_NAME}/${JS_ASSET_NAME}`,
    styleHref: `${ASSETS_DIR_NAME}/${CSS_ASSET_NAME}`,
  };
}

/**
 * Reads the same script + stylesheet that copyWebComponentAssets() copies to
 * disk, but as in-memory strings, for --single-file mode where they get
 * inlined directly into index.html instead of written to an assets/
 * subdirectory.
 */
export function readWebComponentAssets(): WebComponentAssetContents {
  const { jsPath, cssPath } = resolveWebComponentPaths();

  return {
    scriptContent: readFileSync(jsPath, "utf8"),
    styleContent: readFileSync(cssPath, "utf8"),
  };
}

/**
 * Removes the files copyWebComponentAssets() writes, then the assets/
 * directory itself if that leaves it empty. Used by --single-file so a
 * previous default generate (or --force into the same folder) does not
 * leave a leftover assets/ tree next to the inlined index.html. Extra
 * files in assets/ are left alone — --force overwrites what this command
 * wrote, it does not wipe user-owned files.
 */
export function removeCopiedWebComponentAssets(outputDir: string): void {
  const assetsDir = path.join(outputDir, ASSETS_DIR_NAME);
  if (!existsSync(assetsDir) || !statSync(assetsDir).isDirectory()) {
    return;
  }

  for (const name of [JS_ASSET_NAME, CSS_ASSET_NAME]) {
    const filePath = path.join(assetsDir, name);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  if (readdirSync(assetsDir).length === 0) {
    rmdirSync(assetsDir);
  }
}
