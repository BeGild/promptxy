import http from "node:http";
import { Readable } from "node:stream";
import { Database } from "sqlite";
import { mutateClaudeBody } from "./adapters/claude.js";
import { mutateCodexBody } from "./adapters/codex.js";
import { mutateGeminiBody } from "./adapters/gemini.js";
import {
  cloneAndFilterRequestHeaders,
  filterResponseHeaders,
  joinUrl,
  readRequestBody,
  shouldParseJson,
} from "./http.js";
import { createLogger } from "./logger.js";
import {
  PromptxyConfig,
  PromptxyClient,
  PromptxyRuleMatch,
  RequestRecord,
  SSERequestEvent,
} from "./types.js";
import { insertRequestRecord } from "./database.js";
import { broadcastRequest } from "./api-server.js";

type RouteInfo = {
  client: PromptxyClient;
  prefix: "" | "/openai" | "/gemini";
  upstreamBaseUrl: string;
};

function getRouteInfo(pathname: string, config: PromptxyConfig): RouteInfo {
  if (pathname === "/openai" || pathname.startsWith("/openai/")) {
    return { client: "codex", prefix: "/openai", upstreamBaseUrl: config.upstreams.openai };
  }
  if (pathname === "/gemini" || pathname.startsWith("/gemini/")) {
    return { client: "gemini", prefix: "/gemini", upstreamBaseUrl: config.upstreams.gemini };
  }
  return { client: "claude", prefix: "", upstreamBaseUrl: config.upstreams.anthropic };
}

function stripPrefix(pathname: string, prefix: string): string {
  if (!prefix) return pathname;
  if (pathname === prefix) return "/";
  if (pathname.startsWith(prefix + "/")) return pathname.slice(prefix.length);
  return pathname;
}

function jsonError(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("content-length", Buffer.byteLength(body));
  res.end(body);
}

