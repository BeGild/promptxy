import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable, PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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
import { countClaudeTokens } from './utils/token-counter.js';
import { authenticateRequest, clearAuthHeaders } from './transformers/auth.js';
import { parseOpenAIModelSpec, resolveModelMapping } from './model-mapping.js';
import { parseSSEToEvents, isSSEContent } from './utils/sse-parser.js';
import { deriveRoutePlan } from './routing/index.js';
import type { RequestContext } from './gateway-contracts.js';
import { deriveTransformPlan } from './transform/index.js';
import { executeUpstream } from './proxying/index.js';
import { streamResponse } from './streaming/index.js';

type RouteInfo = {
  client: PromptxyClient;
  localService: LocalService;
  pathPrefix: string; // 请求路径前缀（用于 stripPrefix）
  upstreamBaseUrl: string;
  supplier: Supplier; // 完整的 supplier 配置（包含 auth）
  route: Route; // 命中的 route
};

type RouteResolutionErrorCode =
  | 'model_missing'
  | 'model_mapping_no_match'
  | 'supplier_not_found'
  | 'supplier_disabled'
  | 'route_constraint_violation';

type RouteResolveResult =
  | {
      ok: true;
      routeInfo: RouteInfo;
      effectiveModel: string | undefined;
      transformer: TransformerType;
    }
  | {
      ok: false;
      status: number;
      error: RouteResolutionErrorCode;
      message: string;
      routeId: string;
      supplierId?: string;
    };

type EffectiveModelMappingResult =
  | {
      ok: true;
      supplier: Supplier;
      model: string | undefined;
      transformer: TransformerType;
    }
  | {
      ok: false;
      status: number;
      error: Exclude<RouteResolutionErrorCode, 'route_constraint_violation'>;
      message: string;
      routeId: string;
      supplierId?: string;
    };

// CLIProxyAPI codex executor defaults (strict alignment option).
// Ref: refence/CLIProxyAPI/internal/runtime/executor/codex_executor.go applyCodexHeaders()
const CLI_PROXY_CODEX_VERSION = '0.21.0';
const CLI_PROXY_CODEX_OPENAI_BETA = 'responses=experimental';
const CLI_PROXY_CODEX_DEFAULT_ORIGINATOR = 'codex_cli_rs';
const CLI_PROXY_CODEX_DEFAULT_USER_AGENT =
  'codex_cli_rs/0.50.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464';

function ensureHeader(headers: Record<string, string>, key: string, value: string): void {
  const existing = headers[key];
  if (typeof existing === 'string' && existing.trim() !== '') return;
  headers[key] = value;
}

function applyCLIProxyCodexHeaders(
  headers: Record<string, string>,
  options: {
    /** If present, we try to align conversation/session headers to the same ID. */
    sessionId?: string;
  },
): void {
  // CLIProxyAPI unconditionally sets the content type and SSE accept headers.
  headers['content-type'] = 'application/json';
  ensureHeader(headers, 'version', CLI_PROXY_CODEX_VERSION);
  ensureHeader(headers, 'openai-beta', CLI_PROXY_CODEX_OPENAI_BETA);

  // CLIProxyAPI uses `Session_id` for /responses and keeps SSE defaults for Codex.
  // We keep it stable when a session id exists (prompt_cache_key, etc.), otherwise generate one.
  const sid = (options.sessionId || '').trim() || randomUUID();
  ensureHeader(headers, 'session_id', sid);
  ensureHeader(headers, 'conversation_id', sid);

  // CLIProxyAPI always forces SSE headers on Codex upstream requests.
  headers['accept'] = 'text/event-stream';
  headers['connection'] = 'keep-alive';

  // "Originator" is a Codex CLI header used widely by official clients (codex-rs).
  // CLIProxyAPI only sets it for non-API-key auth; we cannot reliably infer that here,
  // so we default it in a best-effort "ensure" manner.
  ensureHeader(headers, 'originator', CLI_PROXY_CODEX_DEFAULT_ORIGINATOR);
  ensureHeader(headers, 'user-agent', CLI_PROXY_CODEX_DEFAULT_USER_AGENT);
}

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

