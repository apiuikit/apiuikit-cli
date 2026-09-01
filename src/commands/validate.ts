import pc from "picocolors";
import type { Command } from "commander";
import { readSpecFile, detectSpecType, type SpecType } from "../utils/spec.js";
import { resolveLocation } from "../utils/remote.js";
import { validateOpenApiDocument, validateAsyncApiDocument, type ValidationResult } from "../validate/parsers.js";
import { success, error as printError, examples } from "../utils/output.js";

const TYPE_LABEL: Record<SpecType, string> = {
  openapi: "OpenAPI",
  asyncapi: "AsyncAPI",
};

interface ValidateOptions {
  yes: boolean;
}

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate a local or remote OpenAPI or AsyncAPI spec")
    .argument("<input>", "path or URL to a .yaml, .yml, or .json OpenAPI/AsyncAPI spec")
    .option("-y, --yes", "install the required validator package automatically without prompting", false)
    .addHelpText(
      "after",
      () =>
        examples([
          "apiuikit validate ./openapi.yaml",
          "apiuikit validate ./asyncapi.json",
          "apiuikit validate https://example.com/openapi.yaml",
          "apiuikit validate ./spec.yaml --yes",
        ]),
    )
    .action(async (input: string, options: ValidateOptions) => {
      await runValidate(input, options).catch((error: unknown) => {
        printError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
    });
}

async function runValidate(input: string, options: ValidateOptions): Promise<void> {
  const inputPath = resolveLocation(input);
  const { raw, parsed } = await readSpecFile(inputPath);
  const type = detectSpecType(parsed);

  const result =
    type === "asyncapi"
      ? await validateAsyncApiDocument(raw, { assumeYes: options.yes })
      : await validateOpenApiDocument(parsed, { assumeYes: options.yes });

  printValidationResult(input, type, result);

  if (!result.valid) {
    process.exitCode = 1;
  }
}

function printValidationResult(inputLabel: string, type: SpecType, result: ValidationResult): void {
  const errors = result.issues.filter((issue) => issue.severity === "error");
  const warnings = result.issues.filter((issue) => issue.severity === "warning");

  if (result.valid) {
    success(`${TYPE_LABEL[type]} spec is valid: ${inputLabel}`);
  } else {
    printError(`${TYPE_LABEL[type]} spec is invalid: ${inputLabel}`);
  }

  for (const issue of errors) {
    console.log(`  ${pc.red("✖")} ${issue.path ? `${pc.dim(issue.path)} ` : ""}${issue.message}`);
  }
  for (const issue of warnings) {
    console.log(`  ${pc.yellow("⚠")} ${issue.path ? `${pc.dim(issue.path)} ` : ""}${issue.message}`);
  }

  if (errors.length || warnings.length) {
    console.log();
    console.log(pc.dim(`${errors.length} error(s), ${warnings.length} warning(s)`));
  }
}
