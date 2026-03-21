#!/usr/bin/env node
import { startDemoServer } from "./demo/server.js";
import { logger } from "./utils/logger.js";

const port = Number(process.env.PORT ?? 4321);

startDemoServer(port).catch((error) => {
  logger.error({ err: error }, "Failed to start demo server");
  process.exitCode = 1;
});
