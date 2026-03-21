import type { Suggestion } from "../../types.js";

export function buildAgentsPatch(existingContent: string | null, suggestions: Suggestion[]): string {
  const header = "## Agent Intel Suggestions";
  const body = suggestions
    .map(
      (suggestion) =>
        `### ${suggestion.title}\n- Scope: ${suggestion.scope}\n- Why: ${suggestion.rationale}\n- Suggested change: ${suggestion.changeSummary}\n- Starter snippet: ${suggestion.patchSnippet}`,
    )
    .join("\n\n");

  const nextContent = existingContent?.includes(header)
    ? `${existingContent}\n\n${body}`
    : [existingContent?.trim(), header, body].filter(Boolean).join("\n\n");

  return `--- AGENTS.md\n+++ AGENTS.md\n@@\n+${nextContent.split("\n").join("\n+")}\n`;
}
