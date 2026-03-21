import { describe, expect, it } from "vitest";
import { PatternExtractor } from "../src/core/patterns/extractor.js";

describe("PatternExtractor", () => {
  it("extracts bullet patterns from repo markdown", () => {
    const extractor = new PatternExtractor();
    const patterns = extractor.extractFromRepo({
      fullName: "acme/example",
      description: "An MCP server for agent workflows",
      htmlUrl: "https://github.com/acme/example",
      language: "TypeScript",
      score: 0.82,
      readme: `
- Run Vitest before opening a PR
- Keep AGENTS.md updated with architecture decisions
- Store prompts and tools in separate layers
      `,
      signals: {
        stars: 100,
        forks: 10,
        updatedAt: new Date().toISOString(),
        topics: ["mcp"],
        watchers: 10,
      },
    });

    expect(patterns).toHaveLength(3);
    expect(patterns.some((pattern) => pattern.category === "testing")).toBe(true);
  });
});
