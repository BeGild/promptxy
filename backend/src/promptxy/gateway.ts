import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { mutateClaudeBody, handleClaudeCountTokens } from './adapters/claude.js';
import { mutateCodexBody } from './adapters/codex.js';
import { mutateGeminiBody } from './adapters/gemini.js';
import { detectOpenAICountTokensSupport } from './utils/upstream-detector.js';
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
  Route,
  LocalService,
  TransformerType,
} from './types.js';
import {
  insertRequestRecord,
  getFilteredPaths,
  shouldFilterPath,
  generateRequestId,
} from './database.js';
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
  handleGetRoutes,
  handleCreateRoute,
  handleUpdateRoute,
  handleDeleteRoute,
  handleToggleRoute,
  handleRebuildIndex,
  sendJson,
  type SSEConnections,
} from './api-handlers.js';
import { createProtocolTransformer } from './transformers/index.js';
import { createSSETransformStream, isSSEResponse } from './transformers/index.js';
import { authenticateRequest, clearAuthHeaders } from './transformers/auth.js';
import {
  detectClaudeModelTier,
  parseOpenAIModelSpec,
  resolveClaudeMappedModelSpec,
} from './model-mapping.js';
import { parseSSEToEvents, isSSEContent } from './utils/sse-parser.js';

type RouteInfo = {
  client: PromptxyClient;
  localService: LocalService;
  pathPrefix: string; // 请求路径前缀（用于 stripPrefix）
  upstreamBaseUrl: string;
  supplier: Supplier; // 完整的 supplier 配置（包含 auth）
  route: Route; // 命中的 route
};

function matchLocalService(pathname: string): {
  client: PromptxyClient;
  localService: LocalService;
  pathPrefix: string;
} | null {
  if (pathname.startsWith('/claude/'))
    return { client: 'claude', localService: 'claude', pathPrefix: '/claude' };
  if (pathname === '/claude')
    return { client: 'claude', localService: 'claude', pathPrefix: '/claude' };

  if (pathname.startsWith('/codex/'))
    return { client: 'codex', localService: 'codex', pathPrefix: '/codex' };
  if (pathname === '/codex')
    return { client: 'codex', localService: 'codex', pathPrefix: '/codex' };

  if (pathname.startsWith('/gemini/'))
    return { client: 'gemini', localService: 'gemini', pathPrefix: '/gemini' };
  if (pathname === '/gemini')
    return { client: 'gemini', localService: 'gemini', pathPrefix: '/gemini' };

  return null;
}

function validateRouteConstraints(route: Route, supplier: Supplier): string | null {
  // Codex/Gemini：必须透明转发，且 supplier 协议必须匹配
  if (route.localService === 'codex') {
    if (supplier.protocol !== 'openai') return 'Codex 入口仅允许对接 openai 协议供应商';
    if (route.transformer !== 'none')
      return 'Codex 入口不允许跨协议转换（transformer 必须为 none）';
  }
  if (route.localService === 'gemini') {
    if (supplier.protocol !== 'gemini') return 'Gemini 入口仅允许对接 gemini 协议供应商';
    if (route.transformer !== 'none')
      return 'Gemini 入口不允许跨协议转换（transformer 必须为 none）';
  }

  // Claude：允许跨协议，但 transformer 必须与 supplier 协议一致
  if (route.localService === 'claude') {
    if (supplier.protocol === 'anthropic' && route.transformer !== 'none') {
      return 'Claude → anthropic 供应商不需要转换（transformer 必须为 none）';
    }
    if (supplier.protocol === 'openai' && route.transformer !== 'codex') {
      return 'Claude → openai 供应商必须使用 codex 转换器（Responses）';
    }
    if (supplier.protocol === 'gemini' && route.transformer !== 'gemini') {
      return 'Claude → gemini 供应商必须使用 gemini 转换器';
    }
  }

  return null;
}

