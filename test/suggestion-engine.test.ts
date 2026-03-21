import { describe, expect, it } from "vitest";
import { OpenAiSuggestionEngine } from "../src/core/suggestions/openai-suggestion-engine.js";

describe("OpenAiSuggestionEngine", () => {
  it("falls back to heuristics when no OpenAI key is configured", async () => {
    const engine = new OpenAiSuggestionEngine();
    const suggestions = await engine.generate({
      rankedRepos: [],
      externalPatterns: [
        {
          id: "a",
          sourceRepo: "foo/bar",
          sourcePath: "README.md",
          category: "workflow",
          title: "Weekly pattern review",
          evidence: "Run a weekly pattern review and update AGENTS.md",
          normalized: "run a weekly pattern review and update agents.md",
          confidence: 0.8,
          tags: ["agents"],
        },
      ],
      clusters: [
        {
          id: "workflow-review",
          label: "workflow / review",
          category: "workflow",
          patternIds: ["a"],
          sourceRepos: ["foo/bar"],
          keywords: ["weekly", "review"],
          size: 1,
        },
      ],
      localProfile: {
        rootPath: process.cwd(),
        packageManager: "npm",
        languages: ["TypeScript/JavaScript"],
        frameworks: [],
        commands: [],
        scriptNames: [],
        notableFiles: [],
        agentGuidePath: null,
        agentGuideContent: null,
        fileSample: [],
        configFiles: [],
        ciWorkflows: [],
        conventions: [],
        gaps: [],
      },
    });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.title).toMatch(/AGENTS\.md|AGENTS/i);
  });
});
