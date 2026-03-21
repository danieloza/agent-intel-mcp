import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { URL } from "node:url";
import { AgentIntelService } from "../core/agent-intel-service.js";
import { logger } from "../utils/logger.js";
import { getDashboardData, refreshDashboardData } from "./dashboard-data.js";

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

async function readBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function startDemoServer(port = 4321): Promise<http.Server> {
  const service = new AgentIntelService();
  const publicDir = path.resolve(process.cwd(), "public");

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (url.pathname === "/api/intel/state" && request.method === "GET") {
      sendJson(response, 200, getDashboardData(service));
      return;
    }

    if (url.pathname === "/healthz" && request.method === "GET") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/intel/refresh" && request.method === "POST") {
      try {
        const rawBody = await readBody(request);
        const body = rawBody ? (JSON.parse(rawBody) as { localPath?: string; maxRepos?: number; queries?: string[] }) : {};
        const payload = await refreshDashboardData(service, body);
        sendJson(response, 200, payload);
      } catch (error) {
        logger.error({ err: error }, "Demo refresh failed");
        sendJson(response, 500, {
          error: "refresh_failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      return;
    }

    const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const targetPath = path.join(publicDir, relativePath);

    if (!targetPath.startsWith(publicDir) || !fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const extension = path.extname(targetPath);
    response.writeHead(200, { "Content-Type": mimeTypes[extension] ?? "application/octet-stream" });
    fs.createReadStream(targetPath).pipe(response);
  });

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  logger.info({ port }, "agent-intel demo server started");
  return server;
}
