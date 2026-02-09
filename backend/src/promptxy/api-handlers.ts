import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FileSystemStorage } from './database.js';
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
  RuleValidationResult,
  Supplier,
  SuppliersFetchResponse,
  SupplierCreateRequest,
  SupplierCreateResponse,
  SupplierUpdateRequest,
  SupplierUpdateResponse,
  SupplierDeleteResponse,
  SupplierToggleRequest,
  SupplierToggleResponse,
  Route,
  RoutesFetchResponse,
  RouteCreateRequest,
  RouteCreateResponse,
  RouteUpdateRequest,
  RouteUpdateResponse,
  RouteDeleteResponse,
  RouteToggleRequest,
  RouteToggleResponse,
  LocalService,
  RebuildIndexResponse,
  StatsMetrics,
  StatsDataResponse,
  StatsTotal,
  StatsDaily,
  StatsHourly,
  StatsSupplier,
  StatsModel,
  StatsRoute,
  StatsToday,
} from './types.js';
import {
  getRequestList,
  getRequestDetail,
  cleanupOldRequests,
  deleteRequest,
  getDatabaseInfo,
  getRequestStats,
  getUniquePaths,
  getAllSettings,
  getSetting,
  updateSetting,
  rebuildIndex,
  getStatsTotal,
  getStatsDaily,
  getStatsHourly,
  getStatsSupplier,
  getStatsModel,
  getStatsRoute,
  getStatsToday,
  getStatsDataByRange,
} from './database.js';
import {
  saveConfig,
  loadConfig,
  assertUrl,
  assertSupplier,
  assertSupplierPathConflicts,
} from './config.js';
import { getSyncStorage } from './sync/sync-storage.js';
import { applyPromptRules } from './rules/engine.js';
import { readRequestBody } from './http.js';
import { mutateClaudeBody } from './adapters/claude.js';

// SSE 连接管理类型
export type SSEConnections = Set<http.ServerResponse>;

// SSE 连接管理（每个实例独立）
let sseConnections: SSEConnections = new Set();

/**
 * 设置 SSE 连接集合
 */
export function setSSEConnections(connections: SSEConnections): void {
  sseConnections = connections;
}

/**
 * 获取 SSE 连接集合
 */
export function getSSEConnections(): SSEConnections {
  return sseConnections;
}

/**
 * SSE 连接处理
 */
