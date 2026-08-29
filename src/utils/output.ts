import pc from "picocolors";

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function visibleLength(str: string): number {
  return str.replace(ANSI_PATTERN, "").length;
}

export function banner(tagline?: string): string {
  const title = pc.bold(pc.cyan("apiuikit"));
  return tagline ? `${title}\n${pc.dim(tagline)}` : title;
}

export function examples(lines: string[]): string {
  const rendered = lines.map((line) => `  ${pc.dim("$")} ${pc.cyan(line)}`).join("\n");
  return `\n${pc.bold("Examples:")}\n${rendered}`;
}

export function success(message: string): void {
  console.log(`${pc.green("✔")} ${message}`);
}

export function warn(message: string): void {
  console.warn(`${pc.yellow("⚠")} ${message}`);
}

export function error(message: string): void {
  console.error(`${pc.red("✖ Error:")} ${message}`);
}

type KeyValuePair = [string, string];

function keyValueLines(pairs: KeyValuePair[]): string[] {
  const width = Math.max(...pairs.map(([label]) => label.length));
  return pairs.map(([label, value]) => `${pc.dim(label.padEnd(width))}  ${value}`);
}

export function box(title: string, pairs: KeyValuePair[] = []): void {
  const lines = [title, ...(pairs.length ? ["", ...keyValueLines(pairs)] : [])];
  const width = Math.max(...lines.map(visibleLength));
  const border = "─".repeat(width + 2);

  console.log(pc.dim(`╭${border}╮`));
  for (const line of lines) {
    const pad = " ".repeat(width - visibleLength(line));
    console.log(`${pc.dim("│")} ${line}${pad} ${pc.dim("│")}`);
  }
  console.log(pc.dim(`╰${border}╯`));
}
