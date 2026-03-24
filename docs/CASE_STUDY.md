# Case Study

## Problem

Most AI coding workflows are highly inconsistent across repositories:

- prompts are ad hoc
- conventions are tribal knowledge
- `AGENTS.md` files drift or never get created
- useful patterns from other codebases are not reused systematically

That creates a gap between "the model can help" and "the engineering system gets better over time."

## Solution

`agent-intel-mcp` turns that gap into a developer intelligence workflow.

The system scans high-signal GitHub repositories, extracts reusable agent-engineering patterns, clusters them into themes, compares those themes against a local repository, and proposes safe `AGENTS.md` improvements through an MCP server and demo dashboard.

## Why This Is Interesting

This project is not just an LLM wrapper. It combines:

- external pattern mining from GitHub
- local repository profiling
- embeddings-backed clustering
- MCP tool exposure for agent clients
- non-destructive patch preview generation
- local persistence for historical scans and suggestions

## Architecture Decisions

### MCP-first interface

The project exposes tools, resources, and prompts over stdio MCP so it can plug into agent clients instead of only existing as a standalone app.

### Heuristic fallback mode

OpenAI-backed suggestion synthesis and clustering are optional. The demo still works without API keys through deterministic fallbacks, which makes the repo easier to run and evaluate.

### SQLite-backed local memory

Scans, clusters, and suggestions are stored locally so the dashboard can show project history instead of acting like a stateless demo.

### Safe patch output

The project generates preview diffs for `AGENTS.md` rather than mutating repositories directly, which keeps the experience reviewable and portfolio-friendly.

## What It Demonstrates

- applied OpenAI integration beyond chat UX
- MCP server design
- developer tooling for agent workflows
- TypeScript backend structure and test coverage
- practical system design around AI-assisted engineering

## Next Steps

- AST-aware convention extraction
- richer benchmark datasets for suggestion quality
- deeper repository sampling strategies
- direct PR comment or patch export integrations
