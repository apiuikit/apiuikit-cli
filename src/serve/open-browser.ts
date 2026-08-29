import { spawn } from "node:child_process";

/**
 * Best-effort browser launch via the OS's own "open a URL" command, so we
 * don't need the "open" npm package just for this one optional flag.
 */
export function openInBrowser(url: string): void {
  let command: string;
  let args: string[];

  if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  try {
    spawn(command, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // Best-effort only — no GUI, missing xdg-open, etc. Not fatal.
  }
}
