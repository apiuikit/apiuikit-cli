import path from "node:path";

const REMOTE_URL_PATTERN = /^https?:\/\//i;

export function isRemoteUrl(input: string): boolean {
  return REMOTE_URL_PATTERN.test(input);
}

export function resolveLocation(input: string, cwd: string = process.cwd()): string {
  return isRemoteUrl(input) ? input : path.resolve(cwd, input);
}

export class RemoteFetchError extends Error {}

export async function fetchRemoteFile(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    const err = error as Error;
    throw new RemoteFetchError(`Could not reach ${url}: ${err.message}`);
  }

  if (!response.ok) {
    throw new RemoteFetchError(`Request to ${url} failed with status ${response.status} ${response.statusText}`.trim());
  }

  return response.text();
}
