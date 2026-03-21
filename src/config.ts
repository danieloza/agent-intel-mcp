import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_API_BASE: z.string().default("https://api.github.com"),
  MAX_REPOS_PER_SCAN: z.coerce.number().int().positive().default(20),
  MIN_RELEVANCE_SCORE: z.coerce.number().min(0).max(1).default(0.35),
  CLUSTER_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.82),
  LOCAL_REPO_PATH: z.string().default(process.cwd()),
  AGENT_INTEL_DATA_DIR: z.string().default(path.join(process.cwd(), ".agent-intel")),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.parse(process.env);

export const config = {
  openAiApiKey: parsed.OPENAI_API_KEY,
  openAiModel: parsed.OPENAI_MODEL,
  openAiEmbeddingModel: parsed.OPENAI_EMBEDDING_MODEL,
  githubToken: parsed.GITHUB_TOKEN,
  githubApiBase: parsed.GITHUB_API_BASE,
  maxReposPerScan: parsed.MAX_REPOS_PER_SCAN,
  minRelevanceScore: parsed.MIN_RELEVANCE_SCORE,
  clusterSimilarityThreshold: parsed.CLUSTER_SIMILARITY_THRESHOLD,
  localRepoPath: path.resolve(parsed.LOCAL_REPO_PATH),
  dataDir: parsed.AGENT_INTEL_DATA_DIR.startsWith("~")
    ? path.join(os.homedir(), parsed.AGENT_INTEL_DATA_DIR.slice(1))
    : path.resolve(parsed.AGENT_INTEL_DATA_DIR),
  logLevel: parsed.LOG_LEVEL,
};
