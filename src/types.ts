export type PatternCategory =
  | "workflow"
  | "tooling"
  | "architecture"
  | "testing"
  | "documentation"
  | "ops";

export interface RepoSignal {
  stars: number;
  forks: number;
  updatedAt: string;
  topics: string[];
  watchers: number;
}

export interface RankedRepo {
  fullName: string;
  description: string;
  htmlUrl: string;
  language: string | null;
  score: number;
  readme?: string;
  signals: RepoSignal;
}

export interface ExtractedPattern {
  id: string;
  sourceRepo?: string;
  sourcePath: string;
  category: PatternCategory;
  title: string;
  evidence: string;
  normalized: string;
  confidence: number;
  tags: string[];
  embedding?: number[];
}

export interface LocalConvention {
  name: string;
  detected: boolean;
  evidence: string[];
}

export interface LocalGap {
  title: string;
  severity: "low" | "medium" | "high";
  category: PatternCategory | "release";
  rationale: string;
}

export interface LocalProfile {
  rootPath: string;
  packageManager: string | null;
  languages: string[];
  frameworks: string[];
  commands: string[];
  scriptNames: string[];
  notableFiles: string[];
  agentGuidePath: string | null;
  agentGuideContent: string | null;
  fileSample: string[];
  configFiles: string[];
  ciWorkflows: string[];
  conventions: LocalConvention[];
  gaps: LocalGap[];
}

export interface PatternCluster {
  id: string;
  label: string;
  category: PatternCategory;
  patternIds: string[];
  sourceRepos: string[];
  keywords: string[];
  size: number;
}

export type SuggestionScope = "micro" | "meso" | "macro";

export interface Suggestion {
  id: string;
  title: string;
  scope: SuggestionScope;
  rationale: string;
  changeSummary: string;
  patchSnippet: string;
  sources: string[];
  confidence: number;
}

export interface ScanOptions {
  queries: string[];
  maxRepos: number;
  includeReadme: boolean;
}

export interface GenerateSuggestionsInput {
  rankedRepos: RankedRepo[];
  externalPatterns: ExtractedPattern[];
  clusters: PatternCluster[];
  localProfile: LocalProfile;
}

export interface ScanSnapshot {
  scannedAt: string;
  queries: string[];
  repos: RankedRepo[];
}

export interface SuggestionSnapshot {
  generatedAt: string;
  suggestions: Suggestion[];
}

export interface DashboardHistoryPoint {
  recordedAt: string;
  repoCount: number;
  patternCount: number;
  clusterCount: number;
  suggestionCount: number;
  gapCount: number;
}
