import { readFileSync } from "node:fs";

export class HtmlFragmentError extends Error {}

export function readHtmlFragmentFile(filePath: string, label: "header" | "footer"): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new HtmlFragmentError(`No such ${label} file: ${filePath}`);
    }
    if (err.code === "EISDIR") {
      throw new HtmlFragmentError(`Expected a file but got a directory: ${filePath}`);
    }
    throw error;
  }
}
