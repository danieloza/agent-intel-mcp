import OpenAI from "openai";
import { z } from "zod";
import { config } from "../../config.js";
import type { ExtractedPattern, GenerateSuggestionsInput, Suggestion } from "../../types.js";
import { slugify, truncate } from "../../utils/text.js";

const suggestionSchema = z.array(
  z.object({
    title: z.string(),
    scope: z.enum(["micro", "meso", "macro"]),
    rationale: z.string(),
    changeSummary: z.string(),
    patchSnippet: z.string(),
    sources: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
);

function heuristicSuggestions(input: GenerateSuggestionsInput): Suggestion[] {
  const externalPatterns = input.externalPatterns.slice(0, 8);
  const topCluster = input.clusters[0];
  const suggestions: Suggestion[] = [];

  const hasGuide = Boolean(input.localProfile.agentGuidePath);
  if (!hasGuide) {
    suggestions.push({
      id: "bootstrap-agents-md",
      title: "Bootstrap AGENTS.md operating contract",
      scope: "micro",
      rationale: "The local repository has no agent contract, which prevents durable instruction reuse.",
      changeSummary: "Create AGENTS.md with repository mission, boundaries, validation commands, and coding rules.",
      patchSnippet: "## Mission\nDescribe what the repo does and how agents should validate changes.",
      sources: externalPatterns.slice(0, 2).map((pattern) => pattern.sourceRepo ?? pattern.sourcePath),
      confidence: 0.78,
    });
  }

  const testingPattern = externalPatterns.find((pattern) => pattern.category === "testing");
  if (testingPattern && !input.localProfile.frameworks.includes("vitest")) {
    suggestions.push({
      id: "testing-guardrails",
      title: "Add explicit validation workflow to AGENTS.md",
      scope: "micro",
      rationale: "Scanned repositories repeatedly encode test and lint commands directly in agent instructions.",
      changeSummary: "Document the exact pre-merge validation sequence and failure-handling policy.",
      patchSnippet: "## Validation\nRun npm run lint, npm run typecheck, and npm test before proposing changes.",
      sources: [testingPattern.sourceRepo ?? testingPattern.sourcePath],
      confidence: 0.66,
    });
  }

  const workflowPattern = externalPatterns.find((pattern) => pattern.category === "workflow");
  if (workflowPattern) {
    suggestions.push({
      id: "pattern-harvest-loop",
      title: "Introduce a recurring intelligence review loop",
      scope: "meso",
      rationale: "High-signal agent repositories treat external pattern collection as a repeatable workflow, not a one-off exercise.",
      changeSummary: "Add a weekly scan process that ranks repos, stores extracted patterns, and proposes agent-guide updates for review.",
      patchSnippet: "Schedule: weekly GitHub scan -> pattern extraction -> human review -> AGENTS.md update.",
      sources: [workflowPattern.sourceRepo ?? workflowPattern.sourcePath],
      confidence: 0.7,
    });
  }

  const highestGap = input.localProfile.gaps[0];
  if (highestGap) {
    suggestions.push({
      id: slugify(highestGap.title),
      title: `Close gap: ${highestGap.title}`,
      scope: highestGap.severity === "high" ? "meso" : "micro",
      rationale: highestGap.rationale,
      changeSummary: `Add or update repo conventions so this gap is closed and becomes part of the agent operating contract.`,
      patchSnippet:
        highestGap.category === "ops"
          ? "## Delivery Guardrails\nAll PRs must pass CI before merge and release workflows must run from immutable tags."
          : "## Quality Guardrails\nDocument the missing convention and the exact command or file that enforces it.",
      sources: [topCluster?.label ?? "local://profile"],
      confidence: 0.74,
    });
  }

  if (topCluster && !input.localProfile.agentGuideContent?.includes("Intelligence Review")) {
    suggestions.push({
      id: "cluster-driven-review",
      title: "Document the dominant external pattern cluster",
      scope: "micro",
      rationale: `The strongest external pattern cluster is "${topCluster.label}", but the local AGENTS.md does not yet codify how to evaluate or adopt it.`,
      changeSummary: "Add a short Intelligence Review section linking source selection, clustering, and human approval.",
      patchSnippet: `## Intelligence Review\nPromote only patterns from the "${topCluster.label}" cluster after verifying they fit the local stack and validation workflow.`,
      sources: topCluster.sourceRepos,
      confidence: 0.68,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "baseline-intel-loop",
      title: "Add baseline intelligence review section",
      scope: "micro",
      rationale: "The repository already has AGENTS.md, but it does not yet encode how external patterns should be reviewed and adopted.",
      changeSummary: "Add a short section describing scan cadence, source vetting, and the rule that AGENTS.md changes must be backed by concrete repository evidence.",
      patchSnippet: "## Intelligence Review\nCollect patterns weekly, record source repos, and only promote rules that improve validation or delivery quality.",
      sources: externalPatterns.length > 0 ? externalPatterns.map((pattern) => pattern.sourceRepo ?? pattern.sourcePath) : ["local://profile"],
      confidence: 0.62,
    });
  }

  return suggestions.slice(0, 5);
}

export class OpenAiSuggestionEngine {
  private readonly client = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : null;

  async generate(input: GenerateSuggestionsInput): Promise<Suggestion[]> {
    if (!this.client) {
      return heuristicSuggestions(input);
    }

    const prompt = this.buildPrompt(input);
    const response = await this.client.responses.create({
      model: config.openAiModel,
      input: prompt,
    });

    const rawText = response.output_text ?? "[]";
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return heuristicSuggestions(input);
    }

    const validated = suggestionSchema.safeParse(parsed);
    if (!validated.success) {
      return heuristicSuggestions(input);
    }

    return validated.data.map((item) => ({
      ...item,
      id: slugify(item.title),
    }));
  }

  private buildPrompt(input: GenerateSuggestionsInput): string {
    const patternLines = input.externalPatterns
      .slice(0, 20)
      .map((pattern: ExtractedPattern) => `- [${pattern.category}] ${pattern.evidence} (${pattern.sourceRepo ?? pattern.sourcePath})`)
      .join("\n");

    return truncate(`
You are building an AGENTS.md improvement backlog for a local repository.

Return JSON only. The JSON must be an array of 2 to 5 objects with keys:
title, scope, rationale, changeSummary, patchSnippet, sources, confidence.

Prioritize:
1. Safe AGENTS.md improvements
2. Reusable workflow/system patterns
3. Portfolio-worthy architecture suggestions

Local profile:
${JSON.stringify(input.localProfile, null, 2)}

Pattern clusters:
${JSON.stringify(input.clusters.slice(0, 10), null, 2)}

External patterns:
${patternLines}
    `);
  }
}
