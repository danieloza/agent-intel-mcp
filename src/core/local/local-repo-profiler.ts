import fs from "node:fs";
import path from "node:path";
import type { LocalConvention, LocalGap, LocalProfile } from "../../types.js";
import { dedupe } from "../../utils/text.js";

const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".agent-intel",
]);

const knownFrameworks = [
  "next",
  "react",
  "vue",
  "svelte",
  "fastify",
  "express",
  "nestjs",
  "openai",
  "vitest",
  "playwright",
  "eslint",
];

type PackageJsonShape = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  packageManager?: string;
};

function safeRead(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function walkFiles(rootPath: string, limit = 250): string[] {
  const files: string[] = [];
  const queue = [rootPath];

  while (queue.length > 0 && files.length < limit) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= limit) {
        break;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }

      files.push(fullPath);
    }
  }

  return files;
}

function detectConvention(name: string, predicate: boolean, evidence: string[]): LocalConvention {
  return {
    name,
    detected: predicate,
    evidence,
  };
}

function detectGaps(args: {
  rootPath: string;
  scriptNames: string[];
  configFiles: string[];
  ciWorkflows: string[];
  notableFiles: string[];
  hasAgentGuide: boolean;
  tsconfigRaw: string | null;
}): LocalGap[] {
  const gaps: LocalGap[] = [];

  if (!args.hasAgentGuide) {
    gaps.push({
      title: "Missing AGENTS.md contract",
      severity: "high",
      category: "documentation",
      rationale: "The repository has no durable agent operating contract.",
    });
  }

  if (!args.scriptNames.includes("lint") || !args.scriptNames.includes("test")) {
    gaps.push({
      title: "Incomplete validation scripts",
      severity: "medium",
      category: "testing",
      rationale: "A portable validation workflow usually needs explicit lint and test scripts.",
    });
  }

  if (args.ciWorkflows.length === 0) {
    gaps.push({
      title: "Missing CI workflow",
      severity: "high",
      category: "ops",
      rationale: "The repository has no GitHub Actions workflow to enforce build and test on pull requests.",
    });
  }

  if (!args.notableFiles.includes(".env.example")) {
    gaps.push({
      title: "Missing env template",
      severity: "low",
      category: "documentation",
      rationale: "Configuration-heavy repositories benefit from a checked-in environment template.",
    });
  }

  if (!args.configFiles.some((file) => /release|changeset|semantic-release|release-please/i.test(file))) {
    gaps.push({
      title: "Release automation not configured",
      severity: "medium",
      category: "release",
      rationale: "There is no obvious release automation metadata or workflow in the repository.",
    });
  }

  if (args.tsconfigRaw && !/"strict"\s*:\s*true/.test(args.tsconfigRaw)) {
    gaps.push({
      title: "TypeScript strict mode disabled",
      severity: "medium",
      category: "tooling",
      rationale: "Strict mode is a strong baseline for an MCP server intended for portfolio review.",
    });
  }

  return gaps;
}

export class LocalRepoProfiler {
  profile(rootPath: string): LocalProfile {
    const pkgPath = path.join(rootPath, "package.json");
    const tsconfigPath = path.join(rootPath, "tsconfig.json");
    const agentGuidePath = ["AGENTS.md", "agents.md", "CLAUDE.md"]
      .map((name) => path.join(rootPath, name))
      .find(fileExists);

    const pkgRaw = safeRead(pkgPath);
    const tsconfigRaw = safeRead(tsconfigPath);
    const pkg = pkgRaw ? (JSON.parse(pkgRaw) as PackageJsonShape) : null;
    const deps = Object.keys({
      ...(pkg?.dependencies ?? {}),
      ...(pkg?.devDependencies ?? {}),
    });

    const allFiles = walkFiles(rootPath);
    const relativeFiles = allFiles.map((filePath) => path.relative(rootPath, filePath));
    const packageManager =
      pkg?.packageManager?.split("@")[0] ??
      (fileExists(path.join(rootPath, "pnpm-lock.yaml")) ? "pnpm" : fileExists(path.join(rootPath, "package-lock.json")) ? "npm" : null);
    const frameworks = knownFrameworks.filter((framework) => deps.includes(framework));
    const scripts = pkg?.scripts ?? {};
    const scriptNames = Object.keys(scripts);
    const commands = dedupe(Object.values(scripts));
    const ciWorkflows = relativeFiles.filter((filePath) => filePath.startsWith(".github\\workflows\\") || filePath.startsWith(".github/workflows/"));
    const configFiles = relativeFiles.filter((filePath) =>
      /(package\.json|tsconfig\.json|eslint|prettier|vitest|playwright|docker-compose|release|changeset|semantic)/i.test(filePath),
    );
    const notableFiles = dedupe(
      relativeFiles.filter((filePath) =>
        /(^README\.md$|^AGENTS\.md$|^CLAUDE\.md$|^\.env\.example$|^docker-compose\.yml$|^tsconfig\.json$|^package\.json$|^\.github[\\/]+workflows)/i.test(
          filePath,
        ),
      ),
    );

    const conventions: LocalConvention[] = [
      detectConvention("Has AGENTS guide", Boolean(agentGuidePath), [agentGuidePath ?? ""]),
      detectConvention("Build script", scriptNames.includes("build"), [scripts.build ?? ""]),
      detectConvention("Typecheck script", scriptNames.includes("typecheck"), [scripts.typecheck ?? ""]),
      detectConvention("Test script", scriptNames.includes("test"), [scripts.test ?? ""]),
      detectConvention("Lint script", scriptNames.includes("lint"), [scripts.lint ?? ""]),
      detectConvention("CI workflow", ciWorkflows.length > 0, ciWorkflows),
      detectConvention("Environment template", notableFiles.includes(".env.example"), notableFiles.filter((file) => file === ".env.example")),
    ];

    const gaps = detectGaps({
      rootPath,
      scriptNames,
      configFiles,
      ciWorkflows,
      notableFiles,
      hasAgentGuide: Boolean(agentGuidePath),
      tsconfigRaw,
    });

    return {
      rootPath,
      packageManager,
      languages: dedupe([fileExists(pkgPath) ? "TypeScript/JavaScript" : "Unknown"]),
      frameworks,
      commands,
      scriptNames,
      notableFiles,
      agentGuidePath: agentGuidePath ?? null,
      agentGuideContent: agentGuidePath ? safeRead(agentGuidePath) : null,
      fileSample: relativeFiles.slice(0, 80),
      configFiles,
      ciWorkflows,
      conventions,
      gaps,
    };
  }
}