export function handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // 发送连接确认
  res.write('event: connected\ndata: {"status": "ok"}\n\n');

  sseConnections.add(res);

  req.on('close', () => {
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
export function sendJson<T = any>(res: http.ServerResponse, status: number, data: T): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * 处理请求历史列表
 */
export async function handleGetRequests(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  db: FileSystemStorage,
): Promise<void> {
  try {
    const limit = Number(url.searchParams.get('limit')) || 50;
    const offset = Number(url.searchParams.get('offset')) || 0;
    const client = url.searchParams.get('client') || undefined;
    const startTime = url.searchParams.get('startTime');
    const endTime = url.searchParams.get('endTime');
    const search = url.searchParams.get('search') || undefined;

    const result = await getRequestList({
      limit,
      offset,
      client,
      startTime: startTime ? Number(startTime) : undefined,
      endTime: endTime ? Number(endTime) : undefined,
      search,
    });

    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get request list', message: error?.message });
  }
}

/**
 * 处理获取路径列表
 */
export async function handleGetPaths(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  db: FileSystemStorage,
): Promise<void> {
  try {
    const prefix = url.searchParams.get('prefix') || undefined;
    const result = await getUniquePaths(prefix);
    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get paths', message: error?.message });
  }
}

/**
 * 解析 headers 字段（兼容 JSON 字符串和对象格式）
 */
function parseHeadersField(
  headers: Record<string, string> | string | undefined,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  if (typeof headers === 'string') {
    try {
      return JSON.parse(headers);
    } catch {
      return undefined;
    }
  }
  return headers;
}

/**
 * 解析 responseBody 字段（兼容字符串和 ParsedSSEEvent[]）
 */
function parseResponseBodyField(body: string | { data: string }[] | undefined): any {
  if (!body) return undefined;
  // 如果是数组（ParsedSSEEvent[]），直接返回
  if (Array.isArray(body)) {
    return body;
  }
  // 如果是字符串，尝试 JSON 解析
  return safeParseJson(body);
}

/**
 * 处理单个请求详情
 */
export async function handleGetRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  id: string,
  db: FileSystemStorage,
): Promise<void> {
  try {
    const record = await getRequestDetail(id);

    if (!record) {
      sendJson(res, 404, { error: 'Request not found' });
      return;
    }

    // 解析 JSON 字符串和兼容性处理
    const response: RequestRecordResponse = {
      id: record.id,
      timestamp: record.timestamp,
      client: record.client,
      path: record.path,
      method: record.method,
      originalBody: JSON.parse(record.originalBody),
      transformedBody: record.transformedBody ? JSON.parse(record.transformedBody) : undefined,
      modifiedBody: JSON.parse(record.modifiedBody),
      requestHeaders: parseHeadersField(record.requestHeaders),
      originalRequestHeaders: parseHeadersField(record.originalRequestHeaders),
      requestSize: record.requestSize,
      responseSize: record.responseSize,
      matchedRules: JSON.parse(record.matchedRules),
      responseStatus: record.responseStatus,
      durationMs: record.durationMs,
      responseHeaders: parseHeadersField(record.responseHeaders),
      responseBody: parseResponseBodyField(record.responseBody),
      error: record.error,

      // 路由 / 供应商 / 转换信息
      routeId: record.routeId,
      routeNameSnapshot: (record as any).routeNameSnapshot,
      supplierId: record.supplierId,
      supplierName: record.supplierName,
      supplierBaseUrl: record.supplierBaseUrl,
      transformerChain: record.transformerChain ? JSON.parse(record.transformerChain) : undefined,
      transformTrace: record.transformTrace ? safeParseJson(record.transformTrace) : undefined,

      // 模型与计费口径（新增）
      originalRequestModel: (record as any).originalRequestModel,
      requestedModel: (record as any).requestedModel,
      upstreamModel: (record as any).upstreamModel,
      model: (record as any).model,
      cachedInputTokens: (record as any).cachedInputTokens,
      inputTokens: (record as any).inputTokens,
      outputTokens: (record as any).outputTokens,
      totalTokens: (record as any).totalTokens,
      inputCost: (record as any).inputCost,
      outputCost: (record as any).outputCost,
      totalCost: (record as any).totalCost,
      usageSource: (record as any).usageSource,
      pricingStatus: (record as any).pricingStatus,
      pricingSnapshot: (record as any).pricingSnapshot,
    };

    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get request detail', message: error?.message });
  }
}

/**
 * 安全解析 JSON，如果失败则返回原始字符串
 */
export function safeParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * 处理配置读取
 */
export function handleGetConfig(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
): void {
  sendJson(res, 200, config);
}

/**
 * 验证规则格式
 */
export function validateRule(rule: PromptxyRule): RuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rule.uuid || typeof rule.uuid !== 'string') {
    errors.push(`Rule missing or invalid uuid`);
  }

  if (!rule.name || typeof rule.name !== 'string') {
    errors.push(`Rule missing or invalid name`);
  }

  if (!rule.when || typeof rule.when !== 'object') {
    errors.push(`Rule ${rule.name}: missing 'when' object`);
  } else {
    if (!rule.when.client || typeof rule.when.client !== 'string') {
      errors.push(`Rule ${rule.name}: invalid client`);
    }

    if (!rule.when.field || typeof rule.when.field !== 'string') {
      errors.push(`Rule ${rule.name}: invalid field`);
    }
  }

  if (!Array.isArray(rule.ops) || rule.ops.length === 0) {
    errors.push(`Rule ${rule.name}: ops must be non-empty array`);
  } else {
    for (const op of rule.ops) {
      if (!op || typeof op !== 'object' || typeof (op as any).type !== 'string') {
        errors.push(`Rule ${rule.name}: invalid op`);
        continue;
      }

      // 验证正则语法
      const opType = (op as any).type;
      if (['replace', 'delete', 'insert_before', 'insert_after'].includes(opType)) {
        if ((op as any).regex) {
          try {
            new RegExp((op as any).regex, (op as any).flags);
          } catch (e: any) {
            errors.push(`Rule ${rule.name}: invalid regex - ${e.message}`);
          }
        }
      }
    }
  }

  // 警告：没有启用状态的规则
  if (rule.enabled === undefined) {
    warnings.push(`Rule ${rule.name}: missing 'enabled' property, defaulting to true`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证规则格式
 */
export function validateRules(rules: PromptxyRule[]): RuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(rules)) {
    return { valid: false, errors: ['Rules must be an array'], warnings: [] };
  }

  for (const rule of rules) {
    const result = validateRule(rule);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
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
export async function handleConfigSync(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
  currentRules: PromptxyRule[],
): Promise<void> {
  try {
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 * 1024 });
    const syncRequest: ConfigSyncRequest = JSON.parse(body.toString());

    // 验证规则
    const validation = validateRules(syncRequest.rules);
    if (!validation.valid) {
      sendJson(res, 400, {
        error: 'Validation failed',
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
      message: '配置已更新并生效',
      appliedRules: syncRequest.rules.length,
      warnings: validation.warnings,
    } as ConfigSyncResponse);
  } catch (error: any) {
    sendJson(res, 500, {
      error: 'Failed to sync config',
      message: error?.message,
    });
  }
}

/**
 * 处理预览请求
 */
export function handlePreview(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rules: PromptxyRule[],
): void {
  readRequestBody(req, { maxBytes: 10 * 1024 * 1024 })
    .then(body => {
      const previewRequest: PreviewRequest = JSON.parse(body.toString());

      if (!previewRequest.body || typeof previewRequest.body !== 'object') {
        sendJson(res, 400, { error: 'Invalid body' });
        return;
      }

      // 应用规则 - 如果提供了 testRule 则只测试该规则，否则使用所有已保存的规则
      const rulesToApply = previewRequest.testRule ? [previewRequest.testRule] : rules;

      // Claude 的 system 可能是 content blocks 数组；为保持与真实网关一致，这里复用 adapter 的结构化处理逻辑
      if (previewRequest.client === 'claude' && previewRequest.field === 'system') {
        const original = previewRequest.body;
        const modifiedBody = structuredClone(previewRequest.body);

        const result = mutateClaudeBody({
          body: modifiedBody,
          method: previewRequest.method || 'POST',
          path: previewRequest.path || '/',
          rules: rulesToApply,
        });

        const response: PreviewResponse = {
          original,
          modified: result.body,
          matches: result.matches,
        };

        sendJson(res, 200, response);
        return;
      }

      // 应用规则
      let text: string;
      if (previewRequest.field === 'system') {
        text = typeof previewRequest.body.system === 'string' ? previewRequest.body.system : '';
      } else {
        text =
          typeof previewRequest.body.instructions === 'string'
            ? previewRequest.body.instructions
            : '';
      }

      const ctx = {
        client: previewRequest.client,
        field: previewRequest.field,
        method: previewRequest.method || 'POST',
        path: previewRequest.path || '/',
        model: previewRequest.model,
      };

      const result = applyPromptRules(text, ctx, rulesToApply);

      // 构建修改后的请求体
      const modifiedBody = { ...previewRequest.body };
      if (previewRequest.field === 'system') {
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
    .catch(error => {
      sendJson(res, 500, { error: 'Preview failed', message: error?.message });
    });
}

/**
 * 处理数据清理
 */
export async function handleCleanup(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  db: FileSystemStorage,
): Promise<void> {
  try {
    // 优先使用传入的 keep 参数，否则使用数据库中的 max_history 设置
    const keepParam = url.searchParams.get('keep');
    let keep = 100;
    if (keepParam) {
      keep = Number(keepParam) || 100;
    } else {
      const maxHistory = getSetting('max_history');
      keep = maxHistory ? Number(maxHistory) : 100;
    }

    const deleted = await cleanupOldRequests(keep);

    const info = await getDatabaseInfo();

    sendJson(res, 200, {
      deleted,
      remaining: info.recordCount,
      success: true,
    } as CleanupResponse);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Cleanup failed', message: error?.message });
  }
}

/**
 * 处理获取设置
 */
export async function handleGetSettings(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  db: FileSystemStorage,
): Promise<void> {
  try {
    const settings = getAllSettings();
    sendJson(res, 200, { success: true, settings });
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get settings', message: error?.message });
  }
}

/**
 * 处理更新设置
 */
export async function handleUpdateSettings(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  db: FileSystemStorage,
): Promise<void> {
  try {
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 });
    const { settings } = JSON.parse(body.toString());

    if (!settings || typeof settings !== 'object') {
      sendJson(res, 400, { success: false, message: 'Invalid settings object' });
      return;
    }

    // 更新每个设置
    for (const [key, value] of Object.entries(settings)) {
      await updateSetting(key, String(value));
    }

    sendJson(res, 200, { success: true, message: '设置已更新' });
  } catch (error: any) {
    sendJson(res, 500, { success: false, message: error?.message || '更新设置失败' });
  }
}

/**
 * 处理删除单个请求
 */
export async function handleDeleteRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  id: string,
  db: FileSystemStorage,
): Promise<void> {
  try {
    const success = await deleteRequest(id);

    if (!success) {
      sendJson(res, 404, { error: 'Request not found' });
      return;
    }

    sendJson(res, 200, { success: true, message: 'Request deleted' });
  } catch (error: any) {
    sendJson(res, 500, { error: 'Delete failed', message: error?.message });
  }
}

/**
 * 处理健康检查
 */
export function handleHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
  sendJson(res, 200, {
    status: 'ok',
    service: 'promptxy-api',
    timestamp: Date.now(),
  });
}

