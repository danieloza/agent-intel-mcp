import { z } from "zod";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { AgentIntelService } from "../core/agent-intel-service.js";
import { config } from "../config.js";

function jsonResource(uri: string, data: unknown): ReadResourceResult {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function textResource(uri: string, text: string): ReadResourceResult {
  return {
    contents: [
      {
        uri,
        mimeType: "text/plain",
        text,
      },
    ],
  };
}

export function createMcpServer(service: AgentIntelService): McpServer {
  const server = new McpServer({
    name: "agent-intel-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "scan_github_repos",
    {
      description: "Scan GitHub for high-signal OpenAI, MCP, and agent engineering repositories.",
      inputSchema: {
        queries: z.array(z.string()).default(["mcp openai agent language:TypeScript", "openai sdk agents language:TypeScript"]),
        maxRepos: z.number().int().positive().max(50).default(config.maxReposPerScan),
        includeReadme: z.boolean().default(true),
      },
    },
    async ({ queries, maxRepos, includeReadme }) => ({
      content: [{ type: "text", text: JSON.stringify(await service.scanGithub(queries, maxRepos, includeReadme), null, 2) }],
    }),
  );

  server.registerTool(
    "extract_patterns",
    {
      description: "Extract reusable workflow, tooling, and AGENTS.md patterns from the latest scanned repositories or arbitrary markdown.",
      inputSchema: {
        sourcePath: z.string().optional(),
        content: z.string().optional(),
      },
    },
    async ({ sourcePath, content }) => {
      const patterns =
        sourcePath && content ? service.extractPatternsFromText(sourcePath, content) : service.extractPatternsFromLatestScan();
      return {
        content: [{ type: "text", text: JSON.stringify(patterns, null, 2) }],
      };
    },
  );

  server.registerTool(
    "analyze_local_repo",
    {
      description: "Profile the local repository for stack, commands, conventions, gaps, and AGENTS.md presence.",
      inputSchema: {
        localPath: z.string().default(config.localRepoPath),
      },
    },
    async ({ localPath }) => ({
      content: [{ type: "text", text: JSON.stringify(service.analyzeLocalRepo(localPath), null, 2) }],
    }),
  );

  server.registerTool(
    "cluster_patterns",
    {
      description: "Create reusable pattern clusters from stored extracted patterns using embeddings when available.",
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(await service.clusterPatterns(), null, 2) }],
    }),
  );

  server.registerTool(
    "generate_suggestions",
    {
      description: "Generate AGENTS.md and workflow suggestions from stored GitHub patterns and the local repo profile.",
      inputSchema: {
        localPath: z.string().default(config.localRepoPath),
      },
    },
    async ({ localPath }) => ({
      content: [{ type: "text", text: JSON.stringify(await service.generateSuggestions(localPath), null, 2) }],
    }),
  );

  server.registerTool(
    "generate_agents_patch",
    {
      description: "Build a non-destructive patch preview for AGENTS.md based on the latest generated suggestions.",
      inputSchema: {
        localPath: z.string().default(config.localRepoPath),
      },
    },
    async ({ localPath }) => ({
      content: [{ type: "text", text: service.generateAgentsPatch(localPath) }],
    }),
  );

  server.registerResource(
    "github-latest-scan",
    "github://latest-scan",
    {
      title: "Latest GitHub scan",
      description: "Most recent ranked repositories snapshot.",
    },
    async () => jsonResource("github://latest-scan", service.getResourceState().latestScan),
  );

  server.registerResource(
    "patterns-catalog",
    "memory://patterns",
    {
      title: "Pattern catalog",
      description: "Most recently extracted patterns.",
    },
    async () => jsonResource("memory://patterns", service.getResourceState().patterns),
  );

  server.registerResource(
    "pattern-clusters",
    "memory://clusters",
    {
      title: "Pattern clusters",
      description: "Clustered external patterns built from the extracted catalog.",
    },
    async () => jsonResource("memory://clusters", service.getResourceState().clusters),
  );

  server.registerResource(
    "local-profile",
    "local://profile",
    {
      title: "Local profile",
      description: "Detected local repo stack and current AGENTS contract.",
    },
    async () => jsonResource("local://profile", service.getResourceState().localProfile),
  );

  server.registerResource(
    "agents-patch",
    "local://agents-patch",
    {
      title: "AGENTS.md patch",
      description: "Current patch preview for AGENTS.md updates.",
    },
    async () => textResource("local://agents-patch", service.getResourceState().agentsPatch),
  );

  server.registerResource(
    "repo-readme",
    new ResourceTemplate("github://repo/{owner}/{repo}", { list: undefined }),
    {
      title: "Repository summary",
      description: "Fetch a repo from the latest scan snapshot by owner/name.",
    },
    async (_uri, { owner, repo }) => {
      const hit = service
        .getResourceState()
        .latestScan?.repos.find((candidate) => candidate.fullName.toLowerCase() === `${owner}/${repo}`.toLowerCase());
      return jsonResource(`github://repo/${owner}/${repo}`, hit ?? null);
    },
  );

  server.registerPrompt(
    "portfolio_summary",
    {
      description: "Generate a concise summary of why these suggestions improve the agent engineering setup.",
      argsSchema: {
        projectName: z.string().default("the project"),
      },
    },
    async ({ projectName }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Summarize the latest agent-intel findings for ${projectName}. Emphasize GitHub scan coverage, extracted patterns, and AGENTS.md impact.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "agents_rewrite",
    {
      description: "Prompt template for rewriting AGENTS.md using the latest suggestions.",
      argsSchema: {
        localPath: z.string().default(config.localRepoPath),
      },
    },
    async ({ localPath }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Rewrite the AGENTS.md at ${service.resolveAgentGuidePath(localPath)} using the latest patch preview. Preserve existing intent, improve validation rules, and keep the document concise.`,
          },
        },
      ],
    }),
  );

  return server;
}