function deriveTransformer(
  localService: Route['localService'],
  supplierProtocol: Supplier['protocol'],
): TransformerType {
  if (localService === 'codex') return 'none';
  if (localService === 'gemini') return 'none';

  if (supplierProtocol === 'anthropic') return 'none';
  if (supplierProtocol === 'openai-codex') return 'codex';
  if (supplierProtocol === 'openai-chat') return 'openai-chat';
  if (supplierProtocol === 'gemini') return 'gemini';

  return 'none';
}

/**
 * 根据供应商协议获取客户端类型
 * 用于前端显示正确的图标
 */
function getSupplierClient(protocol: Supplier['protocol']): PromptxyClient {
  if (protocol === 'anthropic') return 'claude';
  if (protocol === 'openai-codex') return 'codex';
  if (protocol === 'openai-chat') return 'codex'; // 复用 codex 图标
  if (protocol === 'gemini') return 'gemini';
  return 'claude'; // 默认
}

function validateRouteConstraints(route: Route, supplier: Supplier): string | null {
  // Codex/Gemini：必须透明转发，且 supplier 协议必须匹配
  if (route.localService === 'codex') {
    if (supplier.protocol !== 'openai-codex') return 'Codex 入口仅允许对接 openai-codex 协议供应商';
  }
  if (route.localService === 'gemini') {
    if (supplier.protocol !== 'gemini') return 'Gemini 入口仅允许对接 gemini 协议供应商';
  }

  // Claude：允许跨协议；transformer 由 supplier 协议推断
  if (route.localService === 'claude') {
    // 这里不再校验 route.transformer（字段已移除）
    return null;
  }

  return null;
}

function resolveEffectiveModelMapping(
  inboundModel: string | undefined,
  route: Route,
  suppliers: Supplier[],
): EffectiveModelMappingResult {
  // Codex/Gemini: 使用单一供应商配置
  if (route.localService === 'codex' || route.localService === 'gemini') {
    if (!route.singleSupplierId) {
      return {
        ok: false,
        status: 503,
        error: 'supplier_not_found',
        message: `路由未配置 singleSupplierId：routeId=${route.id}`,
        routeId: route.id,
      };
    }
    const supplier = suppliers.find(s => s.id === route.singleSupplierId);
    if (!supplier) {
      return {
        ok: false,
        status: 503,
        error: 'supplier_not_found',
        message: `供应商不存在：routeId=${route.id} supplierId=${route.singleSupplierId}`,
        routeId: route.id,
        supplierId: route.singleSupplierId,
      };
    }
    if (!supplier.enabled) {
      return {
        ok: false,
        status: 503,
        error: 'supplier_disabled',
        message: `供应商已禁用：routeId=${route.id} supplierId=${supplier.id}`,
        routeId: route.id,
        supplierId: supplier.id,
      };
    }
    return {
      ok: true,
      supplier,
      model: inboundModel,
      transformer: 'none',
    };
  }

  // Claude: 使用模型映射规则
  if (!inboundModel) {
    return {
      ok: false,
      status: 400,
      error: 'model_missing',
      message: `缺少 model 字段：routeId=${route.id}`,
      routeId: route.id,
    };
  }

  const mappingResult = resolveModelMapping(inboundModel, route.modelMappings);
  if (!mappingResult.matched) {
    return {
      ok: false,
      status: 400,
      error: 'model_mapping_no_match',
      message: `未命中任何模型映射规则：routeId=${route.id} model=${inboundModel}`,
      routeId: route.id,
    };
  }

  const supplier = suppliers.find(s => s.id === mappingResult.targetSupplierId);
  if (!supplier) {
    return {
      ok: false,
      status: 503,
      error: 'supplier_not_found',
      message: `供应商不存在：routeId=${route.id} supplierId=${mappingResult.targetSupplierId}`,
      routeId: route.id,
      supplierId: mappingResult.targetSupplierId,
    };
  }
  if (!supplier.enabled) {
    return {
      ok: false,
      status: 503,
      error: 'supplier_disabled',
      message: `供应商已禁用：routeId=${route.id} supplierId=${supplier.id}`,
      routeId: route.id,
      supplierId: supplier.id,
    };
  }

  // 使用规则指定的转换器，或自动推导
  const transformer = mappingResult.transformer ?? deriveTransformer(route.localService, supplier.protocol);

  return {
    ok: true,
    supplier,
    model: mappingResult.outboundModel ?? inboundModel,
    transformer,
  };
}