/**
 * 处理统计信息
 */
export async function handleStats(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  db: FileSystemStorage,
): Promise<void> {
  try {
    const stats = await getRequestStats();
    const dbInfo = await getDatabaseInfo();

    sendJson(res, 200, {
      ...stats,
      database: dbInfo,
    });
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get stats', message: error?.message });
  }
}

/**
 * 处理数据库信息
 */
export async function handleDatabaseInfo(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  db: FileSystemStorage,
): Promise<void> {
  try {
    const info = await getDatabaseInfo();
    sendJson(res, 200, info);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get database info', message: error?.message });
  }
}

/**
 * 处理获取供应商列表
 */
export async function handleGetSuppliers(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
): Promise<void> {
  const response: SuppliersFetchResponse = {
    success: true,
    suppliers: config.suppliers,
  };
  sendJson(res, 200, response);
}

/**
 * 搜索模型列表（供前端模型下拉使用）
 */
export async function handleSearchModels(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const q = url.searchParams.get('q') || undefined;
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number(limitParam) : undefined;
    const limit = typeof parsedLimit === 'number' && Number.isFinite(parsedLimit)
      ? parsedLimit
      : undefined;

    const storage = getSyncStorage();
    const items = storage.searchModels({ q, limit });
    sendJson(res, 200, { items });
  } catch (error: any) {
    sendJson(res, 500, {
      error: 'Failed to search models',
      message: error?.message || String(error),
    });
  }
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `supplier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function normalizeModelPricingMappings(mappings: any): any[] {
  if (!Array.isArray(mappings)) return [];
  return mappings
    .filter(item => item && typeof item === 'object')
    .map((item: any) => {
      const normalized: any = {
        modelName: item.modelName,
        billingModel: item.billingModel,
        priceMode: item.priceMode,
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
      };

      if (item.priceMode === 'custom' && item.customPrice && typeof item.customPrice === 'object') {
        normalized.customPrice = {
          inputPrice: item.customPrice.inputPrice,
          outputPrice: item.customPrice.outputPrice,
          ...(typeof item.customPrice.cacheReadPrice === 'number'
            ? { cacheReadPrice: item.customPrice.cacheReadPrice }
            : {}),
          ...(typeof item.customPrice.cacheWritePrice === 'number'
            ? { cacheWritePrice: item.customPrice.cacheWritePrice }
            : {}),
        };
      }

      return normalized;
    });
}

/**
 * 处理创建供应商
 */
export async function handleCreateSupplier(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
): Promise<void> {
  try {
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 });
    const { supplier: supplierData }: SupplierCreateRequest = JSON.parse(body.toString());

    // 创建新供应商，生成 ID
    const newSupplier: Supplier = {
      ...supplierData,
      id: generateId(),
      supportedModels: Array.isArray((supplierData as any).supportedModels)
        ? (supplierData as any).supportedModels
        : [],
      modelPricingMappings: normalizeModelPricingMappings((supplierData as any).modelPricingMappings),
    };

    // 验证供应商
    assertSupplier('newSupplier', newSupplier);

    // 创建临时列表检查冲突
    const tempSuppliers = [...config.suppliers, newSupplier];
    assertSupplierPathConflicts(tempSuppliers);

    // 添加到配置
    config.suppliers.push(newSupplier);

    // 保存配置
    await saveConfig(config);

    const response: SupplierCreateResponse = {
      success: true,
      message: '供应商已创建',
      supplier: newSupplier,
    };
    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 400, {
      success: false,
      message: error?.message || '创建供应商失败',
    });
  }
}

/**
 * 处理更新供应商
 */
export async function handleUpdateSupplier(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
  url: URL,
): Promise<void> {
  try {
    const supplierId = url.pathname.split('/').pop();
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 });
    const { supplier }: SupplierUpdateRequest = JSON.parse(body.toString());
    (supplier as any).supportedModels = Array.isArray((supplier as any).supportedModels)
      ? (supplier as any).supportedModels
      : [];
    (supplier as any).modelPricingMappings = normalizeModelPricingMappings((supplier as any).modelPricingMappings);

    // 验证供应商
    assertSupplier(`supplier.${supplierId}`, supplier);

    // 查找供应商
    const index = config.suppliers.findIndex(s => s.id === supplierId);
    if (index === -1) {
      sendJson(res, 404, { success: false, message: '供应商不存在' });
      return;
    }

    // 创建临时列表检查冲突（排除当前供应商）
    const tempSuppliers = config.suppliers.filter(s => s.id !== supplierId);
    tempSuppliers.push(supplier);
    assertSupplierPathConflicts(tempSuppliers);

    // 更新配置
    config.suppliers[index] = supplier;

    // 保存配置
    await saveConfig(config);

    const response: SupplierUpdateResponse = {
      success: true,
      message: '供应商已更新',
      supplier,
    };
    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 400, {
      success: false,
      message: error?.message || '更新供应商失败',
    });
  }
}

/**
 * 处理删除供应商
 */
export async function handleDeleteSupplier(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
  url: URL,
): Promise<void> {
  try {
    const supplierId = url.pathname.split('/').pop();

    // 查找供应商
    const index = config.suppliers.findIndex(s => s.id === supplierId);
    if (index === -1) {
      sendJson(res, 404, { success: false, message: '供应商不存在' });
      return;
    }

    // 检查是否是最后一个供应商
    if (config.suppliers.length <= 1) {
      sendJson(res, 400, { success: false, message: '不能删除最后一个供应商' });
      return;
    }

    // 删除供应商
    const deletedSupplier = config.suppliers.splice(index, 1)[0];

    // 保存配置
    await saveConfig(config);

    const response: SupplierDeleteResponse = {
      success: true,
      message: '供应商已删除',
    };
    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 400, {
      success: false,
      message: error?.message || '删除供应商失败',
    });
  }
}

/**
 * 处理切换供应商启用状态
 */
export async function handleToggleSupplier(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
  url: URL,
): Promise<void> {
  try {
    // 路径格式: /_promptxy/suppliers/:id/toggle
    const supplierId = url.pathname.split('/').slice(-2, -1)[0];
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 });
    const { enabled }: SupplierToggleRequest = JSON.parse(body.toString());

    // 查找供应商
    const index = config.suppliers.findIndex(s => s.id === supplierId);
    if (index === -1) {
      sendJson(res, 404, { success: false, message: '供应商不存在' });
      return;
    }

    // 更新启用状态
    config.suppliers[index].enabled = enabled;

    // 检查冲突
    try {
      assertSupplierPathConflicts(config.suppliers);
    } catch (error: any) {
      // 恢复原状态
      config.suppliers[index].enabled = !enabled;
      throw error;
    }

    // 保存配置
    await saveConfig(config);

    const response: SupplierToggleResponse = {
      success: true,
      message: enabled ? '供应商已启用' : '供应商已禁用',
      supplier: config.suppliers[index],
    };
    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 400, {
      success: false,
      message: error?.message || '切换供应商状态失败',
    });
  }
}

/**
 * 保存当前规则到配置文件
 */
async function saveCurrentRules(rules: PromptxyRule[], config: PromptxyConfig): Promise<void> {
  const updatedConfig: PromptxyConfig = { ...config, rules };
  await saveConfig(updatedConfig);
}

/**
 * 处理创建单个规则
 */
export async function handleCreateRule(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  currentRules: PromptxyRule[],
  config: PromptxyConfig,
): Promise<void> {
  try {
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 * 1024 });
    const { rule } = JSON.parse(body.toString());

    // 验证规则
    const validation = validateRule(rule);
    if (!validation.valid) {
      sendJson(res, 400, { error: 'Validation failed', ...validation });
      return;
    }

    // 添加到内存
    currentRules.push(rule);

    // 保存到文件
    await saveCurrentRules(currentRules, config);

    sendJson(res, 200, {
      success: true,
      message: '规则已创建',
      rule,
    });
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to create rule', message: error?.message });
  }
}

/**
 * 处理更新单个规则
 */
export async function handleUpdateRule(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  currentRules: PromptxyRule[],
  url: URL,
  config: PromptxyConfig,
): Promise<void> {
  try {
    const ruleId = url.pathname.split('/').pop();
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 * 1024 });
    const { rule } = JSON.parse(body.toString());

    // 验证规则
    const validation = validateRule(rule);
    if (!validation.valid) {
      sendJson(res, 400, { error: 'Validation failed', ...validation });
      return;
    }

    // 查找并更新（使用 uuid）
    const index = currentRules.findIndex(r => r.uuid === ruleId);
    if (index === -1) {
      sendJson(res, 404, { error: 'Rule not found' });
      return;
    }

    currentRules[index] = rule;
    await saveCurrentRules(currentRules, config);

    sendJson(res, 200, {
      success: true,
      message: '规则已更新',
      rule,
    });
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to update rule', message: error?.message });
  }
}

/**
 * 处理删除单个规则
 */
export async function handleDeleteRule(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  currentRules: PromptxyRule[],
  url: URL,
  config: PromptxyConfig,
): Promise<void> {
  try {
    const ruleId = url.pathname.split('/').pop();

    // 查找并删除（使用 uuid）
    const index = currentRules.findIndex(r => r.uuid === ruleId);
    if (index === -1) {
      sendJson(res, 404, { error: 'Rule not found' });
      return;
    }

    const deletedRule = currentRules[index];
    currentRules.splice(index, 1);
    await saveCurrentRules(currentRules, config);

    sendJson(res, 200, {
      success: true,
      message: '规则已删除',
      rule: deletedRule,
    });
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to delete rule', message: error?.message });
  }
}

// ============================================================================
// 协议转换预览 API（新增）
// ============================================================================

import { createProtocolTransformer } from './transformers/index.js';
import type { TransformTrace } from './transformers/index.js';

/**
 * 处理协议转换预览请求
 */
export async function handleTransformPreview(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
): Promise<void> {
  try {
    const body = await readRequestBody(req, { maxBytes: 1024 * 1024 });
    const request = JSON.parse(body.toString('utf-8'));

    // 验证请求格式
    if (!request.supplierId || !request.request) {
      sendJson(res, 400, {
        error: 'Invalid request',
        message: 'Missing supplierId or request field',
      });
      return;
    }

    // 查找 supplier
    const supplier = config.suppliers.find(s => s.id === request.supplierId);
    if (!supplier) {
      sendJson(res, 404, {
        error: 'Supplier not found',
        message: `No supplier found with id: ${request.supplierId}`,
      });
      return;
    }

    // 执行转换预览
    // request.request 是 Claude 请求体（model, messages 等）
    const transformer = createProtocolTransformer();
    const result = await transformer.transform({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        baseUrl: supplier.baseUrl,
        auth: supplier.auth,
        transformer: { default: ['codex'] },
      },
      request: {
        method: 'POST',
        path: '/v1/messages',
        headers: {},
        body: request.request, // 用户提供的 request 字段就是 Claude 请求体
      },
      stream: request.stream || false,
    });

    sendJson<{
      request: typeof result.request;
      trace: TransformTrace;
      needsResponseTransform: boolean;
    }>(res, 200, {
      request: result.request,
      trace: result.trace,
      needsResponseTransform: result.needsResponseTransform,
    });
  } catch (error: any) {
    sendJson(res, 500, {
      error: 'Transform preview failed',
      message: error?.message || String(error),
    });
  }
}

/**
 * 获取可用转换器列表
 */
export async function handleGetTransformers(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    // 新实现：返回支持的协议转换器
    sendJson(res, 200, {
      transformers: [
        {
          name: 'codex',
          description: 'Claude Messages API → Codex Responses API',
          supportedSuppliers: ['openai'],
          supportsStreaming: true,
          supportsTools: true,
        },
      ],
    });
  } catch (error: any) {
    sendJson(res, 500, {
      error: 'Failed to get transformers',
      message: error?.message || String(error),
    });
  }
}

/**
 * 验证转换器配置
 */
export async function handleValidateTransformer(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await readRequestBody(req, { maxBytes: 1024 * 1024 });
    const { transformer } = JSON.parse(body.toString('utf-8'));

    if (!transformer) {
      sendJson(res, 400, {
        error: 'Invalid request',
        message: 'Missing transformer field',
      });
      return;
    }

    const { validateTransformerConfig } = await import('./transformers/index.js');
    const result = validateTransformerConfig(transformer);

    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, {
      error: 'Validation failed',
      message: error?.message || String(error),
    });
  }
}

// ============================================================================
// 路由配置 API（新增）
// ============================================================================

/**
 * 本地服务到协议的映射
 */
const LOCAL_SERVICE_PROTOCOLS: Record<LocalService, 'anthropic' | 'openai' | 'gemini'> = {
  claude: 'anthropic',
  codex: 'openai',
  gemini: 'gemini',
};

/**
 * 支持的转换器组合
 * key: "本地协议->供应商协议"
 */
const SUPPORTED_TRANSFORMERS: Record<string, string[]> = {
  // Claude 入口：允许跨协议（通过转换器）
  'anthropic->anthropic': ['none'],
  'anthropic->openai': ['codex'], // Claude → Codex (Responses)
  'anthropic->gemini': ['gemini'],

  // Codex/Gemini 入口：仅透明转发（禁止跨协议）
  'openai->openai': ['none'],
  'gemini->gemini': ['none'],
};

/**
 * 根据本地服务和供应商协议自动选择转换器
 */
function autoSelectTransformer(
  localService: LocalService,
  supplierProtocol: 'anthropic' | 'openai' | 'gemini',
): string {
  const localProtocol = LOCAL_SERVICE_PROTOCOLS[localService];
  const key = `${localProtocol}->${supplierProtocol}`;
  const transformers = SUPPORTED_TRANSFORMERS[key];

  if (!transformers || transformers.length === 0) {
    return 'none';
  }

  return transformers[0];
}

function assertRouteAllowed(
  localService: LocalService,
  supplierProtocol: 'anthropic' | 'openai' | 'gemini',
): void {
  const localProtocol = LOCAL_SERVICE_PROTOCOLS[localService];
  const key = `${localProtocol}->${supplierProtocol}`;
  const transformers = SUPPORTED_TRANSFORMERS[key];
  if (!transformers || transformers.length === 0) {
    throw new Error(`不支持从 ${localService} 对接协议 ${supplierProtocol} 的供应商`);
  }
}

function assertTargetModelAllowed(
  label: string,
  supplier: Supplier,
  targetModel: unknown,
): void {
  if (targetModel === undefined) return;
  if (typeof targetModel !== 'string' || !targetModel.trim()) {
    throw new Error(`${label} 必须是非空字符串`);
  }

  const supported = Array.isArray((supplier as any).supportedModels)
    ? ((supplier as any).supportedModels as string[])
    : [];
  if (supported.length > 0 && !supported.includes(targetModel)) {
    throw new Error(`${label} 必须从该供应商的 supportedModels 中选择`);
  }
}

function assertRouteModelMappingValid(
  label: string,
  routeLike: { modelMapping?: any },
  suppliers: Supplier[],
): void {
  const mapping = (routeLike as any).modelMapping;
  if (!mapping || typeof mapping !== 'object') return;

  const rules = (mapping as any).rules;
  if (!Array.isArray(rules)) return;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const ruleLabel = `${label}.modelMapping.rules[${i}]`;
    if (!rule || typeof rule !== 'object') continue;

    const supplierId = (rule as any).targetSupplierId;
    if (typeof supplierId !== 'string' || !supplierId.trim()) {
      throw new Error(`${ruleLabel}.targetSupplierId 必须是非空字符串`);
    }

    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      throw new Error(`${ruleLabel}.targetSupplierId 引用的供应商不存在：${supplierId}`);
    }

    assertTargetModelAllowed(`${ruleLabel}.outboundModel`, supplier, (rule as any).outboundModel);
  }
}

function assertRouteProtocolConstraint(
  localService: LocalService,
  supplierProtocol: Supplier['protocol'],
): void {
  if (localService === 'codex' && supplierProtocol !== 'openai-codex') {
    throw new Error('Codex 入口仅允许对接 openai-codex 协议供应商');
  }
  if (localService === 'gemini' && supplierProtocol !== 'gemini') {
    throw new Error('Gemini 入口仅允许对接 gemini 协议供应商');
  }
}

function deriveTransformer(
  localService: LocalService,
  supplierProtocol: Supplier['protocol'],
): string {
  if (localService === 'codex') return 'none';
  if (localService === 'gemini') return 'none';
  if (supplierProtocol === 'anthropic') return 'none';
  if (supplierProtocol === 'openai-codex') return 'codex';
  if (supplierProtocol === 'openai-chat') return 'openai-chat';
  if (supplierProtocol === 'gemini') return 'gemini';
  return 'none';
}

/**
 * 处理获取路由列表
 */
export async function handleGetRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
): Promise<void> {
  const response: RoutesFetchResponse = {
    success: true,
    routes: config.routes || [],
  };
  sendJson(res, 200, response);
}

/**
 * 处理创建路由
 */
export async function handleCreateRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
): Promise<void> {
  try {
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 });
    const { route: routeData }: RouteCreateRequest = JSON.parse(body.toString());

    const localService = routeData.localService;

    // Codex/Gemini: 验证单一供应商
    if (localService === 'codex' || localService === 'gemini') {
      if (!routeData.singleSupplierId) {
        sendJson(res, 400, {
          success: false,
          message: `${localService} 路由必须指定上游供应商`,
        });
        return;
      }
      const supplier = config.suppliers.find(s => s.id === routeData.singleSupplierId);
      if (!supplier) {
        sendJson(res, 400, {
          success: false,
          message: '指定的上游供应商不存在',
        });
        return;
      }
      // 入口协议约束（codex/gemini 不允许跨协议）
      try {
        assertRouteProtocolConstraint(localService, supplier.protocol);
      } catch (e: any) {
        sendJson(res, 400, {
          success: false,
          message: e?.message || '路由协议不合法',
        });
        return;
      }
    }
    // Claude: 验证模型映射规则
    else {
      const mappings = routeData.modelMappings || [];
      if (mappings.length === 0) {
        sendJson(res, 400, {
          success: false,
          message: 'Claude 路由必须至少包含一条模型映射规则',
        });
        return;
      }
      // 验证每个规则的供应商存在
      for (const mapping of mappings) {
        const supplier = config.suppliers.find(s => s.id === mapping.targetSupplierId);
        if (!supplier) {
          sendJson(res, 400, {
            success: false,
            message: `规则 ${mapping.inboundModel} 指定的供应商不存在`,
          });
          return;
        }
      }
    }

    // 创建新路由，生成 ID
    const newRoute: Route = {
      ...routeData,
      id: `route-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // 允许同一 localService 多条路由；但启用状态必须唯一
    if (newRoute.enabled) {
      for (const r of config.routes) {
        if (r.localService === newRoute.localService) {
          r.enabled = false;
        }
      }
    }

    config.routes.push(newRoute);

    // 保存配置
    await saveConfig(config);

    const response: RouteCreateResponse = {
      success: true,
      message: '路由已创建',
      route: newRoute,
    };
    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 400, {
      success: false,
      message: error?.message || '创建路由失败',
    });
  }
}

