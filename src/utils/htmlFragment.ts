import { readFileSync } from "node:fs";
import { isRemoteUrl, fetchRemoteFile, RemoteFetchError } from "./remote.js";

export class HtmlFragmentError extends Error {}

export async function readHtmlFragmentFile(
  filePath: string,
  label: "header" | "footer",
): Promise<string> {
  if (isRemoteUrl(filePath)) {
    try {
      return await fetchRemoteFile(filePath);
    } catch (error) {
      if (error instanceof RemoteFetchError) {
        throw new HtmlFragmentError(error.message);
      }
      throw error;
    }
  }

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
