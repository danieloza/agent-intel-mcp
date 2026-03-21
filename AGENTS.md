# AGENTS.md

## Mission

Build a portfolio-grade MCP server that discovers high-signal agent-engineering patterns and turns them into safe, reviewable `AGENTS.md` updates.

## Stack

- TypeScript on Node.js 24
- MCP stdio server via `@modelcontextprotocol/sdk`
- OpenAI `Responses API` for suggestion synthesis
- GitHub API via Octokit
- SQLite via `better-sqlite3`

## Working Rules

- Keep the server non-destructive. Patch previews are preferred over direct writes.
- Preserve deterministic fallbacks when external APIs are unavailable.
- Favor small, composable modules in `src/core/*`.
- Store durable scan and suggestion state in `.agent-intel/agent-intel.db`.
- Keep clustering deterministic enough to test when embeddings are unavailable.
- When changing prompts or suggestion logic, keep the JSON output contract stable.

## Validation

- Run `npm run build`
- Run `npm test`
- Run `npm run lint`

## MCP Surface

- Tools live in `src/mcp/server.ts`
- Business logic lives in `src/core/`
- Persistence lives in `src/storage/`
- CI and release workflows live in `.github/workflows/`

## Change Expectations

- Add tests for new extraction or suggestion heuristics.
- Document major architectural changes in `docs/ARCHITECTURE.md`.
