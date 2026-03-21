import pino from "pino";
import { config } from "../config.js";

export const logger = pino({
  name: "agent-intel-mcp",
  level: config.logLevel,
});