function resolveRouteByPath(
  pathname: string,
  routes: Route[],
  suppliers: Supplier[],
): RouteInfo | null {
  const local = matchLocalService(pathname);
  if (!local) return null;

  const enabledRoutes = (routes || []).filter(
    r => r.localService === local.localService && r.enabled,
  );
  if (enabledRoutes.length === 0) {
    // 允许返回一个“占位 route”，上层能给出明确的 503 提示
    return {
      client: local.client,
      localService: local.localService,
      pathPrefix: local.pathPrefix,
      upstreamBaseUrl: '',
      supplier: {
        id: 'missing',
        name: 'missing',
        displayName: 'missing',
        baseUrl: '',
        protocol: 'anthropic',
        enabled: false,
      } as any,
      route: {
        id: 'missing',
        localService: local.localService,
        supplierId: 'missing',
        transformer: 'none' as TransformerType,
        enabled: false,
      },
    };
  }

  const route = enabledRoutes[0]!;
  const supplier = suppliers.find(s => s.id === route.supplierId);

  // 供应商缺失/禁用：返回占位信息，由上层返回 503
  if (!supplier || !supplier.enabled) {
    return {
      client: local.client,
      localService: local.localService,
      pathPrefix: local.pathPrefix,
      upstreamBaseUrl: '',
      supplier: (supplier ||
        ({
          id: route.supplierId,
          name: 'missing',
          displayName: 'missing',
          baseUrl: '',
          protocol: 'anthropic',
          enabled: false,
        } as any)) as Supplier,
      route,
    };
  }

  const constraintError = validateRouteConstraints(route, supplier);
  if (constraintError) {
    return {
      client: local.client,
      localService: local.localService,
      pathPrefix: local.pathPrefix,
      upstreamBaseUrl: '',
      supplier,
      route,
    };
  }

  return {
    client: local.client,
    localService: local.localService,
    pathPrefix: local.pathPrefix,
    upstreamBaseUrl: supplier.baseUrl,
    supplier,
    route,
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
 * 检测是否为 warmup 请求
 *
 * Warmup 请求特征（参考 claude-relay-service）：
 * - 只有单条消息
 * - 没有附带 tools
 *
 * 注意：单条消息+无 tools 过于宽泛，会误伤正常对话（例如用户首次问“hi”）。
 * 这里采取更保守的判定：只有当该唯一消息的可提取文本为空时，才认为是 warmup。
 *
 * 这种请求通常是 Claude Code 的预热/探测请求，对 codex 供应商无效（可直接返回空结果节省 token）。
 *
 * @param body - 请求体
 * @returns 是否为 warmup 请求
 */
function isWarmupRequest(body: any): boolean {
  if (!body || typeof body !== 'object') return false;

  const messages = body?.messages;
  const tools = body?.tools;

  // 必须有 messages 数组
  if (!Array.isArray(messages) || messages.length !== 1) return false;

  // 必须没有 tools（或 tools 为空）
  if (tools && Array.isArray(tools) && tools.length > 0) return false;

  const msg = messages[0];
  if (!msg || typeof msg !== 'object') return false;

  // 提取“可视文本”
  let text = '';
  if (typeof msg.content === 'string') {
    text = msg.content;
  } else if (Array.isArray(msg.content)) {
    text = msg.content
      .filter((b: any) => b && typeof b === 'object' && b.type === 'text')
      .map((b: any) => b.text || b.input_text || '')
      .join('');
  }

  // 仅当内容为空才认为是 warmup（保守，避免误伤真实请求）
  if (typeof text === 'string' && text.trim() === '') return true;

  return false;
}

/**
 * 检测是否为 "count" 探测请求
 *
 * 这种请求特征：只有一个 message，内容仅为 "count" 文本
 * 通常是 Claude Code 的另一种探测请求，对 codex 供应商无效
 *
 * @param body - 请求体
 * @returns 是否为 count 探测请求
 */
function isCountTokensRequest(path: string): boolean {
  return path === '/v1/messages/count_tokens';
}

function isCountProbeRequest(body: any): boolean {
  if (!body || typeof body !== 'object') return false;

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length !== 1) return false;

  const msg = messages[0];
  if (!msg || typeof msg !== 'object') return false;

  // 处理字符串格式 content: { content: "count" }
  if (typeof msg.content === 'string') {
    return msg.content.trim() === 'count';
  }

  // 处理数组格式 content: { content: [{ type: "text", text: "count" }] }
  if (Array.isArray(msg.content)) {
    // 只有一个 content block 且是 text 类型，内容为 "count"
    if (msg.content.length === 1) {
      const block = msg.content[0];
      if (block && typeof block === 'object' && block.type === 'text') {
        const text = block.text || block.input_text || '';
        return text.trim() === 'count';
      }
    }
  }

  return false;
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
function handleFrontendStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): boolean {
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
      'Cache-Control': 'public, max-age=3600',
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
  const protocolTransformer = createProtocolTransformer();

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
    let transformerChain: string[] = [];
    let transformTrace: any | undefined;
    // 协议转换后的变量（在 try 块外定义，以便在 catch 块中访问）
    let effectiveUpstreamPath: string;
    let effectiveHeaders: Record<string, string>;
    let effectiveBody: any;

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

        if (method === 'POST' && url.pathname.match(/\/_promptxy\/suppliers\/[^/]+\/toggle/)) {
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

        // ========== 路由配置 API（新增）==========
        // 获取路由列表
        if (method === 'GET' && url.pathname === '/_promptxy/routes') {
          await handleGetRoutes(req, res, config);
          return;
        }

        // 创建路由
        if (method === 'POST' && url.pathname === '/_promptxy/routes') {
          await handleCreateRoute(req, res, config);
          return;
        }

        // 更新路由
        if (method === 'PUT' && url.pathname.startsWith('/_promptxy/routes/')) {
          await handleUpdateRoute(req, res, config, url);
          return;
        }

        // 删除路由
        if (method === 'DELETE' && url.pathname.startsWith('/_promptxy/routes/')) {
          await handleDeleteRoute(req, res, config, url);
          return;
        }

        // 切换路由状态
        if (method === 'POST' && url.pathname.match(/\/_promptxy\/routes\/[^/]+\/toggle/)) {
          await handleToggleRoute(req, res, config, url);
          return;
        }

        // 索引重建（新增）
        if (method === 'POST' && url.pathname === '/_promptxy/rebuild-index') {
          await handleRebuildIndex(req, res);
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

      // 根据路径查找本地服务与启用路由（Route → Supplier）
      route = resolveRouteByPath(url.pathname, config.routes, config.suppliers);
      if (!route) {
        jsonError(res, 404, { error: 'Unknown gateway prefix', path: url.pathname });
        return;
      }

      // TypeScript 类型守卫：从这里开始 route 一定不是 null
      const matchedRoute: RouteInfo = route;

      // 未配置启用路由：明确提示用户去配置
      if (!matchedRoute.route.enabled) {
        jsonError(res, 503, {
          error: 'route_not_configured',
          message: `未配置启用路由：${matchedRoute.pathPrefix} 请在路由配置页面启用一个上游供应商`,
          path: url.pathname,
        });
        return;
      }

      // 供应商缺失/被禁用/路由不合法：明确提示
      if (!matchedRoute.supplier.enabled || !matchedRoute.upstreamBaseUrl) {
        const reason = validateRouteConstraints(matchedRoute.route, matchedRoute.supplier);
        jsonError(res, reason ? 400 : 503, {
          error: reason ? 'route_invalid' : 'supplier_unavailable',
          message:
            reason ||
            `路由已启用但供应商不可用（不存在或已禁用）：supplierId=${matchedRoute.route.supplierId}`,
          routeId: matchedRoute.route.id,
          supplierId: matchedRoute.route.supplierId,
          path: url.pathname,
        });
        return;
      }

      upstreamPath = stripPrefix(url.pathname, matchedRoute.pathPrefix);

      // ========== 路径过滤：Codex 供应商仅支持 /v1/messages ==========
      if (
        matchedRoute.localService === 'claude' &&
        matchedRoute.route.transformer === 'codex' &&
        upstreamPath !== '/v1/messages'
      ) {
        jsonError(res, 404, {
          error: 'not_found',
          message: 'Codex 供应商仅支持 /v1/messages 端点',
          path: upstreamPath,
        });
        return;
      }

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
          logger.debug(`[GatewayAuth] 鉴权通过，使用 header: ${authHeaderUsed}`);
        }
      }

      // ========== 清理入站鉴权头（避免误传到上游）==========
      let headers = cloneAndFilterRequestHeaders(req.headers);
      if (config.gatewayAuth && config.gatewayAuth.enabled) {
        headers = clearAuthHeaders(headers);
      }

      // 保存原始请求头（清理后、转换前）
      const originalRequestHeaders = { ...headers };

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

      // ========== Warmup 请求过滤：跳过无意义的预热请求 ==========
      // 参考项目：claude-relay-service
      // Warmup 请求特征：单条消息 + 无 tools，通常是 Claude Code 的探测请求
      if (
        matchedRoute.localService === 'claude' &&
        matchedRoute.route.transformer === 'codex' &&
        isWarmupRequest(jsonBody)
      ) {
        if (config.debug) {
          logger.debug(`[promptxy] 检测到 warmup 请求，跳过转发以节省 token`);
        }
        // 返回空响应，快速处理
        jsonError(res, 200, {
          type: 'result',
          role: 'assistant',
          content: [{ type: 'text', text: '' }],
        });
        return;
      }

      // ========== Count 探测请求过滤：跳过 "count" 文本探测 ==========
      // 这种请求只有一个 message，内容仅为 "count"
      // 对 codex 供应商无效，直接返回空响应
      if (
        matchedRoute.localService === 'claude' &&
        matchedRoute.route.transformer === 'codex' &&
        isCountProbeRequest(jsonBody)
      ) {
        if (config.debug) {
          logger.debug(`[promptxy] 检测到 count 探测请求，跳过转发以节省 token`);
        }
        // 返回空响应，快速处理
        jsonError(res, 200, {
          type: 'result',
          role: 'assistant',
          content: [{ type: 'text', text: '' }],
        });
        return;
      }

      // ========== 协议转换（仅 Claude 入口允许跨协议）==========
      effectiveUpstreamPath = upstreamPath!;
      effectiveHeaders = headers;
      effectiveBody = jsonBody;
      let needsResponseTransform = false;

      if (matchedRoute.localService === 'claude' && matchedRoute.route.transformer !== 'none') {
        // Claude Code 模型映射：将 haiku/sonnet/opus 映射为上游可识别的 modelSpec
        // - 识别不到默认 sonnet
        // - haiku/opus 未配置则回落 sonnet
        // - 若完全未配置映射则返回 400（避免 silent 失败）
        const tier = detectClaudeModelTier((jsonBody as any)?.model);
        const mapping = resolveClaudeMappedModelSpec(
          (matchedRoute.route as any).claudeModelMap,
          tier,
        );
        if (!mapping.ok) {
          jsonError(res, 400, {
            error: 'claude_model_mapping_missing',
            message: mapping.error,
            tier,
            routeId: matchedRoute.route.id,
            supplierId: matchedRoute.route.supplierId,
            path: url.pathname,
          });
          return;
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

        if (matchedRoute.client === 'claude' && isCountTokensRequest(upstreamPath!)) {
          try {
            let capabilities;

            if (matchedRoute.supplier.protocol === 'openai') {
              capabilities = await detectOpenAICountTokensSupport(matchedRoute.supplier);
            }

            const result = await handleClaudeCountTokens({
              body: jsonBody,
              capabilities,
              baseUrl: matchedRoute.upstreamBaseUrl,
              auth:
                matchedRoute.supplier.auth?.type === 'none'
                  ? undefined
                  : matchedRoute.supplier.auth,
            });

            const bodyStr = JSON.stringify(result);
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.setHeader('content-length', Buffer.byteLength(bodyStr));
            res.end(bodyStr);
            return;
          } catch (error: any) {
            jsonError(res, 400, {
              error: 'count_tokens_error',
              message: error?.message || 'Failed to count tokens',
            });
            return;
          }
        }

        if (jsonBody && typeof jsonBody === 'object') {
          (jsonBody as any).model = mapping.modelSpec;
        }

        transformerChain = [matchedRoute.route.transformer];
        const streamFlag = Boolean(
          jsonBody &&
          typeof jsonBody === 'object' &&
          'stream' in jsonBody &&
          (jsonBody as any).stream,
        );

        const transformResult = await protocolTransformer.transform({
          supplier: {
            id: matchedRoute.supplier.id,
            name: matchedRoute.supplier.name,
            baseUrl: matchedRoute.supplier.baseUrl,
            auth: matchedRoute.supplier.auth,
            transformer: { default: transformerChain },
          },
          request: {
            method: method,
            path: upstreamPath,
            headers: headers,
            body: jsonBody,
          },
          stream: streamFlag,
        });

        transformTrace = transformResult.trace;
        needsResponseTransform = transformResult.needsResponseTransform;
        effectiveUpstreamPath = transformResult.request.path;
        effectiveHeaders = transformResult.request.headers;
        effectiveBody = transformResult.request.body;
      }

      // ========== OpenAI/Codex：modelSpec 解析 reasoning.effort（透明转发与 Claude→Codex 均适用）==========
      if (
        matchedRoute.supplier.protocol === 'openai' &&
        effectiveBody &&
        typeof effectiveBody === 'object'
      ) {
        const parsed = parseOpenAIModelSpec(
          (effectiveBody as any).model,
          (matchedRoute.supplier as any).reasoningEfforts,
        );
        if (parsed && parsed.reasoningEffort) {
          (effectiveBody as any).model = parsed.model;

          const existing = (effectiveBody as any).reasoning;
          if (!existing || typeof existing !== 'object') {
            (effectiveBody as any).reasoning = { effort: parsed.reasoningEffort };
          } else {
            (effectiveBody as any).reasoning = {
              ...(existing as any),
              effort: parsed.reasoningEffort,
            };
          }
        } else if (parsed) {
          (effectiveBody as any).model = parsed.model;
        }
      }

      // ========== 注入上游认证（新增）==========
      // 协议转换后的 headers 需要注入认证
      headers = effectiveHeaders;
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
          headers[matchedRoute.supplier.auth.headerName] = matchedRoute.supplier.auth.headerValue;
          if (config.debug) {
            logger.debug(
              `[UpstreamAuth] 注入 header: ${matchedRoute.supplier.auth.headerName} (***REDACTED***)`,
            );
          }
        }
      }

      // 保存最终请求头（协议转换后、认证注入后）
      const finalRequestHeaders = { ...headers };

      const upstreamUrl = joinUrl(matchedRoute.upstreamBaseUrl, effectiveUpstreamPath, url.search);

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
          ? effectiveBody
            ? Buffer.from(JSON.stringify(effectiveBody)).toString()
            : bodyBuffer?.toString()
          : undefined,
        redirect: 'manual',
      });

      const upstreamContentType = upstreamResponse.headers.get('content-type') || '';
      const isSSE = isSSEResponse(upstreamContentType);

      const responseHeaders = filterResponseHeaders(upstreamResponse.headers);
      if (needsResponseTransform) {
        delete responseHeaders['content-length'];
      }

      // 非流式：必要时转换 JSON 响应体（Claude 入口跨协议）
      if (!isSSE && needsResponseTransform) {
        const raw = await upstreamResponse.text();
        let parsed: any = raw;
        if (upstreamContentType.includes('application/json')) {
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
        }

        // 诊断信息：保存上游原始响应片段到 trace（避免只看到“转换后空内容”）
        // - 仅在非 2xx 时保存（减少噪音）
        // - 仅保存截断片段，避免日志/DB 过大
        if (transformTrace && upstreamResponse.status >= 400) {
          const snippetLimit = 8 * 1024;
          const snippet =
            raw.length > snippetLimit ? `${raw.slice(0, snippetLimit)}...(truncated)` : raw;
          transformTrace.upstreamStatus = upstreamResponse.status;
          transformTrace.upstreamContentType = upstreamContentType;
          transformTrace.upstreamBodySnippet = snippet;
        }

        const transformed = await protocolTransformer.transformResponse(
          {
            id: matchedRoute.supplier.id,
            name: matchedRoute.supplier.name,
            baseUrl: matchedRoute.supplier.baseUrl,
            transformer: { default: transformerChain },
          },
          parsed,
          upstreamContentType,
        );

        const bodyStr = JSON.stringify(transformed);
        res.statusCode = upstreamResponse.status;
        res.setHeader('content-type', 'application/json');
        res.setHeader('content-length', Buffer.byteLength(bodyStr));
        for (const [key, value] of Object.entries(responseHeaders)) {
          if (key === 'content-type' || key === 'content-length') continue;
          try {
            res.setHeader(key, value);
          } catch {
            // Ignore invalid headers for Node response.
          }
        }
        res.end(bodyStr);

        const duration = Date.now() - startTime;
        const savedRequestId = generateRequestId();
        requestId = savedRequestId;

        const filteredPaths = await getFilteredPaths();
        if (!shouldFilterPath(upstreamPath, filteredPaths)) {
          const record: RequestRecord = {
            id: savedRequestId,
            timestamp: Date.now(),
            client: matchedRoute.client,
            path: upstreamPath,
            method: method,
            originalBody: originalBodyBuffer ? originalBodyBuffer.toString('utf-8') : '{}',
            modifiedBody: effectiveBody
              ? JSON.stringify(effectiveBody)
              : (originalBodyBuffer?.toString('utf-8') ?? '{}'),
            requestHeaders: finalRequestHeaders,
            originalRequestHeaders: originalRequestHeaders,
            requestSize: originalBodyBuffer ? originalBodyBuffer.length : undefined,
            responseSize: Buffer.byteLength(bodyStr),
            matchedRules: JSON.stringify(matches),
            responseStatus: upstreamResponse.status,
            durationMs: duration,
            responseHeaders: { ...responseHeaders, 'content-type': 'application/json' },
            responseBody: bodyStr,
            error: undefined,
            routeId: matchedRoute.route.id,
            supplierId: matchedRoute.supplier.id,
            supplierName: matchedRoute.supplier.name,
            supplierBaseUrl: matchedRoute.supplier.baseUrl,
            transformerChain: JSON.stringify(transformerChain),
            transformTrace: transformTrace ? JSON.stringify(transformTrace) : undefined,
          };

          try {
            await insertRequestRecord(record);
          } catch (err: any) {
            logger.error(`[promptxy] Failed to save request record: ${err?.message}`);
          }
        }

        broadcastRequest({
          id: savedRequestId,
          timestamp: Date.now(),
          client: matchedRoute.client,
          path: upstreamPath,
          method: method,
          matchedRules: matches.map(m => m.ruleId),
        });
        return;
      }

      // 流式：透传或在 pipe 中转换 SSE
      res.statusCode = upstreamResponse.status;
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

      const responseBodyChunks: Buffer[] = [];
      const upstreamStream = Readable.fromWeb(upstreamResponse.body as any);
      const transformStream = createSSETransformStream(transformerChain[0]);
      const outboundStream =
        isSSE && needsResponseTransform && transformerChain.length > 0
          ? upstreamStream.pipe(transformStream as any)
          : upstreamStream;

      (outboundStream as any).on('data', (chunk: Buffer) => {
        responseBodyChunks.push(chunk);
      });

      (outboundStream as any).pipe(res);

      // 记录请求到数据库（在响应流结束后）
      const duration = Date.now() - startTime;
      const savedRequestId = generateRequestId();
      requestId = savedRequestId;

      // 保存响应状态和头信息（在回调外，避免 TypeScript 类型问题）
      const responseStatus = upstreamResponse.status;
      const responseHeadersStr = JSON.stringify(responseHeaders);

      // 保存请求路径和客户端信息
      const savedClient = matchedRoute.client;
      const savedPath = upstreamPath;
      const savedJsonBody = effectiveBody;

      // 监听响应流结束，保存包含响应体的记录
      outboundStream.on('end', async () => {
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

        // 完整保存响应体，不截断
        const contentType = upstreamContentType;
        if (contentType.includes('application/json')) {
          try {
            const jsonBody = JSON.parse(responseBodyBuffer.toString('utf-8'));
            responseBodyStr = JSON.stringify(jsonBody);
          } catch {
            responseBodyStr = responseBodyBuffer.toString('utf-8');
          }
        } else {
          // 非 JSON 响应：检测并解析 SSE
          const rawResponse = responseBodyBuffer.toString('utf-8');
          if (isSSEContent(rawResponse)) {
            // SSE 响应：解析为事件数组
            responseBodyStr = parseSSEToEvents(rawResponse) as any;
          } else {
            responseBodyStr = rawResponse;
          }
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
          requestHeaders: finalRequestHeaders,
          originalRequestHeaders: originalRequestHeaders,
          requestSize: originalBodyBuffer ? originalBodyBuffer.length : undefined,
          responseSize: responseBodyBuffer.length,
          matchedRules: JSON.stringify(matches),
          responseStatus: responseStatus,
          durationMs: duration,
          responseHeaders: responseHeadersStr,
          responseBody: responseBodyStr,
          error: undefined,
          // 路由 / 供应商 / 转换信息
          routeId: matchedRoute.route.id,
          supplierId: matchedRoute.supplier.id,
          supplierName: matchedRoute.supplier.name,
          supplierBaseUrl: matchedRoute.supplier.baseUrl,
          transformerChain: JSON.stringify(transformerChain),
          transformTrace: transformTrace ? JSON.stringify(transformTrace) : undefined,
        };

        // 保存到数据库
        try {
          await insertRequestRecord(record);
        } catch (err: any) {
          logger.error(`[promptxy] Failed to save request record: ${err?.message}`);
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
            modifiedBody: effectiveBody
              ? JSON.stringify(effectiveBody)
              : (originalBodyBuffer?.toString('utf-8') ?? '{}'),
            requestHeaders: errorRequestHeaders,
            originalRequestHeaders: errorRequestHeaders,
            requestSize: originalBodyBuffer ? originalBodyBuffer.length : undefined,
            matchedRules: JSON.stringify(matches),
            responseStatus: undefined,
            durationMs: duration,
            responseHeaders: undefined,
            error: error,
            // 路由 / 供应商 / 转换信息
            routeId: route.route?.id,
            supplierId: route?.supplier?.id,
            supplierName: route?.supplier?.name,
            supplierBaseUrl: route?.supplier?.baseUrl,
            transformerChain: JSON.stringify(transformerChain),
            transformTrace: transformTrace ? JSON.stringify(transformTrace) : undefined,
          };

          try {
            await insertRequestRecord(record);
          } catch (err: any) {
            logger.error(`[promptxy] Failed to save error request record: ${err?.message}`);
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
