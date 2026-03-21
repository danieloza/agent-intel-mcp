# Architecture

## Goals

- Scan relevant GitHub repositories for agent-engineering and OpenAI/MCP patterns.
- Normalize those patterns into a local catalog.
- Cluster the catalog to expose dominant themes instead of raw bullet lists only.
- Compare those themes against a target repository's actual conventions and gaps.
- Produce concise, safe `AGENTS.md` suggestions and patch previews.

## Flow

1. `scan_github_repos`
   - Uses GitHub search to collect repositories from a curated query set.
   - Scores repositories using stars, forks, recency, and topic relevance.
2. `extract_patterns`
   - Mines bullet-list style patterns from README and agent docs.
   - Assigns pattern categories like workflow, tooling, testing, and ops.
3. `cluster_patterns`
   - Uses OpenAI embeddings when available.
   - Falls back to heuristic grouping when no API key is configured.
   - Produces cluster labels, keywords, and source rollups.
4. `analyze_local_repo`
   - Recursively scans the repo with ignore rules.
   - Detects scripts, config files, CI workflows, conventions, and operational gaps.
5. `generate_suggestions`
   - Uses OpenAI `Responses API` when configured.
   - Falls back to deterministic heuristics when no API key is present.
   - Incorporates cluster summaries and local gaps into the prompt.
6. `generate_agents_patch`
   - Builds a non-destructive patch preview for `AGENTS.md`.

## Key Modules

- `src/core/github/scanner.ts`
- `src/core/patterns/extractor.ts`
- `src/core/patterns/clusterer.ts`
- `src/core/local/local-repo-profiler.ts`
- `src/core/suggestions/openai-suggestion-engine.ts`
- `src/storage/database.ts`
- `src/mcp/server.ts`

## Delivery Layer

- PR and push validation in [ci.yml](/C:/Users/syfsy/projekty/agent-intel-mcp/.github/workflows/ci.yml)
- Tagged publish/release flow in [release.yml](/C:/Users/syfsy/projekty/agent-intel-mcp/.github/workflows/release.yml)
- Package guard via `prepublishOnly` and `npm run release:check`

## Current Boundaries

- Local comparison is convention-oriented, not full AST-level analysis.
- Clustering is lightweight and optimized for fast portfolio demos.
- Release workflow publishes only when `NPM_TOKEN` is configured.

## Next Iterations

- Add AST-aware code convention extraction.
- Persist cluster centroids and drift metrics over time.
- Add benchmark datasets for suggestion quality regression testing.
