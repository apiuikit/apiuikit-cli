import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const spawn = vi.fn();
const unref = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawn(...args),
}));

const { openInBrowser } = await import("./open-browser.js");

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

describe("openInBrowser", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    spawn.mockReset();
    unref.mockReset();
    spawn.mockReturnValue({ unref });
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it("uses 'open' on macOS", () => {
    setPlatform("darwin");
    openInBrowser("http://localhost:4300/");
    expect(spawn).toHaveBeenCalledWith("open", ["http://localhost:4300/"], { stdio: "ignore", detached: true });
  });

  it("uses 'cmd /c start' on Windows", () => {
    setPlatform("win32");
    openInBrowser("http://localhost:4300/");
    expect(spawn).toHaveBeenCalledWith(
      "cmd",
      ["/c", "start", "", "http://localhost:4300/"],
      { stdio: "ignore", detached: true },
    );
  });

  it("uses 'xdg-open' on Linux and other platforms", () => {
    setPlatform("linux");
    openInBrowser("http://localhost:4300/");
    expect(spawn).toHaveBeenCalledWith("xdg-open", ["http://localhost:4300/"], { stdio: "ignore", detached: true });
  });

  it("detaches and unrefs the spawned process so it doesn't keep the CLI alive", () => {
    setPlatform("linux");
    openInBrowser("http://localhost:4300/");
    expect(unref).toHaveBeenCalledTimes(1);
  });

  it("swallows a spawn failure instead of throwing", () => {
    setPlatform("linux");
    spawn.mockImplementation(() => {
      throw new Error("xdg-open not found");
    });
    expect(() => openInBrowser("http://localhost:4300/")).not.toThrow();
  });
});
