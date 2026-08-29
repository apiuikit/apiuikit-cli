import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const spawnSync = vi.fn();

vi.mock("node:child_process", () => ({
  spawnSync: (...args: unknown[]) => spawnSync(...args),
}));

const { loadOptionalPackage, OptionalPackageError } = await import("./optionalPackage.js");

const FAKE_SPEC = { name: "@fake/parser", versionRange: "^1.0.0", reason: "validate fake documents" };

function writeFakePackage(cwd: string): void {
  const pkgDir = path.join(cwd, "node_modules", "@fake", "parser");
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify({ name: "@fake/parser", main: "index.js" }));
  writeFileSync(path.join(pkgDir, "index.js"), "export const marker = true;\n");
}

describe("loadOptionalPackage", () => {
  let cwd: string;
  let originalIsTTY: boolean | undefined;
  let originalStdoutIsTTY: boolean | undefined;
  let originalCI: string | undefined;

  beforeEach(() => {
    cwd = mkdtempSync(path.join(tmpdir(), "apiuikit-optpkg-"));
    spawnSync.mockReset();
    originalIsTTY = process.stdin.isTTY;
    originalStdoutIsTTY = process.stdout.isTTY;
    originalCI = process.env.CI;
    process.env.CI = "true"; // force the non-interactive path unless a test overrides it
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
    process.stdin.isTTY = originalIsTTY as boolean;
    process.stdout.isTTY = originalStdoutIsTTY as boolean;
    if (originalCI === undefined) delete process.env.CI;
    else process.env.CI = originalCI;
  });

  it("resolves an already-installed package without installing", async () => {
    writeFakePackage(cwd);

    const mod = await loadOptionalPackage<{ marker: boolean }>(FAKE_SPEC, { assumeYes: false, cwd });

    expect(mod.marker).toBe(true);
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("throws with manual install instructions when missing, non-interactive, and --yes not passed", async () => {
    await expect(loadOptionalPackage(FAKE_SPEC, { assumeYes: false, cwd })).rejects.toThrow(OptionalPackageError);
    await expect(loadOptionalPackage(FAKE_SPEC, { assumeYes: false, cwd })).rejects.toThrow(
      /npm install --save-dev @fake\/parser@\^1\.0\.0/,
    );
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("installs the package via npm when --yes is passed and no lockfile is present", async () => {
    spawnSync.mockImplementation(() => {
      writeFakePackage(cwd);
      return { status: 0 };
    });

    const mod = await loadOptionalPackage<{ marker: boolean }>(FAKE_SPEC, { assumeYes: true, cwd });

    expect(mod.marker).toBe(true);
    expect(spawnSync).toHaveBeenCalledTimes(1);
    const [command, args] = spawnSync.mock.calls[0] as [string, string[]];
    expect(command).toBe("npm");
    expect(args).toEqual(["install", "--save-dev", "@fake/parser@^1.0.0"]);
  });

  it("uses pnpm when a pnpm-lock.yaml is present in cwd", async () => {
    writeFileSync(path.join(cwd, "pnpm-lock.yaml"), "");
    spawnSync.mockImplementation(() => {
      writeFakePackage(cwd);
      return { status: 0 };
    });

    await loadOptionalPackage(FAKE_SPEC, { assumeYes: true, cwd });

    const [command, args] = spawnSync.mock.calls[0] as [string, string[]];
    expect(command).toBe("pnpm");
    expect(args).toEqual(["add", "--save-dev", "@fake/parser@^1.0.0"]);
  });

  it("throws when the install command fails", async () => {
    spawnSync.mockReturnValue({ status: 1 });

    await expect(loadOptionalPackage(FAKE_SPEC, { assumeYes: true, cwd })).rejects.toThrow(/Failed to install/);
  });

  it("throws when the package still can't be resolved after a successful install", async () => {
    spawnSync.mockReturnValue({ status: 0 }); // "succeeds" but never actually writes the package

    await expect(loadOptionalPackage(FAKE_SPEC, { assumeYes: true, cwd })).rejects.toThrow(
      /still could not load it/,
    );
  });
});
