import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import type { Command } from "commander";
import { readSpecFile, detectSpecType, getSpecTitle, type SpecType } from "../utils/spec.js";
import { readConfigFile } from "../utils/config.js";
import { readHtmlFragmentFile } from "../utils/htmlFragment.js";
import { resolveLocation } from "../utils/remote.js";
import { copyWebComponentAssets } from "../generate/assets.js";
import { buildHtml } from "../generate/site.js";
import { box, error as printError, examples } from "../utils/output.js";

const TYPE_LABEL: Record<SpecType, string> = {
  openapi: "OpenAPI",
  asyncapi: "AsyncAPI",
};

interface GenerateOptions {
  output: string;
  config?: string;
  header?: string;
  footer?: string;
  force: boolean;
}

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .alias("gen")
    .description("Generate a static API documentation site from a local or remote OpenAPI or AsyncAPI spec")
    .argument("<input>", "path or URL to a .yaml, .yml, or .json OpenAPI/AsyncAPI spec")
    .option("-o, --output <dir>", "output directory for the generated site", "apiuikit-docs")
    .option("-c, --config <file>", "path or URL to a JSON or YAML config file passed through to apiuikit (theme, sidebar, show/hide sections, etc.)")
    .option("--header <file>", "path or URL to an HTML file injected at the top of the page, before the documentation")
    .option("--footer <file>", "path or URL to an HTML file injected at the bottom of the page, after the documentation")
    .option("-f, --force", "overwrite the output directory if it already contains files", false)
    .addHelpText(
      "after",
      () =>
        examples([
          "apiuikit generate ./openapi.yaml",
          "apiuikit generate ./asyncapi.json --output ./site",
          "apiuikit generate https://example.com/openapi.yaml",
          "apiuikit generate ./spec.yaml --config ./apiuikit.config.json",
          "apiuikit generate ./spec.yaml --header ./header.html --footer ./footer.html",
          "apiuikit generate ./spec.yaml --output ./docs --force",
        ]),
    )
    .action(async (input: string, options: GenerateOptions) => {
      try {
        await runGenerate(input, options);
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}

async function runGenerate(input: string, options: GenerateOptions): Promise<void> {
  const inputPath = resolveLocation(input);
  const outputDir = path.resolve(process.cwd(), options.output);

  const { raw, parsed } = await readSpecFile(inputPath);
  const type = detectSpecType(parsed);
  const title = getSpecTitle(parsed);
  const config = options.config ? await readConfigFile(resolveLocation(options.config)) : undefined;
  const headerHtml = options.header
    ? await readHtmlFragmentFile(resolveLocation(options.header), "header")
    : undefined;
  const footerHtml = options.footer
    ? await readHtmlFragmentFile(resolveLocation(options.footer), "footer")
    : undefined;

  ensureOutputDir(outputDir, options.force);

  const { scriptHref, styleHref } = copyWebComponentAssets(outputDir);
  const html = buildHtml({ type, title, specText: raw, config, scriptHref, styleHref, headerHtml, footerHtml });

  writeFileSync(path.join(outputDir, "index.html"), html, "utf8");

  const indexPath = path.join(outputDir, "index.html");
  box(`${pc.green("✔")} Generated API documentation site`, [
    ["Spec type", TYPE_LABEL[type]],
    ["Title", title],
    ["Output", path.relative(process.cwd(), outputDir) || "."],
    ...(config && options.config ? ([["Config", options.config]] as [string, string][]) : []),
    ...(headerHtml && options.header ? ([["Header", options.header]] as [string, string][]) : []),
    ...(footerHtml && options.footer ? ([["Footer", options.footer]] as [string, string][]) : []),
  ]);
  console.log();
  console.log(`Open it in a browser:`);
  console.log(`  ${pc.cyan(`file://${indexPath}`)}`);
}

function ensureOutputDir(outputDir: string, force: boolean): void {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    return;
  }

  if (!statSync(outputDir).isDirectory()) {
    throw new Error(`${outputDir} exists and is not a directory.`);
  }

  const isEmpty = readdirSync(outputDir).length === 0;
  if (!isEmpty && !force) {
    throw new Error(
      `Output directory is not empty: ${outputDir}\nPass --force to overwrite its contents, or choose a different --output directory.`,
    );
  }
}
