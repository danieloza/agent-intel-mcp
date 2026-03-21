import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalRepoProfiler } from "../src/core/local/local-repo-profiler.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("LocalRepoProfiler", () => {
  it("detects conventions and gaps from repository files", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-intel-"));
    tempDirs.push(tempDir);

    fs.mkdirSync(path.join(tempDir, ".github", "workflows"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          scripts: {
            build: "tsc -p tsconfig.json",
            lint: "eslint .",
          },
          devDependencies: {
            eslint: "^1.0.0",
          },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(tempDir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }, null, 2));
    fs.writeFileSync(path.join(tempDir, ".github", "workflows", "ci.yml"), "name: ci");

    const profile = new LocalRepoProfiler().profile(tempDir);

    expect(profile.conventions.some((convention) => convention.name === "CI workflow" && convention.detected)).toBe(true);
    expect(profile.gaps.some((gap) => gap.title === "Missing AGENTS.md contract")).toBe(true);
    expect(profile.scriptNames).toContain("build");
  });
});
