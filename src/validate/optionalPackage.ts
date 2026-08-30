import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";

export class OptionalPackageError extends Error {}

export interface OptionalPackageSpec {
  /** npm package name, e.g. "@asyncapi/parser" */
  name: string;
  /** semver range to install, e.g. "^3.6.0" */
  versionRange: string;
  /** human-readable purpose, e.g. "validate AsyncAPI documents" */
  reason: string;
}

export interface LoadOptions {
  /** skip the confirmation prompt and install automatically */
  assumeYes: boolean;
  /** directory to resolve/install into; defaults to process.cwd() */
  cwd?: string;
}

type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

const INSTALL_ARGS: Record<PackageManager, string[]> = {
  npm: ["install", "--save-dev"],
  yarn: ["add", "--dev"],
  pnpm: ["add", "--save-dev"],
  bun: ["add", "--dev"],
};

function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(path.join(cwd, "bun.lockb"))) return "bun";
  return "npm";
}

function resolveFromCwd(pkgName: string, cwd: string): string | undefined {
  try {
    const req = createRequire(path.join(cwd, "package.json"));
    return req.resolve(pkgName);
  } catch {
    return undefined;
  }
}

async function tryImport(pkgName: string, cwd: string): Promise<unknown | undefined> {
  try {
    return await import(pkgName);
  } catch {
    // fall through to explicit resolution below
  }

  const resolved = resolveFromCwd(pkgName, cwd);
  if (!resolved) {
    return undefined;
  }

  return await import(pathToFileURL(resolved).href);
}

function manualInstallInstructions(spec: OptionalPackageSpec): string {
  const pkg = `${spec.name}@${spec.versionRange}`;
  return [
    `${spec.name} is required to ${spec.reason}, but it isn't installed.`,
    "",
    "Install it and re-run this command:",
    `  npm install --save-dev ${pkg}`,
    `  yarn add --dev ${pkg}`,
    `  pnpm add --save-dev ${pkg}`,
    "",
    'Or re-run with "--yes" flag to install it automatically.',
  ].join("\n");
}

async function confirmInstall(spec: OptionalPackageSpec): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `${spec.name} is required to ${spec.reason}. Install ${spec.name}@${spec.versionRange} now? (Y/n) `,
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === "" || normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}

function runInstall(spec: OptionalPackageSpec, cwd: string): void {
  const pm = detectPackageManager(cwd);
  const args = [...INSTALL_ARGS[pm], `${spec.name}@${spec.versionRange}`];

  const result = spawnSync(pm, args, { cwd, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    throw new OptionalPackageError(
      `Failed to install ${spec.name} with "${pm} ${args.join(" ")}". Install it manually and re-run.`,
    );
  }
}

export async function loadOptionalPackage<T>(spec: OptionalPackageSpec, opts: LoadOptions): Promise<T> {
  const cwd = opts.cwd ?? process.cwd();

  const existing = await tryImport(spec.name, cwd);
  if (existing) {
    return existing as T;
  }

  const canPrompt = Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY) && !process.env.CI;
  if (!opts.assumeYes) {
    if (!canPrompt) {
      throw new OptionalPackageError(manualInstallInstructions(spec));
    }
    const confirmed = await confirmInstall(spec);
    if (!confirmed) {
      throw new OptionalPackageError(manualInstallInstructions(spec));
    }
  }

  runInstall(spec, cwd);

  const installed = await tryImport(spec.name, cwd);
  if (!installed) {
    throw new OptionalPackageError(
      `Installed ${spec.name}, but the CLI still could not load it. Install it manually and re-run.`,
    );
  }

  return installed as T;
}
