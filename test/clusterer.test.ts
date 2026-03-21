import { describe, expect, it } from "vitest";
import { PatternClusterer } from "../src/core/patterns/clusterer.js";

describe("PatternClusterer", () => {
  it("builds heuristic clusters without embeddings", async () => {
    const clusterer = new PatternClusterer();
    const clusters = await clusterer.cluster([
      {
        id: "p1",
        sourceRepo: "a/repo",
        sourcePath: "README.md",
        category: "workflow",
        title: "Weekly review loop",
        evidence: "Run a weekly review loop for agent prompts",
        normalized: "run a weekly review loop for agent prompts",
        confidence: 0.8,
        tags: ["agents"],
      },
      {
        id: "p2",
        sourceRepo: "b/repo",
        sourcePath: "README.md",
        category: "testing",
        title: "Run tests before merge",
        evidence: "Run tests before merge and release",
        normalized: "run tests before merge and release",
        confidence: 0.8,
        tags: ["quality"],
      },
    ]);

    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters.some((cluster) => cluster.category === "workflow")).toBe(true);
  });
});