/**
 * 第一阶段：仅根据路径匹配路由，不涉及模型映射
 */
function resolveRouteByPath(
  pathname: string,
  routes: Route[],
): { route: Route; client: PromptxyClient; localService: LocalService; pathPrefix: string } | null {
  const local = matchLocalService(pathname);
  if (!local) return null;

  const enabledRoutes = (routes || []).filter(
    r => r.localService === local.localService && r.enabled,
  );
  if (enabledRoutes.length === 0) {
    return null;
  }

  const route = enabledRoutes[0]!;

  return {
    route,
    client: local.client,
    localService: local.localService,
    pathPrefix: local.pathPrefix,
  };
}

/**
 * 第二阶段：根据请求体中的模型进行模型映射，构建完整的 RouteInfo
 */
function resolveSupplierByModel(
  pathname: string,
  route: Route,
  suppliers: Supplier[],
  jsonBody: any,
): RouteResolveResult | null {
  const local = matchLocalService(pathname);
  if (!local) return null;

  // 从请求体获取模型名称
  const inboundModel =
    jsonBody && typeof jsonBody === 'object'
      ? ((jsonBody as any).model as string | undefined)
      : undefined;

  const effective = resolveEffectiveModelMapping(inboundModel, route, suppliers);
  if (!effective.ok) {
    return {
      ok: false,
      status: effective.status,
      error: effective.error,
      message: effective.message,
      routeId: effective.routeId,
      supplierId: effective.supplierId,
    };
  }

  const constraintError = validateRouteConstraints(route, effective.supplier);
  if (constraintError) {
    return {
      ok: false,
      status: 400,
      error: 'route_constraint_violation',
      message: constraintError,
      routeId: route.id,
      supplierId: effective.supplier.id,
    };
  }

  return {
    ok: true,
    routeInfo: {
      client: local.client,
      localService: local.localService,
      pathPrefix: local.pathPrefix,
      upstreamBaseUrl: effective.supplier.baseUrl,
      supplier: effective.supplier,
      route,
    },
    effectiveModel: effective.model,
    transformer: effective.transformer,
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
 * - content 大小 <= 2（数组格式）
 * - content 中任意一项为空或只包含 "Warmup" 文本
 *
 * 注意：Claude Code 的 warmup 请求可能包含 tools，所以不检查 tools
 *
 * 这种请求通常是 Claude Code 的预热/探测请求，对跨协议转换（codex/gemini）无效
 * （可直接返回空结果节省 token）。
 *
 * @param body - 请求体
 * @returns 是否为 warmup 请求
 */
function isWarmupRequest(body: any): boolean {
  if (!body || typeof body !== 'object') return false;

  const messages = body?.messages;

  // 必须有 messages 数组
  if (!Array.isArray(messages) || messages.length !== 1) return false;

  const msg = messages[0];
  if (!msg || typeof msg !== 'object') return false;

  const content = msg.content;

  // 字符串格式：直接判断
  if (typeof content === 'string') {
    return content.trim() === '' || content.trim() === 'Warmup';
  }

  // 数组格式：检查 content 大小和每一项
  if (Array.isArray(content)) {
    // content 大小必须 <= 2
    if (content.length > 2) return false;

    // 检查是否有任意一项只包含 "Warmup" 或为空
    for (const block of content) {
      if (block && typeof block === 'object') {
        const isTextBlock = block.type === 'text' || block.type === 'input_text';
        if (isTextBlock) {
          const text = block.text || block.input_text || '';
          const trimmed = text.trim();
          // 只要有一项是空或只包含 "Warmup" 就认为是 warmup 请求
          if (trimmed === '' || trimmed === 'Warmup') {
            return true;
          }
        }
      }
    }
  }

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
    let transformerChain: TransformerType[] = [];
    let transformTrace: any | undefined;
    let transformedBody: string | undefined;
    // 协议转换后的变量（在 try 块外定义，以便在 catch 块中访问）
    let effectiveUpstreamPath: string;
    let effectiveHeaders: Record<string, string>;
    let effectiveBody: any;
    let shortNameMap: Record<string, string> | undefined;

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

      // 第一阶段：根据路径查找路由（不涉及请求体）
      const routeMatch = resolveRouteByPath(url.pathname, config.routes);
      if (!routeMatch) {
        jsonError(res, 503, {
          error: 'route_not_configured',
          message: `未配置启用路由，请在路由配置页面启用一个路由`,
          path: url.pathname,
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

      // 规则应用：为了避免在 Claude→跨协议转换场景下被应用两次，
      // 这里仅对非 Claude 入口进行 mutate。Claude 入口（且 transformer != none）
      // 会在后续跨协议转换前统一应用规则。
      if (
        jsonBody &&
        typeof jsonBody === 'object' &&
        !(routeMatch.client === 'claude' && routeMatch.route.localService === 'claude')
      ) {
        if (routeMatch.client === 'codex') {
          const result = mutateCodexBody({
            body: jsonBody,
            method: method,
            path: stripPrefix(url.pathname, routeMatch.pathPrefix),
            rules: config.rules,
          });
          jsonBody = result.body;
          matches = result.matches;
          warnings.push(...result.warnings);
        } else if (routeMatch.client === 'gemini') {
          const result = mutateGeminiBody({
            body: jsonBody,
            method: method,
            path: stripPrefix(url.pathname, routeMatch.pathPrefix),
            rules: config.rules,
          });
          jsonBody = result.body;
          matches = result.matches;
        }
      }

      // ========== 第二阶段：根据模型解析供应商 ==========
      // 在读取请求体后，根据模型名称进行模型映射，确定目标供应商

      // 对照模式：Routing 模块（纯逻辑）产物与当前解析结果应一致。
      // 注意：这里不影响对外响应，仅用于开发/调试阶段快速发现拆分偏差。
      const routingCtx: RequestContext = {
        path: url.pathname,
        headers: req.headers as any,
        bodySummary:
          jsonBody && typeof jsonBody === 'object'
            ? {
                model: (jsonBody as any).model as string | undefined,
                stream: Boolean((jsonBody as any).stream),
              }
            : undefined,
      };
      const routePlan = deriveRoutePlan(routingCtx, {
        routes: config.routes,
        suppliers: config.suppliers,
      });

      const supplierMatch = resolveSupplierByModel(
        url.pathname,
        routeMatch.route,
        config.suppliers,
        jsonBody,
      );
      if (!supplierMatch) {
        jsonError(res, 500, {
          error: 'route_resolution_failed',
          message: '路由解析失败',
          path: url.pathname,
        });
        return;
      }

      if (!supplierMatch.ok) {
        if (config.debug) {
          logger.debug(
            `[gateway routing compat] routePlan=${JSON.stringify(routePlan)} supplierMatch=error:${supplierMatch.error}`,
          );
        }

        jsonError(res, supplierMatch.status, {
          error: supplierMatch.error,
          message: supplierMatch.message,
          routeId: supplierMatch.routeId,
          supplierId: supplierMatch.supplierId,
          path: url.pathname,
        });
        return;
      }

      const matchedRoute = supplierMatch.routeInfo;

      if (config.debug) {
        const ok =
          routePlan.localService === matchedRoute.localService &&
          routePlan.supplier === matchedRoute.supplier.id &&
          routePlan.supplierProtocol === matchedRoute.supplier.protocol &&
          routePlan.transformer === supplierMatch.transformer &&
          routePlan.targetModel === supplierMatch.effectiveModel;

        if (!ok) {
          logger.debug(
            `[gateway routing compat] mismatch routePlan=${JSON.stringify(routePlan)} supplierId=${matchedRoute.supplier.id} supplierProtocol=${matchedRoute.supplier.protocol} transformer=${supplierMatch.transformer} effectiveModel=${supplierMatch.effectiveModel}`,
          );
        }
      }

      route = matchedRoute; // 同时更新 route 变量，以便错误处理时使用
      upstreamPath = stripPrefix(url.pathname, matchedRoute.pathPrefix);

      const derivedTransformerForProbe = deriveTransformer(
        matchedRoute.localService,
        matchedRoute.supplier.protocol,
      );

      // ========== Warmup 请求过滤：跳过无意义的预热请求 ==========
      // 参考项目：claude-relay-service
      // Warmup 请求特征：单条消息 + 无 tools，通常是 Claude Code 的探测请求
      if (
        matchedRoute.localService === 'claude' &&
        derivedTransformerForProbe === 'codex' &&
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
        derivedTransformerForProbe === 'codex' &&
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

      // ========== 协议转换与模型映射 ==========
      effectiveUpstreamPath = upstreamPath!;
      effectiveHeaders = headers;
      effectiveBody = jsonBody;
      let needsResponseTransform = false;

      // 注意：route 选择阶段已根据 modelMapping 计算 effective supplier + effective model。
      // 这里仅保证请求体 model 写回 effective model（targetModel 为空时保持透传）。
      if (jsonBody && typeof jsonBody === 'object' && 'model' in (jsonBody as any)) {
        (jsonBody as any).model = supplierMatch.effectiveModel;

        const transformPlan = deriveTransformPlan(routePlan);
        transformerChain = [transformPlan.transformer];
      }

      const derivedTransformer = transformerChain.length > 0 ? transformerChain[0] : deriveTransformer(matchedRoute.localService, matchedRoute.supplier.protocol);

      // ========== 保存原始 Claude 请求体（用于后续计算 input_tokens）==========
      // 仅在 Claude → 跨协议转换时需要，用于流式响应的 usage 兜底
      let originalClaudeBody: any | undefined;
      if (matchedRoute.localService === 'claude' && derivedTransformer !== 'none' && matchedRoute.client === 'claude') {
        // 深拷贝保存原始 Claude 请求体（在协议转换之前）
        originalClaudeBody = jsonBody && typeof jsonBody === 'object' ? JSON.parse(JSON.stringify(jsonBody)) : undefined;
      }

      // ========== 协议转换（仅 Claude 入口跨协议时）==========
      if (matchedRoute.localService === 'claude' && derivedTransformer !== 'none') {
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

            if (matchedRoute.supplier.protocol === 'openai-codex' || matchedRoute.supplier.protocol === 'openai-chat') {
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

        transformerChain = [derivedTransformer];
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
        transformedBody = JSON.stringify(transformResult.request.body);
        shortNameMap = transformResult.shortNameMap;
      }

      // ========== OpenAI/Codex：modelSpec 解析 reasoning.effort（透明转发与 Claude→Codex 均适用）==========
      if (
        (matchedRoute.supplier.protocol === 'openai-codex' || matchedRoute.supplier.protocol === 'openai-chat') &&
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

      // ========== Codex 出站 Header 对齐（CLIProxyAPI 严格模式）==========
      // 对 openai-codex 上游补齐 CLIProxyAPI 默认头（UA / Openai-Beta / Session_id / SSE accept 等）
      if (matchedRoute.supplier.protocol === 'openai-codex') {
        // Never leak CLIProxyAPI internal helper field to upstream.
        if (
          effectiveBody &&
          typeof effectiveBody === 'object' &&
          '__cpa_user_agent' in (effectiveBody as any)
        ) {
          delete (effectiveBody as any).__cpa_user_agent;
        }

        const sessionIdCandidate =
          effectiveBody && typeof effectiveBody === 'object'
            ? (effectiveBody as any).prompt_cache_key ||
              (effectiveBody as any).session_id ||
              (effectiveBody as any).conversation_id
            : undefined;

        applyCLIProxyCodexHeaders(headers, {
          sessionId: typeof sessionIdCandidate === 'string' ? sessionIdCandidate : undefined,
        });
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

      const upstreamAbortController = new AbortController();
      const abortUpstream = (): void => {
        if (upstreamAbortController.signal.aborted) return;
        upstreamAbortController.abort();
      };
      req.once('aborted', abortUpstream);
      // 注意：req/res 的 close 在“正常完成”时也可能触发。
      // 只在响应未正常结束时才 abort 上游，避免放大 undici 的 terminated 边界问题。
      res.once('close', () => {
        if ((res as any).writableEnded || (res as any).writableFinished) return;
        abortUpstream();
      });

      upstreamResponse = await executeUpstream({
        url: upstreamUrl,
        method: req.method || method,
        headers,
        body: expectsBody
          ? effectiveBody
            ? Buffer.from(JSON.stringify(effectiveBody)).toString()
            : bodyBuffer?.toString()
          : undefined,
        signal: upstreamAbortController.signal,
        supplier: matchedRoute.supplier,
      });

      // 上游 fetch 已成功建连后，仍可能因为中间层/客户端断开触发 aborted/close；
      // abortUpstream 负责在这种情况下尽早中止读取上游，减少 undici terminated 概率。

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
          { shortNameMap },
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
            transformedBody: transformedBody,
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
            supplierClient: getSupplierClient(matchedRoute.supplier.protocol),
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
      // 注意：不要在这里立刻 Readable.fromWeb(upstreamResponse.body)。
      // B2 分支会直接使用 WebStream reader pump；若先 fromWeb，会锁住 stream 导致 getReader() 失败/阻塞。
      const upstreamBody = upstreamResponse.body as any;
      let upstreamStream: Readable | undefined;

      const isExpectedStreamTermination = (err: any): boolean => {
        const message = (err?.message ?? String(err ?? '')).toLowerCase();
        const code = err?.code ?? err?.cause?.code;
        const name = err?.name;
        return (
          name === 'AbortError' ||
          code === 'UND_ERR_SOCKET' ||
          code === 'ERR_STREAM_PREMATURE_CLOSE' ||
          code === 'ECONNRESET' ||
          code === 'EPIPE' ||
          message.includes('terminated') ||
          message.includes('premature close') ||
          message.includes('prematurely')
        );
      };

      // 计算 input_tokens 并注入 SSE transformer（用于上游无 usage 时的兜底）
      let estimatedInputTokens: number | undefined;
      if (originalClaudeBody) {
        try {
          let capabilities;
          if (matchedRoute.supplier.protocol === 'openai-codex' || matchedRoute.supplier.protocol === 'openai-chat') {
            capabilities = await detectOpenAICountTokensSupport(matchedRoute.supplier);
          }

          const tokenResult = await countClaudeTokens({
            messages: originalClaudeBody.messages || [],
            system: originalClaudeBody.system,
            tools: originalClaudeBody.tools,
            capabilities,
            baseUrl: matchedRoute.upstreamBaseUrl,
            auth: matchedRoute.supplier.auth?.type === 'none' ? undefined : matchedRoute.supplier.auth,
          });
          estimatedInputTokens = tokenResult.input_tokens;
        } catch {
          // 计算失败时保持 undefined，由 transformer 在兜底时设为 0 并记录 audit
        }
      }

      // 记录请求到数据库（在响应流结束/中断后，保证至少写入一条记录，不因未处理 error 导致进程崩溃）
      const savedRequestId = generateRequestId();
      requestId = savedRequestId;

      // 保存响应状态和头信息（在回调外，避免 TypeScript 类型问题）
      const responseStatus = upstreamResponse.status;
      const responseHeadersStr = JSON.stringify(responseHeaders);

      // 保存请求路径和客户端信息
      const savedClient = matchedRoute.client;
      const savedPath = upstreamPath ?? url.pathname;
      const savedJsonBody = effectiveBody;
      const savedSupplierId = matchedRoute.supplier.id;
      const savedSupplierName = matchedRoute.supplier.name;
      const savedSupplierBaseUrl = matchedRoute.supplier.baseUrl;
      const savedSupplierProtocol = matchedRoute.supplier.protocol;
      const savedRouteId = matchedRoute.route.id;

      let finalized = false;
      const finalizeRequestRecord = async (finalError: any | undefined): Promise<void> => {
        if (finalized) return;
        finalized = true;

        // 检查路径是否需要过滤
        const filteredPaths = await getFilteredPaths();
        if (shouldFilterPath(savedPath, filteredPaths)) {
          return;
        }

        const duration = Date.now() - startTime;
        const responseBodyBuffer = Buffer.concat(responseBodyChunks);

        let responseBodyStr: string | undefined;
        const contentType = upstreamContentType;
        if (contentType.includes('application/json')) {
          try {
            const parsed = JSON.parse(responseBodyBuffer.toString('utf-8'));
            responseBodyStr = JSON.stringify(parsed);
          } catch {
            responseBodyStr = responseBodyBuffer.toString('utf-8');
          }
        } else {
          const rawResponse = responseBodyBuffer.toString('utf-8');
          if (isSSEContent(rawResponse)) {
            responseBodyStr = parseSSEToEvents(rawResponse) as any;
          } else {
            responseBodyStr = rawResponse;
          }
        }

        const errorMessage = finalError
          ? `partial=true; ${finalError?.message ?? String(finalError)}`
          : undefined;

        const record: RequestRecord = {
          id: savedRequestId,
          timestamp: Date.now(),
          client: savedClient,
          path: savedPath,
          method: method,
          originalBody: originalBodyBuffer ? originalBodyBuffer.toString('utf-8') : '{}',
          transformedBody: transformedBody,
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
          error: errorMessage,
          // 路由 / 供应商 / 转换信息
          routeId: savedRouteId,
          supplierId: savedSupplierId,
          supplierName: savedSupplierName,
          supplierBaseUrl: savedSupplierBaseUrl,
          supplierClient: getSupplierClient(savedSupplierProtocol),
          transformerChain: JSON.stringify(transformerChain),
          transformTrace: transformTrace ? JSON.stringify(transformTrace) : undefined,
        };

        try {
          await insertRequestRecord(record);
        } catch (err: any) {
          logger.error(`[promptxy] Failed to save request record: ${err?.message}`);
        }
      };

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

      const shouldTransformSSE = isSSE && needsResponseTransform && transformerChain.length > 0;
      const transformStream = shouldTransformSSE
        ? createSSETransformStream(transformerChain[0], {
            estimatedInputTokens,
            shortNameMap,
          })
        : undefined;

      if (!shouldTransformSSE) {
        upstreamStream = Readable.fromWeb(upstreamBody);
      }

      const outboundStream = (shouldTransformSSE ? transformStream : upstreamStream) as any;
      outboundStream.on('data', (chunk: any) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        responseBodyChunks.push(buf);
      });

      await streamResponse({
        res,
        upstreamResponse,
        upstreamAbortSignal: upstreamAbortController.signal,
        abortUpstream,
        shouldTransformSSE,
        transformStream,
        upstreamStream,
        onChunk: buf => responseBodyChunks.push(buf),
        onFinalize: finalizeRequestRecord,
      });
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
            transformedBody: transformedBody,
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
            supplierClient: route?.supplier?.protocol ? getSupplierClient(route.supplier.protocol) : undefined,
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
