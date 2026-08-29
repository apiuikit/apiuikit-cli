import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Command, CommanderError } from "commander";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerServeCommand } from "./commands/serve.js";
import { registerValidateCommand } from "./commands/validate.js";
import { banner, examples, error as printError } from "./utils/output.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as { version: string };

const DESCRIPTION = "Generate a static API documentation site from a local OpenAPI or AsyncAPI spec, powered by APIUIKit.";

export async function run(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("apiuikit")
    .description(DESCRIPTION)
    .version(pkg.version, "-v, --version", "print the CLI version")
    .addHelpText("beforeAll", () => `${banner(DESCRIPTION)}\n`)
    .addHelpText(
      "after",
      () =>
        `${examples([
          "apiuikit generate ./openapi.yaml",
          "apiuikit generate ./asyncapi.json --output ./site",
          "apiuikit serve",
          "apiuikit validate ./openapi.yaml",
          "npx @apiuikit/cli generate ./spec.yaml",
        ])}\n\nLearn more: https://github.com/AceTheCreator/apiuikit`,
    );

  registerGenerateCommand(program);
  registerServeCommand(program);
  registerValidateCommand(program);

  program.showHelpAfterError("(run \"apiuikit --help\" for usage)");

  program.exitOverride();

  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      // commander already printed help/usage output for this case.
      process.exit(typeof error.exitCode === "number" ? error.exitCode : 1);
    }
    printError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
