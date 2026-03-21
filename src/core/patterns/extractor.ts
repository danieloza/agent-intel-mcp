import path from "node:path";
import type { ExtractedPattern, PatternCategory, RankedRepo } from "../../types.js";
import { dedupe, slugify } from "../../utils/text.js";

const categoryMatchers: Array<{ pattern: RegExp; category: PatternCategory; tags: string[] }> = [
  { pattern: /\b(test|vitest|jest|playwright|cypress)\b/i, category: "testing", tags: ["quality"] },
  { pattern: /\b(docker|kubernetes|terraform|deploy|ci\/cd|github actions)\b/i, category: "ops", tags: ["delivery"] },
  { pattern: /\b(prompt|agent|workflow|handoff|memory|tool call)\b/i, category: "workflow", tags: ["agents"] },
  { pattern: /\b(openai|mcp|sdk|typescript|python|node)\b/i, category: "tooling", tags: ["stack"] },
  { pattern: /\b(architecture|layer|service|repository|pipeline)\b/i, category: "architecture", tags: ["design"] },
];

function classify(line: string): { category: PatternCategory; tags: string[] } {
  for (const matcher of categoryMatchers) {
    if (matcher.pattern.test(line)) {
      return { category: matcher.category, tags: matcher.tags };
    }
  }

  return { category: "documentation", tags: ["docs"] };
}

function extractBullets(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*\d.]\s+/, "").trim())
    .filter((line) => line.length >= 12);
}

export class PatternExtractor {
  extractFromRepo(repo: RankedRepo): ExtractedPattern[] {
    const sourceText = [repo.description, repo.readme ?? ""].join("\n");
    const candidates = dedupe(extractBullets(sourceText)).slice(0, 40);

    return candidates.map((candidate, index) => {
      const { category, tags } = classify(candidate);
      return {
        id: `${slugify(repo.fullName)}-${index}-${slugify(candidate).slice(0, 32)}`,
        sourceRepo: repo.fullName,
        sourcePath: `${repo.fullName}/README.md`,
        category,
        title: candidate.slice(0, 72),
        evidence: candidate,
        normalized: candidate.toLowerCase(),
        confidence: Number(Math.min(0.95, 0.5 + repo.score * 0.45).toFixed(2)),
        tags,
      };
    });
  }

  extractFromFile(filePath: string, content: string): ExtractedPattern[] {
    const candidates = dedupe(extractBullets(content));
    return candidates.map((candidate, index) => {
      const { category, tags } = classify(candidate);
      return {
        id: `${slugify(path.basename(filePath))}-${index}-${slugify(candidate).slice(0, 32)}`,
        sourcePath: filePath,
        category,
        title: candidate.slice(0, 72),
        evidence: candidate,
        normalized: candidate.toLowerCase(),
        confidence: 0.72,
        tags,
      };
    });
  }
}
