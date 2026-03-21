#!/usr/bin/env node
import { AgentIntelService } from "../core/agent-intel-service.js";
import { config } from "../config.js";

const demoPatterns = `
- Run CI on every pull request and on main branch pushes
- Keep AGENTS.md updated with architecture and validation rules
- Cluster external patterns before adopting them locally
- Treat release automation as tag-based and immutable
- Run lint, typecheck, and tests before merge
- Prefer patch previews over direct file rewrites
`;

async function seed(): Promise<void> {
  const service = new AgentIntelService();
  service.extractPatternsFromText("docs/demo-seed.md", demoPatterns);
  await service.clusterPatterns();
  const suggestions = await service.generateSuggestions(config.localRepoPath);
  const profile = service.analyzeLocalRepo(config.localRepoPath);

  const history: Array<[number, number, number, number, number]> = [
    [4, 10, 2, 2, 4],
    [6, 12, 3, 3, 3],
    [8, 16, 4, 3, 3],
    [10, 18, 5, 4, 2],
    [12, 22, 6, 4, 1],
    [14, 24, 7, suggestions.suggestions.length, profile.gaps.length],
  ];

  history.forEach(([repoCount, patternCount, clusterCount, suggestionCount, gapCount], index) => {
    service.saveDashboardHistory({
      recordedAt: new Date(Date.now() - (history.length - index) * 86_400_000).toISOString(),
      repoCount,
      patternCount,
      clusterCount,
      suggestionCount,
      gapCount,
    });
  });
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
