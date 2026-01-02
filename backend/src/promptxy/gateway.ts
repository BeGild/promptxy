import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { mutateClaudeBody } from './adapters/claude.js';
import { mutateCodexBody } from './adapters/codex.js';
import { mutateGeminiBody } from './adapters/gemini.js';
import {
  cloneAndFilterRequestHeaders,
  filterResponseHeaders,
  joinUrl,
  readRequestBody,
  shouldParseJson,
} from './http.js';
import { createLogger } from './logger.js';
import {
  PromptxyConfig,
  PromptxyClient,
  PromptxyRuleMatch,
  PromptxyRule,
  RequestRecord,
  SSERequestEvent,
  Supplier,
} from './types.js';
import { insertRequestRecord, getFilteredPaths, shouldFilterPath, generateRequestId } from './database.js';
import { broadcastRequest, setSSEConnections } from './api-handlers.js';
import type { FileSystemStorage } from './database.js';
import {
  handleSSE,
  handleGetRequests,
  handleGetPaths,
  handleGetRequest,
  handleConfigSync,
  handleGetConfig,
  handlePreview,
  handleCleanup,
  handleGetSettings,
  handleUpdateSettings,
  handleDeleteRequest,
  handleHealth,
  handleStats,
  handleDatabaseInfo,
  handleGetSuppliers,
  handleCreateSupplier,
  handleUpdateSupplier,
  handleDeleteSupplier,
  handleToggleSupplier,
  handleCreateRule,
  handleUpdateRule,
  handleDeleteRule,
  handleTransformPreview,
  handleGetTransformers,
  handleValidateTransformer,
  sendJson,
  type SSEConnections,
} from './api-handlers.js';
import { sanitizeHeaders } from './transformers/llms-compat.js';
import { authenticateRequest, clearAuthHeaders } from './transformers/auth.js';
import { isSSEResponse } from './transformers/sse.js';

type RouteInfo = {
  client: PromptxyClient;
  pathPrefix: string; // 请求路径前缀（用于 stripPrefix）
  upstreamBaseUrl: string;
  supplier: Supplier; // 完整的 supplier 配置（包含 auth）
};

/**
 * 根据请求路径查找供应商
 * 新架构：供应商不再绑定 localPrefix，而是根据路径前缀推断协议类型，
 * 然后查找该协议类型的第一个启用供应商
 *
 * 路径前缀映射：
 * - /claude* -> anthropic 协议 -> claude 客户端
 * - /openai* -> openai 协议 -> codex 客户端
 * - /gemini* -> gemini 协议 -> gemini 客户端
 */
function findSupplierByPath(pathname: string, suppliers: Supplier[]): RouteInfo | null {
  // 获取已启用的供应商
  const enabledSuppliers = suppliers.filter(s => s.enabled);

  if (enabledSuppliers.length === 0) {
    return null;
  }

  // 根据路径前缀推断协议类型和客户端类型
  let protocol: 'anthropic' | 'openai' | 'gemini' | null = null;
  let client: PromptxyClient | null = null;
  let pathPrefix: string | null = null;

  // 检查路径前缀，优先匹配更长的前缀
  if (pathname.startsWith('/openai/')) {
    protocol = 'openai';
    client = 'codex';
    pathPrefix = '/openai';
  } else if (pathname === '/openai') {
    protocol = 'openai';
    client = 'codex';
    pathPrefix = '/openai';
  } else if (pathname.startsWith('/gemini/')) {
    protocol = 'gemini';
    client = 'gemini';
    pathPrefix = '/gemini';
  } else if (pathname === '/gemini') {
    protocol = 'gemini';
    client = 'gemini';
    pathPrefix = '/gemini';
  } else if (pathname.startsWith('/claude/')) {
    protocol = 'anthropic';
    client = 'claude';
    pathPrefix = '/claude';
  } else if (pathname === '/claude') {
    protocol = 'anthropic';
    client = 'claude';
    pathPrefix = '/claude';
  }

  if (!protocol || !client || !pathPrefix) {
    return null;
  }

  // 查找第一个匹配协议类型的启用供应商
  const supplier = enabledSuppliers.find(s => s.protocol === protocol);
  if (!supplier) {
    return null;
  }

  return {
    client,
    pathPrefix,
    upstreamBaseUrl: supplier.baseUrl,
    supplier,
  };
}

function stripPrefix(pathname: string, prefix: string): string {
  if (!prefix) return pathname;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}

