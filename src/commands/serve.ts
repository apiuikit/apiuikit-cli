import path from "node:path";
import { existsSync, statSync } from "node:fs";
import pc from "picocolors";
import type { Command } from "commander";
import { createStaticServer, listen } from "../serve/server.js";
import { openInBrowser } from "../serve/open-browser.js";
import { box, error as printError, examples, warn } from "../utils/output.js";

const DEFAULT_PORT = 4300;

interface ServeOptions {
  port: string;
  open: boolean;
}

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Serve a generated API documentation site locally for preview")
    .argument("[dir]", "directory to serve", "apiuikit-docs")
    .option("-p, --port <port>", "preferred port to listen on", String(DEFAULT_PORT))
    .option("--open", "open the site in your default browser", false)
    .addHelpText(
      "after",
      () =>
        examples([
          "apiuikit serve",
          "apiuikit serve ./site --port 5000",
          "apiuikit serve --open",
        ]),
    )
    .action((dir: string, options: ServeOptions) => {
      runServe(dir, options).catch((error: unknown) => {
        printError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
    });
}

async function runServe(dir: string, options: ServeOptions): Promise<void> {
  const rootDir = path.resolve(process.cwd(), dir);

  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    throw new Error(
      `No such directory: ${rootDir}\nRun "apiuikit generate <input>" first, or pass the directory to serve.`,
    );
  }

  if (!existsSync(path.join(rootDir, "index.html"))) {
    warn(`No index.html found in ${rootDir}`);
  }

  const preferredPort = Number.parseInt(options.port, 10);
  if (!Number.isInteger(preferredPort) || preferredPort < 0 || preferredPort > 65535) {
    throw new Error(`Invalid port: ${options.port}`);
  }

  const server = createStaticServer(rootDir);
  const { port, host } = await listen(server, preferredPort);
  const url = `http://${host}:${port}/`;

  box(`${pc.green("✔")} Serving API documentation site`, [
    ["Directory", path.relative(process.cwd(), rootDir) || "."],
    ["URL", pc.cyan(url)],
  ]);
  console.log();
  console.log(pc.dim("Press Ctrl+C to stop."));

  if (options.open) {
    openInBrowser(url);
  }

  process.on("SIGINT", () => {
    console.log();
    console.log(pc.dim("Stopping server..."));
    server.close(() => process.exit(0));
  });
}