function summarizeMatches(matches: PromptxyRuleMatch[]): string {
  if (matches.length === 0) return "no rules";
  const ids = Array.from(new Set(matches.map((m) => m.ruleId)));
  return `rules=${ids.join(",")} ops=${matches.length}`;
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createGateway(config: PromptxyConfig, db: Database): http.Server {
  const logger = createLogger({ debug: config.debug });

  return http.createServer(async (req, res) => {
    const startTime = Date.now();
    let requestId: string | undefined;
    let originalBodyBuffer: Buffer | undefined;
    let jsonBody: any | undefined;
    let route: RouteInfo | undefined;
    let upstreamPath: string | undefined;
    let matches: PromptxyRuleMatch[] = [];
    let warnings: string[] = [];
    let upstreamResponse: Response | undefined;
    let error: string | undefined;
    let method: string = req.method || "unknown";

    try {
      if (!req.url || !req.method) {
        jsonError(res, 400, { error: "Invalid request" });
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
      method = req.method;

      // 健康检查端点（不记录）
      if (method === "GET" && url.pathname === "/_promptxy/health") {
        jsonError(res, 200, { status: "ok" });
        return;
      }

      route = getRouteInfo(url.pathname, config);
      upstreamPath = stripPrefix(url.pathname, route.prefix);
      const upstreamUrl = joinUrl(route.upstreamBaseUrl, upstreamPath, url.search);

      const headers = cloneAndFilterRequestHeaders(req.headers);

      let bodyBuffer: Buffer | undefined;
      const expectsBody = method !== "GET" && method !== "HEAD";

      if (expectsBody) {
        bodyBuffer = await readRequestBody(req, { maxBytes: 20 * 1024 * 1024 });
        originalBodyBuffer = bodyBuffer; // 保存原始请求体

        const contentType = req.headers["content-type"];
        if (shouldParseJson(Array.isArray(contentType) ? contentType[0] : contentType)) {
          try {
            jsonBody = JSON.parse(bodyBuffer.toString("utf-8"));
          } catch {
            // Keep passthrough behavior when JSON is invalid; upstream will reject if needed.
            jsonBody = undefined;
          }
        }
      }

      if (jsonBody && typeof jsonBody === "object") {
        if (route.client === "claude") {
          const result = mutateClaudeBody({
            body: jsonBody,
            method: method,
            path: upstreamPath,
            rules: config.rules,
          });
          jsonBody = result.body;
          matches = result.matches;
        } else if (route.client === "codex") {
          const result = mutateCodexBody({
            body: jsonBody,
            method: method,
            path: upstreamPath,
            rules: config.rules,
          });
          jsonBody = result.body;
          matches = result.matches;
          warnings.push(...result.warnings);
        } else if (route.client === "gemini") {
          const result = mutateGeminiBody({
            body: jsonBody,
            method: method,
            path: upstreamPath,
            rules: config.rules,
          });
          jsonBody = result.body;
          matches = result.matches;
        }
      }

      if (config.debug) {
        logger.debug(
          `[promptxy] ${route.client.toUpperCase()} ${method} ${url.pathname} -> ${upstreamUrl} (${summarizeMatches(
            matches
          )}${warnings.length ? ` warnings=${warnings.length}` : ""})`
        );
        for (const w of warnings) {
          logger.debug(`[promptxy] warning: ${w}`);
        }
      }

      upstreamResponse = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body: expectsBody
          ? jsonBody
            ? Buffer.from(JSON.stringify(jsonBody))
            : bodyBuffer
          : undefined,
        redirect: "manual",
      });

      res.statusCode = upstreamResponse.status;

      const responseHeaders = filterResponseHeaders(upstreamResponse.headers);
      for (const [key, value] of Object.entries(responseHeaders)) {
        try {
          res.setHeader(key, value);
        } catch {
          // Ignore invalid headers for Node response.
        }
      }

      if (!upstreamResponse.body) {
        res.end();
        return;
      }

      Readable.fromWeb(upstreamResponse.body as any).pipe(res);

      // 记录请求到数据库（异步，不阻塞响应）
      const duration = Date.now() - startTime;
      requestId = generateRequestId();

      // 准备记录数据
      const record: RequestRecord = {
        id: requestId,
        timestamp: Date.now(),
        client: route.client,
        path: upstreamPath,
        method: method,
        originalBody: originalBodyBuffer ? originalBodyBuffer.toString("utf-8") : "{}",
        modifiedBody: jsonBody ? JSON.stringify(jsonBody) : (originalBodyBuffer?.toString("utf-8") ?? "{}"),
        matchedRules: JSON.stringify(matches),
        responseStatus: upstreamResponse.status,
        durationMs: duration,
        responseHeaders: JSON.stringify(Object.fromEntries(upstreamResponse.headers.entries())),
        error: undefined,
      };

      // 异步保存到数据库
      insertRequestRecord(record).catch((err) => {
        logger.debug(`[promptxy] Failed to save request record: ${err?.message}`);
      });

      // SSE 广播
      const sseData: SSERequestEvent = {
        id: requestId,
        timestamp: record.timestamp,
        client: route.client,
        path: upstreamPath,
        method: method,
        matchedRules: matches.map(m => m.ruleId),
      };
      broadcastRequest(sseData);

    } catch (errorCaught: any) {
      error = errorCaught?.message ?? String(errorCaught);
      jsonError(res, 500, {
        error: "promptxy_error",
        message: error,
      });

      // 记录错误请求
      if (route && upstreamPath) {
        const duration = Date.now() - startTime;
        requestId = requestId ?? generateRequestId();

        const record: RequestRecord = {
          id: requestId,
          timestamp: Date.now(),
          client: route.client,
          path: upstreamPath,
          method: method,
          originalBody: originalBodyBuffer ? originalBodyBuffer.toString("utf-8") : "{}",
          modifiedBody: jsonBody ? JSON.stringify(jsonBody) : (originalBodyBuffer?.toString("utf-8") ?? "{}"),
          matchedRules: JSON.stringify(matches),
          responseStatus: undefined,
          durationMs: duration,
          responseHeaders: undefined,
          error: error,
        };

        insertRequestRecord(record).catch((err) => {
          logger.debug(`[promptxy] Failed to save error request record: ${err?.message}`);
        });

        const sseData: SSERequestEvent = {
          id: requestId,
          timestamp: record.timestamp,
          client: route.client,
          path: upstreamPath,
          method: method,
          matchedRules: matches.map(m => m.ruleId),
        };
        broadcastRequest(sseData);
      }
    }
  });
}
