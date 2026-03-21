import path from "node:path";
import { PatternClusterer } from "./patterns/clusterer.js";
import { PatternExtractor } from "./patterns/extractor.js";
import { LocalRepoProfiler } from "./local/local-repo-profiler.js";
import { GithubScanner } from "./github/scanner.js";
import { OpenAiSuggestionEngine } from "./suggestions/openai-suggestion-engine.js";
import { buildAgentsPatch } from "./suggestions/patch-builder.js";
import { SqliteStore } from "../storage/database.js";
import { config } from "../config.js";
import type { DashboardHistoryPoint, ExtractedPattern, PatternCluster, ScanSnapshot, Suggestion, SuggestionSnapshot } from "../types.js";

export class AgentIntelService {
  private readonly scanner = new GithubScanner();
  private readonly extractor = new PatternExtractor();
  private readonly clusterer = new PatternClusterer();
  private readonly profiler = new LocalRepoProfiler();
  private readonly suggestionEngine = new OpenAiSuggestionEngine();
  private readonly store = new SqliteStore();

  async scanGithub(queries: string[], maxRepos = config.maxReposPerScan, includeReadme = true): Promise<ScanSnapshot> {
    const repos = await this.scanner.scan({
      queries,
      maxRepos,
      includeReadme,
    });
    const snapshot = {
      scannedAt: new Date().toISOString(),
      queries,
      repos,
    };
    this.store.saveScanSnapshot(snapshot);
    return snapshot;
  }

  extractPatternsFromLatestScan(): ExtractedPattern[] {
    const repos = this.store.getRankedReposFromLatestScan();
    const patterns = repos.flatMap((repo) => this.extractor.extractFromRepo(repo));
    this.store.savePatterns(patterns);
    return patterns;
  }

  async clusterPatterns(): Promise<PatternCluster[]> {
    const patterns = this.store.getPatterns(200);
    const clusters = await this.clusterer.cluster(patterns);
    this.store.saveClusters(clusters);
    return clusters;
  }

  analyzeLocalRepo(localPath = config.localRepoPath) {
    return this.profiler.profile(localPath);
  }

  async generateSuggestions(localPath = config.localRepoPath): Promise<SuggestionSnapshot> {
    const rankedRepos = this.store.getRankedReposFromLatestScan();
    const externalPatterns = this.store.getPatterns(120);
    const existingClusters = this.store.getClusters(40);
    const clusters = existingClusters.length === 0 && externalPatterns.length > 0 ? await this.clusterPatterns() : existingClusters;
    const localProfile = this.profiler.profile(localPath);
    const suggestions = await this.suggestionEngine.generate({
      rankedRepos,
      externalPatterns,
      clusters,
      localProfile,
    });

    const snapshot = {
      generatedAt: new Date().toISOString(),
      suggestions,
    };
    this.store.saveSuggestionSnapshot(snapshot);
    return snapshot;
  }

  generateAgentsPatch(localPath = config.localRepoPath, suggestions?: Suggestion[]): string {
    const localProfile = this.profiler.profile(localPath);
    const snapshotSuggestions = suggestions ?? this.store.getLatestSuggestionSnapshot()?.suggestions ?? [];
    return buildAgentsPatch(localProfile.agentGuideContent, snapshotSuggestions);
  }

  saveDashboardHistory(point: DashboardHistoryPoint): void {
    this.store.saveDashboardRun(point);
  }

  getResourceState() {
    return {
      latestScan: this.store.getLatestScanSnapshot(),
      patterns: this.store.getPatterns(50),
      clusters: this.store.getClusters(25),
      history: this.store.getDashboardHistory(24),
      localProfile: this.profiler.profile(config.localRepoPath),
      suggestions: this.store.getLatestSuggestionSnapshot(),
      agentsPatch: this.generateAgentsPatch(config.localRepoPath),
    };
  }

  extractPatternsFromText(sourcePath: string, content: string): ExtractedPattern[] {
    const patterns = this.extractor.extractFromFile(sourcePath, content);
    this.store.savePatterns(patterns);
    return patterns;
  }

  resolveAgentGuidePath(localPath = config.localRepoPath): string {
    const profile = this.profiler.profile(localPath);
    return profile.agentGuidePath ?? path.join(localPath, "AGENTS.md");
  }
}
