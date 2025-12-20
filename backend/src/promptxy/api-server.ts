import http from "node:http";
import { Database } from "sqlite";
import {
  PromptxyConfig,
  PromptxyRule,
  ConfigSyncRequest,
  ConfigSyncResponse,
  PreviewRequest,
  PreviewResponse,
  CleanupResponse,
  SSERequestEvent,
  RequestRecordResponse,
  RequestListResponse,
  RuleValidationResult,
} from "./types.js";
import {
  insertRequestRecord,
  getRequestList,
  getRequestDetail,
  cleanupOldRequests,
  deleteRequest,
  getDatabaseInfo,
  getRequestStats,
} from "./database.js";
import { saveConfig } from "./config.js";
import { applyPromptRules } from "./rules/engine.js";
import { readRequestBody } from "./http.js";

// SSE 连接管理
const sseConnections = new Set<http.ServerResponse>();

/**
 * SSE 连接处理
 */
function handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  // 发送连接确认
  res.write("event: connected\ndata: {\"status\": \"ok\"}\n\n");

  sseConnections.add(res);

  req.on("close", () => {
    sseConnections.delete(res);
  });
}

/**
 * 广播请求事件到所有 SSE 连接
 */
export function broadcastRequest(data: SSERequestEvent): void {
  for (const res of sseConnections) {
    try {
      res.write(`event: request\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // 忽略已关闭的连接
      sseConnections.delete(res);
    }
  }
}

/**
 * 发送 JSON 响应
 */
function sendJson(res: http.ServerResponse, status: number, data: any): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * 处理请求历史列表
 */
async function handleGetRequests(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<void> {
  try {
    const limit = Number(url.searchParams.get("limit")) || 50;
    const offset = Number(url.searchParams.get("offset")) || 0;
    const client = url.searchParams.get("client") || undefined;
    const startTime = url.searchParams.get("startTime");
    const endTime = url.searchParams.get("endTime");

    const result = await getRequestList({
      limit,
      offset,
      client,
      startTime: startTime ? Number(startTime) : undefined,
      endTime: endTime ? Number(endTime) : undefined,
    });

    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, { error: "Failed to get request list", message: error?.message });
  }
}

/**
 * 处理单个请求详情
 */
async function handleGetRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  id: string
): Promise<void> {
  try {
    const record = await getRequestDetail(id);

    if (!record) {
      sendJson(res, 404, { error: "Request not found" });
      return;
    }

    // 解析 JSON 字符串
    const response: RequestRecordResponse = {
      id: record.id,
      timestamp: record.timestamp,
      client: record.client,
      path: record.path,
      method: record.method,
      originalBody: JSON.parse(record.originalBody),
      modifiedBody: JSON.parse(record.modifiedBody),
      matchedRules: JSON.parse(record.matchedRules),
      responseStatus: record.responseStatus,
      durationMs: record.durationMs,
      responseHeaders: record.responseHeaders ? JSON.parse(record.responseHeaders) : undefined,
      error: record.error,
    };

    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 500, { error: "Failed to get request detail", message: error?.message });
  }
}

/**
 * 处理配置读取
 */
function handleGetConfig(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig
): void {
  sendJson(res, 200, config);
}

/**
 * 验证规则格式
 */
function validateRules(rules: PromptxyRule[]): RuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(rules)) {
    return { valid: false, errors: ["Rules must be an array"], warnings: [] };
  }

  for (const rule of rules) {
    if (!rule.id || typeof rule.id !== "string") {
      errors.push(`Rule missing or invalid id`);
      continue;
    }

    if (!rule.when || typeof rule.when !== "object") {
      errors.push(`Rule ${rule.id}: missing 'when' object`);
      continue;
    }

    if (!rule.when.client || typeof rule.when.client !== "string") {
      errors.push(`Rule ${rule.id}: invalid client`);
    }

    if (!rule.when.field || typeof rule.when.field !== "string") {
      errors.push(`Rule ${rule.id}: invalid field`);
    }

    if (!Array.isArray(rule.ops) || rule.ops.length === 0) {
      errors.push(`Rule ${rule.id}: ops must be non-empty array`);
      continue;
    }

    for (const op of rule.ops) {
      if (!op || typeof op !== "object" || typeof (op as any).type !== "string") {
        errors.push(`Rule ${rule.id}: invalid op`);
        continue;
      }

      // 验证正则语法
      const opType = (op as any).type;
      if (["replace", "delete", "insert_before", "insert_after"].includes(opType)) {
        if ((op as any).regex) {
          try {
            new RegExp((op as any).regex, (op as any).flags);
          } catch (e: any) {
            errors.push(`Rule ${rule.id}: invalid regex - ${e.message}`);
          }
        }
      }
    }

    // 警告：没有启用状态的规则
    if (rule.enabled === undefined) {
      warnings.push(`Rule ${rule.id}: missing 'enabled' property, defaulting to true`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 处理配置同步
 */
async function handleConfigSync(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
  currentRules: PromptxyRule[]
): Promise<void> {
  try {
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 * 1024 });
    const syncRequest: ConfigSyncRequest = JSON.parse(body.toString());

    // 验证规则
    const validation = validateRules(syncRequest.rules);
    if (!validation.valid) {
      sendJson(res, 400, {
        error: "Validation failed",
        errors: validation.errors,
        warnings: validation.warnings,
      });
      return;
    }

    // 更新内存中的规则（立即生效）
    currentRules.length = 0;
    currentRules.push(...syncRequest.rules);

    // 更新配置并保存到文件
    const updatedConfig: PromptxyConfig = {
      ...config,
      rules: syncRequest.rules,
    };

    await saveConfig(updatedConfig);

    sendJson(res, 200, {
      success: true,
      message: "配置已更新并生效",
      appliedRules: syncRequest.rules.length,
      warnings: validation.warnings,
    } as ConfigSyncResponse);
  } catch (error: any) {
    sendJson(res, 500, {
      error: "Failed to sync config",
      message: error?.message,
    });
  }
}

/**
 * 处理预览请求
 */
function handlePreview(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rules: PromptxyRule[]
): void {
  readRequestBody(req, { maxBytes: 10 * 1024 * 1024 })
    .then((body) => {
      const previewRequest: PreviewRequest = JSON.parse(body.toString());

      if (!previewRequest.body || typeof previewRequest.body !== "object") {
        sendJson(res, 400, { error: "Invalid body" });
        return;
      }

      // 应用规则
      let text: string;
      if (previewRequest.field === "system") {
        text = typeof previewRequest.body.system === "string"
          ? previewRequest.body.system
          : "";
      } else {
        text = typeof previewRequest.body.instructions === "string"
          ? previewRequest.body.instructions
          : "";
      }

      const ctx = {
        client: previewRequest.client,
        field: previewRequest.field,
        method: previewRequest.method || "POST",
        path: previewRequest.path || "/",
        model: previewRequest.model,
      };

      const result = applyPromptRules(text, ctx, rules);

      // 构建修改后的请求体
      const modifiedBody = { ...previewRequest.body };
      if (previewRequest.field === "system") {
        modifiedBody.system = result.text;
      } else {
        modifiedBody.instructions = result.text;
      }

      const response: PreviewResponse = {
        original: previewRequest.body,
        modified: modifiedBody,
        matches: result.matches,
      };

      sendJson(res, 200, response);
    })
    .catch((error) => {
      sendJson(res, 500, { error: "Preview failed", message: error?.message });
    });
}

/**
 * 处理数据清理
 */
async function handleCleanup(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<void> {
  try {
    const keep = Number(url.searchParams.get("keep")) || 100;
    const deleted = await cleanupOldRequests(keep);

    const info = await getDatabaseInfo();

    sendJson(res, 200, {
      deleted,
      remaining: info.recordCount,
      success: true,
    } as CleanupResponse);
  } catch (error: any) {
    sendJson(res, 500, { error: "Cleanup failed", message: error?.message });
  }
}

/**
 * 处理删除单个请求
 */
async function handleDeleteRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  id: string
): Promise<void> {
  try {
    const success = await deleteRequest(id);

    if (!success) {
      sendJson(res, 404, { error: "Request not found" });
      return;
    }

    sendJson(res, 200, { success: true, message: "Request deleted" });
  } catch (error: any) {
    sendJson(res, 500, { error: "Delete failed", message: error?.message });
  }
}

/**
 * 处理健康检查
 */
function handleHealth(
  req: http.IncomingMessage,
  res: http.ServerResponse
): void {
  sendJson(res, 200, {
    status: "ok",
    service: "promptxy-api",
    timestamp: Date.now(),
  });
}

/**
 * 处理统计信息
 */
async function handleStats(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  try {
    const stats = await getRequestStats();
    const dbInfo = await getDatabaseInfo();

    sendJson(res, 200, {
      ...stats,
      database: dbInfo,
    });
  } catch (error: any) {
    sendJson(res, 500, { error: "Failed to get stats", message: error?.message });
  }
}

/**
 * 处理数据库信息
 */
async function handleDatabaseInfo(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  try {
    const info = await getDatabaseInfo();
    sendJson(res, 200, info);
  } catch (error: any) {
    sendJson(res, 500, { error: "Failed to get database info", message: error?.message });
  }
}

/**
 * 创建 API 服务器
 */
export function createApiServer(
  db: Database,
  config: PromptxyConfig,
  currentRules: PromptxyRule[]
): http.Server {
  return http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        sendJson(res, 400, { error: "Invalid request" });
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

      // CORS 支持
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // SSE 端点
      if (req.method === "GET" && url.pathname === "/_promptxy/events") {
        handleSSE(req, res);
        return;
      }

      // 请求历史列表
      if (req.method === "GET" && url.pathname === "/_promptxy/requests") {
        await handleGetRequests(req, res, url);
        return;
      }

      // 请求详情
      if (req.method === "GET" && url.pathname.startsWith("/_promptxy/requests/")) {
        const id = url.pathname.split("/").pop();
        if (id) {
          await handleGetRequest(req, res, id);
          return;
        }
      }

      // 删除请求
      if (req.method === "DELETE" && url.pathname.startsWith("/_promptxy/requests/")) {
        const id = url.pathname.split("/").pop();
        if (id) {
          await handleDeleteRequest(req, res, id);
          return;
        }
      }

      // 配置读取
      if (req.method === "GET" && url.pathname === "/_promptxy/config") {
        handleGetConfig(req, res, config);
        return;
      }

      // 配置同步
      if (req.method === "POST" && url.pathname === "/_promptxy/config/sync") {
        await handleConfigSync(req, res, config, currentRules);
        return;
      }

      // 预览
      if (req.method === "POST" && url.pathname === "/_promptxy/preview") {
        handlePreview(req, res, currentRules);
        return;
      }

      // 数据清理
      if (req.method === "POST" && url.pathname === "/_promptxy/requests/cleanup") {
        await handleCleanup(req, res, url);
        return;
      }

      // 健康检查
      if (req.method === "GET" && url.pathname === "/_promptxy/health") {
        handleHealth(req, res);
        return;
      }

      // 统计信息
      if (req.method === "GET" && url.pathname === "/_promptxy/stats") {
        await handleStats(req, res);
        return;
      }

      // 数据库信息
      if (req.method === "GET" && url.pathname === "/_promptxy/database") {
        await handleDatabaseInfo(req, res);
        return;
      }

      // 404
      sendJson(res, 404, { error: "Not Found", path: url.pathname });
    } catch (error: any) {
      sendJson(res, 500, { error: "Internal Server Error", message: error?.message });
    }
  });
}