/**
 * 处理更新路由
 */
export async function handleUpdateRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
  url: URL,
): Promise<void> {
  try {
    const routeId = url.pathname.split('/').pop();
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 });
    const { route: routeUpdate }: RouteUpdateRequest = JSON.parse(body.toString());

    // 查找路由
    const index = config.routes.findIndex(r => r.id === routeId);
    if (index === -1) {
      sendJson(res, 404, { success: false, message: '路由不存在' });
      return;
    }

    const currentRoute = config.routes[index];
    const nextLocalService = currentRoute.localService;

    // Codex/Gemini: 验证单一供应商
    if (nextLocalService === 'codex' || nextLocalService === 'gemini') {
      const nextSupplierId = routeUpdate.singleSupplierId ?? currentRoute.singleSupplierId;
      if (!nextSupplierId) {
        sendJson(res, 400, { success: false, message: '必须指定上游供应商' });
        return;
      }
      const supplier = config.suppliers.find(s => s.id === nextSupplierId);
      if (!supplier) {
        sendJson(res, 400, { success: false, message: '指定的上游供应商不存在' });
        return;
      }
      // 入口协议约束（codex/gemini 不允许跨协议）
      try {
        assertRouteProtocolConstraint(nextLocalService, supplier.protocol);
      } catch (e: any) {
        sendJson(res, 400, {
          success: false,
          message: e?.message || '路由协议不合法',
        });
        return;
      }
    }
    // Claude: 验证模型映射规则
    else {
      const nextMappings = routeUpdate.modelMappings ?? currentRoute.modelMappings;
      if (!nextMappings || nextMappings.length === 0) {
        sendJson(res, 400, { success: false, message: 'Claude 路由必须至少包含一条模型映射规则' });
        return;
      }
      // 验证每个规则的供应商存在
      for (const mapping of nextMappings) {
        const supplier = config.suppliers.find(s => s.id === mapping.targetSupplierId);
        if (!supplier) {
          sendJson(res, 400, {
            success: false,
            message: `规则 ${mapping.inboundModel} 指定的供应商不存在`,
          });
          return;
        }
      }
    }

    // 不允许修改 localService
    delete (routeUpdate as any).localService;

    if (routeUpdate.enabled === true) {
      for (const r of config.routes) {
        if (r.localService === nextLocalService && r.id !== currentRoute.id) {
          r.enabled = false;
        }
      }
    }

    // 更新路由
    config.routes[index] = {
      ...config.routes[index],
      ...routeUpdate,
    };

    // 保存配置
    await saveConfig(config);

    const response: RouteUpdateResponse = {
      success: true,
      message: '路由已更新',
      route: config.routes[index],
    };
    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 400, {
      success: false,
      message: error?.message || '更新路由失败',
    });
  }
}

