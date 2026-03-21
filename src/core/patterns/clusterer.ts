import OpenAI from "openai";
import type { ExtractedPattern, PatternCluster } from "../../types.js";
import { config } from "../../config.js";
import { dedupe, slugify } from "../../utils/text.js";

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 4);
}

function keywordsForPatterns(patterns: ExtractedPattern[]): string[] {
  const tokens = patterns.flatMap((pattern) => tokenize(`${pattern.title} ${pattern.evidence} ${pattern.tags.join(" ")}`));
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([token]) => token);
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const size = Math.min(left.length, right.length);
  for (let index = 0; index < size; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function buildCluster(category: ExtractedPattern["category"], patterns: ExtractedPattern[]): PatternCluster {
  const keywords = keywordsForPatterns(patterns);
  const label = [category, ...keywords.slice(0, 2)].join(" / ");
  return {
    id: slugify(label),
    label,
    category,
    patternIds: patterns.map((pattern) => pattern.id),
    sourceRepos: dedupe(patterns.map((pattern) => pattern.sourceRepo ?? pattern.sourcePath)),
    keywords,
    size: patterns.length,
  };
}

function heuristicClusters(patterns: ExtractedPattern[]): PatternCluster[] {
  const buckets = new Map<string, ExtractedPattern[]>();
  for (const pattern of patterns) {
    const key = `${pattern.category}:${keywordsForPatterns([pattern]).slice(0, 1).join("-") || "general"}`;
    const current = buckets.get(key) ?? [];
    current.push(pattern);
    buckets.set(key, current);
  }

  return [...buckets.entries()].map(([key, bucket]) => {
    const [category] = key.split(":") as [ExtractedPattern["category"], string];
    return buildCluster(category, bucket);
  });
}

export class PatternClusterer {
  private readonly client = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : null;

  async cluster(patterns: ExtractedPattern[]): Promise<PatternCluster[]> {
    if (patterns.length === 0) {
      return [];
    }

    if (!this.client) {
      return heuristicClusters(patterns);
    }

    const enriched = await this.attachEmbeddings(patterns);
    const clusters: ExtractedPattern[][] = [];

    for (const pattern of enriched) {
      const bestCluster = clusters.find((cluster) => {
        const anchor = cluster[0];
        if (!anchor?.embedding || !pattern.embedding || anchor.category !== pattern.category) {
          return false;
        }
        return cosineSimilarity(anchor.embedding, pattern.embedding) >= config.clusterSimilarityThreshold;
      });

      if (bestCluster) {
        bestCluster.push(pattern);
      } else {
        clusters.push([pattern]);
      }
    }

    return clusters.map((cluster) => buildCluster(cluster[0]!.category, cluster));
  }

  private async attachEmbeddings(patterns: ExtractedPattern[]): Promise<ExtractedPattern[]> {
    const texts = patterns.map((pattern) => `${pattern.category}\n${pattern.title}\n${pattern.evidence}\n${pattern.tags.join(" ")}`);
    const response = await this.client!.embeddings.create({
      model: config.openAiEmbeddingModel,
      input: texts,
    });

    return patterns.map((pattern, index) => ({
      ...pattern,
      ...(response.data[index]?.embedding ? { embedding: response.data[index].embedding } : {}),
    }));
  }
}
