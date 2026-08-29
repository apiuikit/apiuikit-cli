import { describe, it, expect, vi, afterEach } from "vitest";
import { banner, examples, success, warn, error, box } from "./output.js";

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const strip = (s: string) => s.replace(ANSI_PATTERN, "");

describe("banner", () => {
  it("renders just the title when no tagline is given", () => {
    expect(strip(banner())).toBe("apiuikit");
  });

  it("renders the tagline on a second line when given", () => {
    expect(strip(banner("does things"))).toBe("apiuikit\ndoes things");
  });
});

describe("examples", () => {
  it("renders each line prefixed with a $ under an Examples heading", () => {
    const rendered = strip(examples(["apiuikit generate ./spec.yaml", "apiuikit serve"]));
    expect(rendered).toBe(
      "\nExamples:\n  $ apiuikit generate ./spec.yaml\n  $ apiuikit serve",
    );
  });
});

describe("console helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("success logs to stdout with a checkmark", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    success("done");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(strip(spy.mock.calls[0][0] as string)).toBe("✔ done");
  });

  it("warn logs to stderr with a warning symbol", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warn("careful");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(strip(spy.mock.calls[0][0] as string)).toBe("⚠ careful");
  });

  it("error logs to stderr with an error prefix", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    error("boom");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(strip(spy.mock.calls[0][0] as string)).toBe("✖ Error: boom");
  });
});

describe("box", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a title-only box", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    box("Hello");
    const lines = spy.mock.calls.map((call) => strip(call[0] as string));
    expect(lines).toEqual(["╭───────╮", "│ Hello │", "╰───────╯"]);
  });

  it("renders key/value pairs padded to align, framed by a border sized to the widest line", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    box("Result", [
      ["Spec type", "OpenAPI"],
      ["Output", "./site"],
    ]);
    const lines = spy.mock.calls.map((call) => strip(call[0] as string));

    expect(lines).toHaveLength(6);
    expect(lines[1]).toBe("│ Result             │");
    expect(lines[2]).toBe("│                    │");
    // labels are padded to the widest label ("Spec type") before the value
    expect(lines[3]).toBe("│ Spec type  OpenAPI │");
    expect(lines[4]).toBe("│ Output     ./site  │");
    // every line (including borders) shares the same width
    const width = lines[0].length;
    expect(lines.every((line) => line.length === width)).toBe(true);
    expect(lines[0]).toBe("╭" + "─".repeat(width - 2) + "╮");
    expect(lines[lines.length - 1]).toBe("╰" + "─".repeat(width - 2) + "╯");
  });
});