/**
 * 处理删除路由
 */
export async function handleDeleteRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
  url: URL,
): Promise<void> {
  try {
    const routeId = url.pathname.split('/').pop();

    // 查找路由
    const index = config.routes.findIndex(r => r.id === routeId);
    if (index === -1) {
      sendJson(res, 404, { success: false, message: '路由不存在' });
      return;
    }

    // 删除路由
    config.routes.splice(index, 1);

    // 保存配置
    await saveConfig(config);

    const response: RouteDeleteResponse = {
      success: true,
      message: '路由已删除',
    };
    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 400, {
      success: false,
      message: error?.message || '删除路由失败',
    });
  }
}

/**
 * 处理切换路由启用状态
 */
export async function handleToggleRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
  url: URL,
): Promise<void> {
  try {
    // 路径格式: /_promptxy/routes/:id/toggle
    const routeId = url.pathname.split('/').slice(-2, -1)[0];
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 });
    const { enabled }: RouteToggleRequest = JSON.parse(body.toString());

    // 查找路由
    const index = config.routes.findIndex(r => r.id === routeId);
    if (index === -1) {
      sendJson(res, 404, { success: false, message: '路由不存在' });
      return;
    }

    // 启用时：同 localService 的其他 route 必须禁用（确保唯一生效）
    if (enabled) {
      const current = config.routes[index];
      for (const r of config.routes) {
        if (r.localService === current.localService) {
          r.enabled = false;
        }
      }
    }

    config.routes[index].enabled = enabled;

    // 保存配置
    await saveConfig(config);

    const response: RouteToggleResponse = {
      success: true,
      message: enabled ? '路由已启用' : '路由已禁用',
      route: config.routes[index],
    };
    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 400, {
      success: false,
      message: error?.message || '切换路由状态失败',
    });
  }
}

