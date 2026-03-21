import { Buffer } from "node:buffer";
import { createGithubClient } from "./client.js";
import { config } from "../../config.js";
import type { RankedRepo, ScanOptions } from "../../types.js";

const topicWeights: Record<string, number> = {
  mcp: 0.24,
  openai: 0.22,
  agent: 0.18,
  agents: 0.18,
  ai: 0.12,
  github: 0.06,
};

function recencyScore(updatedAt: string): number {
  const days = Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
  if (days <= 7) return 1;
  if (days <= 30) return 0.8;
  if (days <= 90) return 0.55;
  return 0.25;
}

function normalizeRepoScore(repo: {
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  topics?: string[];
  description?: string | null;
}): number {
  const starScore = Math.min(1, Math.log10(repo.stargazers_count + 1) / 4);
  const forkScore = Math.min(1, Math.log10(repo.forks_count + 1) / 3);
  const topicScore = (repo.topics ?? []).reduce((sum, topic) => sum + (topicWeights[topic] ?? 0), 0);
  const descriptionScore = /openai|mcp|agent|tool/i.test(repo.description ?? "") ? 0.15 : 0;
  return Number(
    Math.min(1, starScore * 0.33 + forkScore * 0.12 + recencyScore(repo.updated_at) * 0.3 + topicScore + descriptionScore).toFixed(3),
  );
}

export class GithubScanner {
  private readonly octokit = createGithubClient();

  async scan(options: ScanOptions): Promise<RankedRepo[]> {
    const seen = new Map<string, RankedRepo>();

    for (const query of options.queries) {
      const response = await this.octokit.search.repos({
        q: query,
        per_page: Math.min(10, options.maxRepos),
        sort: "stars",
        order: "desc",
      });

      for (const repo of response.data.items) {
        const score = normalizeRepoScore(repo);
        if (score < config.minRelevanceScore) {
          continue;
        }

        let readme: string | undefined;
        if (options.includeReadme && repo.owner?.login) {
          readme = await this.getReadme(repo.owner.login, repo.name);
        }

        const rankedRepo: RankedRepo = {
          fullName: repo.full_name,
          description: repo.description ?? "",
          htmlUrl: repo.html_url,
          language: repo.language,
          score,
          signals: {
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            updatedAt: repo.updated_at,
            topics: repo.topics ?? [],
            watchers: repo.watchers_count,
          },
        };

        if (readme) {
          rankedRepo.readme = readme;
        }

        const existing = seen.get(rankedRepo.fullName);
        if (!existing || rankedRepo.score > existing.score) {
          seen.set(rankedRepo.fullName, rankedRepo);
        }
      }
    }

    return [...seen.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxRepos);
  }

  private async getReadme(owner: string, repo: string): Promise<string | undefined> {
    try {
      const response = await this.octokit.repos.getReadme({
        owner,
        repo,
        mediaType: {
          format: "raw",
        },
      });
      return typeof response.data === "string"
        ? response.data
        : Buffer.from((response.data as { content: string }).content, "base64").toString("utf8");
    } catch {
      return undefined;
    }
  }
}