function jsonError(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
}

function summarizeMatches(matches: PromptxyRuleMatch[]): string {
  if (matches.length === 0) return 'no rules';
  const ids = Array.from(new Set(matches.map(m => m.ruleId)));
  return `rules=${ids.join(',')} ops=${matches.length}`;
}

/**
 * 获取前端静态文件目录路径
 */
function getFrontendDir(): string | null {
  try {
    // 尝试从 dist 目录查找
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const distDir = path.resolve(currentDir, '..', '..', 'dist', 'frontend');

    // 检查目录是否存在
    if (fs.existsSync(distDir)) {
      return distDir;
    }

    // 尝试从项目根目录查找（开发环境）
    const projectRoot = path.resolve(currentDir, '..', '..', '..');
    const devFrontendDir = path.join(projectRoot, 'frontend', 'dist');

    if (fs.existsSync(devFrontendDir)) {
      return devFrontendDir;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 处理前端静态文件服务
 */
function handleFrontendStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL): boolean {
  const frontendDir = getFrontendDir();
  if (!frontendDir) {
    return false;
  }

  // 处理根路径 - 返回 index.html
  if (url.pathname === '/' || url.pathname === '') {
    const indexPath = path.join(frontendDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
      return true;
    }
  }

  // 处理静态文件请求
  const filePath = path.join(frontendDir, url.pathname);

  // 安全检查：确保文件在 frontendDir 内
  if (!filePath.startsWith(frontendDir)) {
    return false;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(content);
    return true;
  }

  return false;
}

export function createGateway(
  config: PromptxyConfig,
  db: FileSystemStorage,
  currentRules: PromptxyRule[],
): http.Server {
  const logger = createLogger({ debug: config.debug });

  // 创建 SSE 连接集合
  const sseConnections: SSEConnections = new Set();
  setSSEConnections(sseConnections);

  return http.createServer(async (req, res) => {
    const startTime = Date.now();
    let requestId: string | undefined;
    let originalBodyBuffer: Buffer | undefined;
    let jsonBody: any | undefined;
    let route: RouteInfo | null = null;
    let upstreamPath: string | undefined;
    let matches: PromptxyRuleMatch[] = [];
    const warnings: string[] = [];
    let upstreamResponse: Response | undefined;
    let error: string | undefined;
    let method: string = req.method || 'unknown';

    try {
      if (!req.url || !req.method) {
        jsonError(res, 400, { error: 'Invalid request' });
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
      method = req.method;

      // ========== API路由（优先处理）==========
      if (url.pathname.startsWith('/_promptxy/')) {
        // SSE事件
        if (method === 'GET' && url.pathname === '/_promptxy/events') {
          handleSSE(req, res);
          return;
        }

        // 健康检查
        if (method === 'GET' && url.pathname === '/_promptxy/health') {
          handleHealth(req, res);
          return;
        }

        // 请求历史
        if (method === 'GET' && url.pathname === '/_promptxy/requests') {
          await handleGetRequests(req, res, url, db);
          return;
        }

        // 请求详情
        if (method === 'GET' && url.pathname.startsWith('/_promptxy/requests/')) {
          const id = url.pathname.split('/').pop();
          if (id) {
            await handleGetRequest(req, res, id, db);
            return;
          }
        }

        // 删除请求
        if (method === 'DELETE' && url.pathname.startsWith('/_promptxy/requests/')) {
          const id = url.pathname.split('/').pop();
          if (id) {
            await handleDeleteRequest(req, res, id, db);
            return;
          }
        }

        // 路径列表
        if (method === 'GET' && url.pathname === '/_promptxy/paths') {
          await handleGetPaths(req, res, url, db);
          return;
        }

        // 配置
        if (method === 'GET' && url.pathname === '/_promptxy/config') {
          handleGetConfig(req, res, config);
          return;
        }

        if (method === 'POST' && url.pathname === '/_promptxy/config/sync') {
          await handleConfigSync(req, res, config, currentRules);
          return;
        }

        // 规则管理
        if (url.pathname === '/_promptxy/rules' && method === 'POST') {
          await handleCreateRule(req, res, currentRules, config);
          return;
        }

        if (url.pathname.startsWith('/_promptxy/rules/') && method === 'PUT') {
          await handleUpdateRule(req, res, currentRules, url, config);
          return;
        }

        if (url.pathname.startsWith('/_promptxy/rules/') && method === 'DELETE') {
          await handleDeleteRule(req, res, currentRules, url, config);
          return;
        }

        // 供应商管理
        if (method === 'GET' && url.pathname === '/_promptxy/suppliers') {
          await handleGetSuppliers(req, res, config);
          return;
        }

        if (method === 'POST' && url.pathname === '/_promptxy/suppliers') {
          await handleCreateSupplier(req, res, config);
          return;
        }

        if (method === 'PUT' && url.pathname.startsWith('/_promptxy/suppliers/')) {
          await handleUpdateSupplier(req, res, config, url);
          return;
        }

        if (method === 'DELETE' && url.pathname.startsWith('/_promptxy/suppliers/')) {
          await handleDeleteSupplier(req, res, config, url);
          return;
        }

        if (method === 'POST' && url.pathname.endsWith('/toggle')) {
          await handleToggleSupplier(req, res, config, url);
          return;
        }

        // 预览
        if (method === 'POST' && url.pathname === '/_promptxy/preview') {
          handlePreview(req, res, currentRules);
          return;
        }

        // 数据清理
        if (method === 'POST' && url.pathname === '/_promptxy/requests/cleanup') {
          await handleCleanup(req, res, url, db);
          return;
        }

        // 设置
        if (method === 'GET' && url.pathname === '/_promptxy/settings') {
          await handleGetSettings(req, res, db);
          return;
        }

        if (method === 'POST' && url.pathname === '/_promptxy/settings') {
          await handleUpdateSettings(req, res, db);
          return;
        }

        // 统计
        if (method === 'GET' && url.pathname === '/_promptxy/stats') {
          await handleStats(req, res, db);
          return;
        }

        // 数据库信息
        if (method === 'GET' && url.pathname === '/_promptxy/database') {
          await handleDatabaseInfo(req, res, db);
          return;
        }

        // 协议转换预览（新增）
        if (method === 'POST' && url.pathname === '/_promptxy/transform/preview') {
          await handleTransformPreview(req, res, config);
          return;
        }

        // 获取可用转换器列表（新增）
        if (method === 'GET' && url.pathname === '/_promptxy/transformers') {
          await handleGetTransformers(req, res);
          return;
        }

        // 验证转换器配置（新增）
        if (method === 'POST' && url.pathname === '/_promptxy/transformers/validate') {
          await handleValidateTransformer(req, res);
          return;
        }

        // 404
        jsonError(res, 404, { error: 'API endpoint not found', path: url.pathname });
        return;
      }

      // ========== 前端静态文件服务 ==========
      if (method === 'GET') {
        const served = handleFrontendStatic(req, res, url);
        if (served) {
          return;
        }
      }

      // ========== Gateway代理路由 ==========

      // 根据路径查找供应商
      route = findSupplierByPath(url.pathname, config.suppliers);

      if (!route) {
        // 没有匹配的供应商，返回 404
        jsonError(res, 404, {
          error: 'No supplier found for this path',
          path: url.pathname,
        });
        return;
      }

      // TypeScript 类型守卫：从这里开始 route 一定不是 null
      const matchedRoute: RouteInfo = route;

      upstreamPath = stripPrefix(url.pathname, matchedRoute.pathPrefix);

      // ========== 网关入站鉴权（新增）==========
      let authHeaderUsed: string | undefined;
      if (config.gatewayAuth && config.gatewayAuth.enabled) {
        const authResult = authenticateRequest(req.headers, config.gatewayAuth);
        if (!authResult.authenticated) {
          jsonError(res, 401, {
            error: 'Unauthorized',
            message: authResult.error || 'Invalid or missing authentication token',
          });
          return;
        }
        authHeaderUsed = authResult.authHeaderUsed;
        if (config.debug && authHeaderUsed) {
          logger.debug(
            `[GatewayAuth] 鉴权通过，使用 header: ${authHeaderUsed}`,
          );
        }
      }

      // ========== 清理入站鉴权头（避免误传到上游）==========
      let headers = cloneAndFilterRequestHeaders(req.headers);
      if (config.gatewayAuth && config.gatewayAuth.enabled) {
        headers = clearAuthHeaders(headers);
      }

      // 保存原始请求头（清理后、转换前）
      const originalRequestHeaders = { ...headers };

      const upstreamUrl = joinUrl(matchedRoute.upstreamBaseUrl, upstreamPath, url.search);

      let bodyBuffer: Buffer | undefined;
      const expectsBody = method !== 'GET' && method !== 'HEAD';

      if (expectsBody) {
        bodyBuffer = await readRequestBody(req, { maxBytes: 20 * 1024 * 1024 });
        originalBodyBuffer = bodyBuffer; // 保存原始请求体

        const contentType = req.headers['content-type'];
        if (shouldParseJson(Array.isArray(contentType) ? contentType[0] : contentType)) {
          try {
            jsonBody = JSON.parse(bodyBuffer.toString('utf-8'));
          } catch {
            // Keep passthrough behavior when JSON is invalid; upstream will reject if needed.
            jsonBody = undefined;
          }
        }
      }

      if (jsonBody && typeof jsonBody === 'object') {
        if (matchedRoute.client === 'claude') {
          const result = mutateClaudeBody({
            body: jsonBody,
            method: method,
            path: upstreamPath,
            rules: config.rules,
          });
          jsonBody = result.body;
          matches = result.matches;
        } else if (matchedRoute.client === 'codex') {
          const result = mutateCodexBody({
            body: jsonBody,
            method: method,
            path: upstreamPath,
            rules: config.rules,
          });
          jsonBody = result.body;
          matches = result.matches;
          warnings.push(...result.warnings);
        } else if (matchedRoute.client === 'gemini') {
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

      // ========== 注入上游认证（新增）==========
      if (matchedRoute.supplier.auth) {
        if (matchedRoute.supplier.auth.type === 'bearer' && matchedRoute.supplier.auth.token) {
          headers['authorization'] = `Bearer ${matchedRoute.supplier.auth.token}`;
          if (config.debug) {
            logger.debug(`[UpstreamAuth] 注入 Bearer token (***REDACTED***)`);
          }
        } else if (
          matchedRoute.supplier.auth.type === 'header' &&
          matchedRoute.supplier.auth.headerName &&
          matchedRoute.supplier.auth.headerValue
        ) {
          headers[matchedRoute.supplier.auth.headerName] =
            matchedRoute.supplier.auth.headerValue;
          if (config.debug) {
            logger.debug(
              `[UpstreamAuth] 注入 header: ${matchedRoute.supplier.auth.headerName} (***REDACTED***)`,
            );
          }
        }
      }

      // 保存最终请求头（协议转换后、认证注入后）
      const finalRequestHeaders = { ...headers };

      if (config.debug) {
        logger.debug(
          `[promptxy] ${matchedRoute.client.toUpperCase()} ${method} ${url.pathname} -> ${upstreamUrl} (${summarizeMatches(
            matches,
          )}${warnings.length ? ` warnings=${warnings.length}` : ''})`,
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
            ? Buffer.from(JSON.stringify(jsonBody)).toString()
            : bodyBuffer?.toString()
          : undefined,
        redirect: 'manual',
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

      // 检查是否为 SSE 响应
      const contentType = upstreamResponse.headers.get('content-type');
      const isSSE = isSSEResponse(contentType);

      // 收集响应体用于记录（同时流式传递给客户端）
      const responseBodyChunks: Buffer[] = [];
      const upstreamStream = Readable.fromWeb(upstreamResponse.body as any);

      upstreamStream.on('data', (chunk: Buffer) => {
        responseBodyChunks.push(chunk);
      });

      // 直接透传响应流
      upstreamStream.pipe(res);

      // 记录请求到数据库（在响应流结束后）
      const duration = Date.now() - startTime;
      const savedRequestId = generateRequestId();
      requestId = savedRequestId;

      // 保存响应状态和头信息（在回调外，避免 TypeScript 类型问题）
      const responseStatus = upstreamResponse.status;
      const responseHeadersStr = JSON.stringify(
        Object.fromEntries(Array.from(upstreamResponse.headers.entries())),
      );

      // 保存请求路径和客户端信息
      const savedClient = matchedRoute.client;
      const savedPath = upstreamPath;
      const savedJsonBody = jsonBody;

      // 监听响应流结束，保存包含响应体的记录
      upstreamStream.on('end', async () => {
        // 检查路径是否需要过滤
        const filteredPaths = await getFilteredPaths();
        if (shouldFilterPath(savedPath, filteredPaths)) {
          // 跳过记录，但仍然广播事件
          broadcastRequest({
            id: savedRequestId,
            timestamp: Date.now(),
            client: matchedRoute.client,
            path: upstreamPath || savedPath,
            method: method,
            matchedRules: matches.map(m => m.ruleId),
          });
          return;
        }

        const responseBodyBuffer = Buffer.concat(responseBodyChunks);
        let responseBodyStr: string | undefined;

        // 尝试解析为 JSON，如果失败则保存原始文本
        const contentType = upstreamResponse?.headers?.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            const jsonBody = JSON.parse(responseBodyBuffer.toString('utf-8'));
            responseBodyStr = JSON.stringify(jsonBody);
          } catch {
            responseBodyStr = responseBodyBuffer.toString('utf-8');
          }
        } else {
          // 非 JSON 响应，限制保存大小（最多 10KB）
          const maxSize = 10 * 1024;
          responseBodyStr =
            responseBodyBuffer.length > maxSize
              ? responseBodyBuffer.subarray(0, maxSize).toString('utf-8') + '... (truncated)'
              : responseBodyBuffer.toString('utf-8');
        }

        const record: RequestRecord = {
          id: savedRequestId,
          timestamp: Date.now(),
          client: savedClient,
          path: savedPath,
          method: method,
          originalBody: originalBodyBuffer ? originalBodyBuffer.toString('utf-8') : '{}',
          modifiedBody: savedJsonBody
            ? JSON.stringify(savedJsonBody)
            : (originalBodyBuffer?.toString('utf-8') ?? '{}'),
          requestHeaders: JSON.stringify(sanitizeHeaders(finalRequestHeaders)),
          originalRequestHeaders: JSON.stringify(sanitizeHeaders(originalRequestHeaders)),
          requestSize: originalBodyBuffer ? originalBodyBuffer.length : undefined,
          responseSize: responseBodyBuffer.length,
          matchedRules: JSON.stringify(matches),
          responseStatus: responseStatus,
          durationMs: duration,
          responseHeaders: responseHeadersStr,
          responseBody: responseBodyStr,
          error: undefined,
          // 供应商信息
          supplierId: route?.supplier?.id,
          supplierName: route?.supplier?.name,
        };

        // 保存到数据库
        try {
          await insertRequestRecord(record);
        } catch (err: any) {
          logger.debug(`[promptxy] Failed to save request record: ${err?.message}`);
        }
      });

      // SSE 广播
      const sseData: SSERequestEvent = {
        id: savedRequestId,
        timestamp: Date.now(),
        client: matchedRoute.client,
        path: upstreamPath,
        method: method,
        matchedRules: matches.map(m => m.ruleId),
      };
      broadcastRequest(sseData);
    } catch (errorCaught: any) {
      error = errorCaught?.message ?? String(errorCaught);
      jsonError(res, 500, {
        error: 'promptxy_error',
        message: error,
      });

      // 记录错误请求
      if (route && upstreamPath) {
        const duration = Date.now() - startTime;
        requestId = requestId ?? generateRequestId();

        // 检查路径是否需要过滤
        const filteredPaths = await getFilteredPaths();
        if (!shouldFilterPath(upstreamPath, filteredPaths)) {
          // 在错误情况下，从原始请求重新获取 headers
          const errorRequestHeaders = cloneAndFilterRequestHeaders(req.headers);
          const record: RequestRecord = {
            id: requestId,
            timestamp: Date.now(),
            client: route.client,
            path: upstreamPath,
            method: method,
            originalBody: originalBodyBuffer ? originalBodyBuffer.toString('utf-8') : '{}',
            modifiedBody: jsonBody
              ? JSON.stringify(jsonBody)
              : (originalBodyBuffer?.toString('utf-8') ?? '{}'),
            requestHeaders: JSON.stringify(sanitizeHeaders(errorRequestHeaders)),
            originalRequestHeaders: JSON.stringify(sanitizeHeaders(errorRequestHeaders)),
            requestSize: originalBodyBuffer ? originalBodyBuffer.length : undefined,
            matchedRules: JSON.stringify(matches),
            responseStatus: undefined,
            durationMs: duration,
            responseHeaders: undefined,
            error: error,
            // 供应商信息
            supplierId: route?.supplier?.id,
            supplierName: route?.supplier?.name,
          };

          try {
            await insertRequestRecord(record);
          } catch (err: any) {
            logger.debug(`[promptxy] Failed to save error request record: ${err?.message}`);
          }
        }

        const sseData: SSERequestEvent = {
          id: requestId,
          timestamp: Date.now(),
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
