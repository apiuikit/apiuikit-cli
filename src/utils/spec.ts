import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export type SpecType = "openapi" | "asyncapi";

export type ParsedSpec = Record<string, unknown>;

export interface SpecFile {
  raw: string;
  parsed: ParsedSpec;
  ext: string;
}

const SUPPORTED_EXTENSIONS = new Set([".yaml", ".yml", ".json"]);

export class SpecError extends Error {}

export function assertSupportedExtension(inputPath: string): string {
  const ext = path.extname(inputPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new SpecError(
      `Unsupported file type "${ext || "(none)"}". Expected one of: ${[...SUPPORTED_EXTENSIONS].join(", ")}`,
    );
  }
  return ext;
}

export function readSpecFile(inputPath: string): SpecFile {
  const ext = assertSupportedExtension(inputPath);
  let raw: string;
  try {
    raw = readFileSync(inputPath, "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new SpecError(`No such file: ${inputPath}`);
    }
    if (err.code === "EISDIR") {
      throw new SpecError(`Expected a file but got a directory: ${inputPath}`);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = ext === ".json" ? JSON.parse(raw) : parseYaml(raw);
  } catch (error) {
    const err = error as Error;
    throw new SpecError(`Could not parse ${inputPath} as ${ext === ".json" ? "JSON" : "YAML"}: ${err.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SpecError(`${inputPath} does not contain a valid OpenAPI or AsyncAPI document.`);
  }

  return { raw, parsed: parsed as ParsedSpec, ext };
}

export function detectSpecType(parsed: ParsedSpec): SpecType {
  if (typeof parsed.asyncapi === "string") {
    return "asyncapi";
  }
  if (typeof parsed.openapi === "string" || typeof parsed.swagger === "string") {
    return "openapi";
  }
  throw new SpecError(
    "Could not detect a valid OpenAPI or AsyncAPI document — expected a top-level \"openapi\" or \"asyncapi\" field.",
  );
}

export function getSpecTitle(parsed: ParsedSpec | undefined, fallback = "API Documentation"): string {
  const info = parsed?.info as { title?: unknown } | undefined;
  const title = info?.title;
  return typeof title === "string" && title.trim() ? title.trim() : fallback;
}
