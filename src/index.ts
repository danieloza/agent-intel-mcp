#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AgentIntelService } from "./core/agent-intel-service.js";
import { createMcpServer } from "./mcp/server.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const service = new AgentIntelService();
  const server = createMcpServer(service);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("agent-intel-mcp started");
}

main().catch((error) => {
  logger.error({ err: error }, "Failed to start agent-intel-mcp");
  process.exitCode = 1;
});
