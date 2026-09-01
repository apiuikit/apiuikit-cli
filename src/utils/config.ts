import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { isRemoteUrl, fetchRemoteFile, RemoteFetchError } from "./remote.js";

export type ParsedConfig = Record<string, unknown>;

const SUPPORTED_EXTENSIONS = new Set([".json", ".yaml", ".yml"]);

export class ConfigError extends Error {}

function extensionOf(configPath: string): string {
  if (isRemoteUrl(configPath)) {
    try {
      return path.extname(new URL(configPath).pathname).toLowerCase();
    } catch {
      return "";
    }
  }
  return path.extname(configPath).toLowerCase();
}

export async function readConfigFile(configPath: string): Promise<ParsedConfig> {
  const ext = extensionOf(configPath);
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new ConfigError(
      `Unsupported config file type "${ext || "(none)"}". Expected one of: ${[...SUPPORTED_EXTENSIONS].join(", ")}`,
    );
  }

  let raw: string;
  if (isRemoteUrl(configPath)) {
    try {
      raw = await fetchRemoteFile(configPath);
    } catch (error) {
      if (error instanceof RemoteFetchError) {
        throw new ConfigError(error.message);
      }
      throw error;
    }
  } else {
    try {
      raw = readFileSync(configPath, "utf8");
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        throw new ConfigError(`No such config file: ${configPath}`);
      }
      if (err.code === "EISDIR") {
        throw new ConfigError(`Expected a file but got a directory: ${configPath}`);
      }
      throw error;
    }
  }

  let parsed: unknown;
  try {
    parsed = ext === ".json" ? JSON.parse(raw) : parseYaml(raw);
  } catch (error) {
    const err = error as Error;
    throw new ConfigError(`Could not parse ${configPath} as ${ext === ".json" ? "JSON" : "YAML"}: ${err.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigError(`${configPath} does not contain a valid config object.`);
  }

  return parsed as ParsedConfig;
}
