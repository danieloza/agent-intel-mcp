import { config } from "../config.js";
import { AgentIntelService } from "../core/agent-intel-service.js";
import type { DashboardHistoryPoint } from "../types.js";
import { defaultDemoQueries } from "./queries.js";

export interface DashboardRefreshOptions {
  localPath?: string;
  maxRepos?: number;
  queries?: string[];
}

export async function refreshDashboardData(service: AgentIntelService, options: DashboardRefreshOptions = {}) {
  const queries = options.queries ?? defaultDemoQueries;
  const maxRepos = options.maxRepos ?? config.maxReposPerScan;
  const localPath = options.localPath ?? config.localRepoPath;

  const scan = await service.scanGithub(queries, maxRepos, true);
  const patterns = service.extractPatternsFromLatestScan();
  const clusters = await service.clusterPatterns();
  const localProfile = service.analyzeLocalRepo(localPath);
  const suggestions = await service.generateSuggestions(localPath);
  const patch = service.generateAgentsPatch(localPath, suggestions.suggestions);
  const historyPoint: DashboardHistoryPoint = {
    recordedAt: new Date().toISOString(),
    repoCount: scan.repos.length,
    patternCount: patterns.length,
    clusterCount: clusters.length,
    suggestionCount: suggestions.suggestions.length,
    gapCount: localProfile.gaps.length,
  };
  service.saveDashboardHistory(historyPoint);

  return {
    scan,
    patterns,
    clusters,
    localProfile,
    suggestions,
    patch,
    history: [...service.getResourceState().history],
    generatedAt: new Date().toISOString(),
  };
}

export function getDashboardData(service: AgentIntelService) {
  const state = service.getResourceState();
  return {
    latestScan: state.latestScan,
    patterns: state.patterns,
    clusters: state.clusters,
    history: state.history,
    localProfile: state.localProfile,
    suggestions: state.suggestions,
    patch: state.agentsPatch,
    generatedAt: new Date().toISOString(),
  };
}