// ============================================================================
// 索引重建 API（新增）
// ============================================================================

/**
 * 处理索引重建请求
 */
export async function handleRebuildIndex(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const result = await rebuildIndex();
    const response: RebuildIndexResponse = {
      success: result.success,
      message: result.message,
      count: result.count,
    };
    sendJson(res, result.success ? 200 : 500, response);
  } catch (error: any) {
    sendJson(res, 500, {
      success: false,
      message: error?.message || '重建索引失败',
      count: 0,
    });
  }
}

// ============================================================================
// 统计系统 API（新增）
// ============================================================================

/**
 * 处理获取完整统计数据
 */
export async function handleGetStatsData(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const range = (url.searchParams.get('range') || '30d').toLowerCase();
    const now = Date.now();

    let startTime: number | undefined;
    let endTime: number | undefined;

    if (range === '7d' || range === '30d' || range === '90d') {
      const days = Number(range.slice(0, -1));
      startTime = now - days * 24 * 60 * 60 * 1000;
      endTime = now;
    } else if (range === 'all') {
      startTime = undefined;
      endTime = undefined;
    } else {
      const startParam = url.searchParams.get('startTime');
      const endParam = url.searchParams.get('endTime');
      startTime = startParam ? Number(startParam) : undefined;
      endTime = endParam ? Number(endParam) : undefined;
    }

    const [aggregated, hourly, today] = await Promise.all([
      getStatsDataByRange({
        startTime,
        endTime,
        limitDays: range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : undefined,
      }),
      // 注意：hourly/today 仍然是“今日统计”，不参与范围聚合
      getStatsHourly(),
      getStatsToday(),
    ]);

    const total = aggregated.total;
    const daily = aggregated.daily;
    const supplier = aggregated.supplier;
    const model = aggregated.model;
    const route = aggregated.route;

    const response: StatsDataResponse = {
      total,
      daily,
      hourly,
      supplier,
      model,
      route,
      today,
    };
    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get stats data', message: error?.message });
  }
}

/**
 * 处理获取总览统计
 */
export async function handleGetStatsTotal(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const result = await getStatsTotal();
    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get total stats', message: error?.message });
  }
}

/**
 * 处理获取每日统计
 */
export async function handleGetStatsDaily(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const limit = Number(url.searchParams.get('limit')) || 30;
    const result = await getStatsDaily(limit);
    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get daily stats', message: error?.message });
  }
}

/**
 * 处理获取小时统计（仅当日）
 */
export async function handleGetStatsHourly(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const result = await getStatsHourly();
    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get hourly stats', message: error?.message });
  }
}

/**
 * 处理获取供应商统计
 */
export async function handleGetStatsSupplier(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const result = await getStatsSupplier();
    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get supplier stats', message: error?.message });
  }
}

/**
 * 处理获取模型统计
 */
export async function handleGetStatsModel(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const limit = Number(url.searchParams.get('limit')) || 20;
    const sortBy = url.searchParams.get('sortBy') as keyof StatsMetrics || 'totalTokens';
    const result = await getStatsModel(limit, sortBy);
    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get model stats', message: error?.message });
  }
}

/**
 * 处理获取路由统计
 */
export async function handleGetStatsRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const result = await getStatsRoute();
    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get route stats', message: error?.message });
  }
}

/**
 * 处理获取今日统计
 */
export async function handleGetStatsToday(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const result = await getStatsToday();
    sendJson(res, 200, result);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get today stats', message: error?.message });
  }
}
