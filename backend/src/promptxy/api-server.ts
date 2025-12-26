import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Database } from 'sqlite';
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
} from './database.js';
import { saveConfig, loadConfig, assertUrl, assertSupplier, assertSupplierPathConflicts } from './config.js';
import { applyPromptRules } from './rules/engine.js';
import { readRequestBody } from './http.js';

// SSE 连接管理
const sseConnections = new Set<http.ServerResponse>();

/**
 * SSE 连接处理
 */
function handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
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
function sendJson(res: http.ServerResponse, status: number, data: any): void {
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
async function handleGetRequests(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
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
async function handleGetPaths(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
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
 * 处理单个请求详情
 */
async function handleGetRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  id: string,
): Promise<void> {
  try {
    const record = await getRequestDetail(id);

    if (!record) {
      sendJson(res, 404, { error: 'Request not found' });
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
      requestSize: record.requestSize,
      responseSize: record.responseSize,
      matchedRules: JSON.parse(record.matchedRules),
      responseStatus: record.responseStatus,
      durationMs: record.durationMs,
      responseHeaders: record.responseHeaders ? JSON.parse(record.responseHeaders) : undefined,
      responseBody: record.responseBody ? safeParseJson(record.responseBody) : undefined,
      error: record.error,
    };

    sendJson(res, 200, response);
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get request detail', message: error?.message });
  }
}

/**
 * 安全解析 JSON，如果失败则返回原始字符串
 */
function safeParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * 处理配置读取
 */
function handleGetConfig(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
): void {
  sendJson(res, 200, config);
}

/**
 * 验证规则格式
 */
function validateRule(rule: PromptxyRule): RuleValidationResult {
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
function validateRules(rules: PromptxyRule[]): RuleValidationResult {
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
async function handleConfigSync(
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
function handlePreview(
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

      const result = applyPromptRules(text, ctx, rules);

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
async function handleCleanup(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  try {
    // 优先使用传入的 keep 参数，否则使用数据库中的 max_history 设置
    const keepParam = url.searchParams.get('keep');
    let keep = 100;
    if (keepParam) {
      keep = Number(keepParam) || 100;
    } else {
      const maxHistory = await getSetting('max_history');
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
async function handleGetSettings(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const settings = await getAllSettings();
    sendJson(res, 200, { success: true, settings });
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to get settings', message: error?.message });
  }
}

/**
 * 处理更新设置
 */
async function handleUpdateSettings(
  req: http.IncomingMessage,
  res: http.ServerResponse,
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
async function handleDeleteRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  id: string,
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
function handleHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
  sendJson(res, 200, {
    status: 'ok',
    service: 'promptxy-api',
    timestamp: Date.now(),
  });
}

/**
 * 处理统计信息
 */
async function handleStats(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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
async function handleDatabaseInfo(
  req: http.IncomingMessage,
  res: http.ServerResponse,
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
async function handleGetSuppliers(
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
 * 生成唯一 ID
 */
function generateId(): string {
  return `supplier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 处理创建供应商
 */
async function handleCreateSupplier(
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
async function handleUpdateSupplier(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
  url: URL,
): Promise<void> {
  try {
    const supplierId = url.pathname.split('/').pop();
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 });
    const { supplier }: SupplierUpdateRequest = JSON.parse(body.toString());

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
async function handleDeleteSupplier(
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
async function handleToggleSupplier(
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
async function saveCurrentRules(rules: PromptxyRule[]): Promise<void> {
  const config = await loadConfig();
  const updatedConfig: PromptxyConfig = { ...config, rules };
  await saveConfig(updatedConfig);
}

/**
 * 处理创建单个规则
 */
async function handleCreateRule(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  currentRules: PromptxyRule[],
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
    await saveCurrentRules(currentRules);

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
async function handleUpdateRule(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  currentRules: PromptxyRule[],
  url: URL,
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
    await saveCurrentRules(currentRules);

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
async function handleDeleteRule(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  currentRules: PromptxyRule[],
  url: URL,
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
    await saveCurrentRules(currentRules);

    sendJson(res, 200, {
      success: true,
      message: '规则已删除',
      rule: deletedRule,
    });
  } catch (error: any) {
    sendJson(res, 500, { error: 'Failed to delete rule', message: error?.message });
  }
}

/**
 * 获取 MIME 类型
 */
function getMimeType(extname: string): string {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.js.map': 'application/json',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
  };
  return mimeTypes[extname] || 'application/octet-stream';
}

/**
 * 处理静态文件服务
 */
async function serveStaticFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<boolean> {
  // 只处理 GET 请求
  if (req.method !== 'GET') {
    return false;
  }

  // 静态文件目录
  const publicDir = path.join(process.cwd(), 'public');

  // 如果 public 目录不存在，返回 false
  if (!fs.existsSync(publicDir)) {
    return false;
  }

  // 构建文件路径
  let filePath: string;
  if (url.pathname === '/') {
    filePath = path.join(publicDir, 'index.html');
  } else {
    filePath = path.join(publicDir, url.pathname);
  }

  // 安全检查：防止目录遍历
  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return true;
  }

  try {
    // 检查文件是否存在
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      return false;
    }

    // 读取文件
    const content = await fs.promises.readFile(filePath);
    const extname = path.extname(filePath);
    const mimeType = getMimeType(extname);

    // 发送文件
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': content.length,
      'Cache-Control': 'public, max-age=3600', // 缓存 1 小时
    });
    res.end(content);
    return true;
  } catch {
    // 文件不存在或其他错误，返回 false 让其他路由处理
    return false;
  }
}

/**
 * 创建 API 服务器
 */
export function createApiServer(
  db: Database,
  config: PromptxyConfig,
  currentRules: PromptxyRule[],
): http.Server {
  return http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        sendJson(res, 400, { error: 'Invalid request' });
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

      // CORS 支持
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // 静态文件服务（优先级最高，除了 API 路由）
      // 如果不是 API 路由，尝试提供静态文件
      if (!url.pathname.startsWith('/_promptxy/')) {
        const served = await serveStaticFile(req, res, url);
        if (served) {
          return;
        }
      }

      // SSE 端点
      if (req.method === 'GET' && url.pathname === '/_promptxy/events') {
        handleSSE(req, res);
        return;
      }

      // 请求历史列表
      if (req.method === 'GET' && url.pathname === '/_promptxy/requests') {
        await handleGetRequests(req, res, url);
        return;
      }

      // 路径列表
      if (req.method === 'GET' && url.pathname === '/_promptxy/paths') {
        await handleGetPaths(req, res, url);
        return;
      }

      // 请求详情
      if (req.method === 'GET' && url.pathname.startsWith('/_promptxy/requests/')) {
        const id = url.pathname.split('/').pop();
        if (id) {
          await handleGetRequest(req, res, id);
          return;
        }
      }

      // 删除请求
      if (req.method === 'DELETE' && url.pathname.startsWith('/_promptxy/requests/')) {
        const id = url.pathname.split('/').pop();
        if (id) {
          await handleDeleteRequest(req, res, id);
          return;
        }
      }

      // 配置读取
      if (req.method === 'GET' && url.pathname === '/_promptxy/config') {
        handleGetConfig(req, res, config);
        return;
      }

      // 配置同步
      if (req.method === 'POST' && url.pathname === '/_promptxy/config/sync') {
        await handleConfigSync(req, res, config, currentRules);
        return;
      }

      // 获取供应商列表
      if (req.method === 'GET' && url.pathname === '/_promptxy/suppliers') {
        await handleGetSuppliers(req, res, config);
        return;
      }

      // 创建供应商
      if (req.method === 'POST' && url.pathname === '/_promptxy/suppliers') {
        await handleCreateSupplier(req, res, config);
        return;
      }

      // 更新供应商
      if (req.method === 'PUT' && url.pathname.startsWith('/_promptxy/suppliers/')) {
        await handleUpdateSupplier(req, res, config, url);
        return;
      }

      // 删除供应商
      if (req.method === 'DELETE' && url.pathname.startsWith('/_promptxy/suppliers/')) {
        await handleDeleteSupplier(req, res, config, url);
        return;
      }

      // 切换供应商状态
      if (req.method === 'POST' && url.pathname.startsWith('/_promptxy/suppliers/') && url.pathname.endsWith('/toggle')) {
        await handleToggleSupplier(req, res, config, url);
        return;
      }

      // 规则管理路由
      if (url.pathname === '/_promptxy/rules' && req.method === 'POST') {
        await handleCreateRule(req, res, currentRules);
        return;
      }

      if (url.pathname.startsWith('/_promptxy/rules/') && req.method === 'PUT') {
        await handleUpdateRule(req, res, currentRules, url);
        return;
      }

      if (url.pathname.startsWith('/_promptxy/rules/') && req.method === 'DELETE') {
        await handleDeleteRule(req, res, currentRules, url);
        return;
      }

      // 预览
      if (req.method === 'POST' && url.pathname === '/_promptxy/preview') {
        handlePreview(req, res, currentRules);
        return;
      }

      // 数据清理
      if (req.method === 'POST' && url.pathname === '/_promptxy/requests/cleanup') {
        await handleCleanup(req, res, url);
        return;
      }

      // 获取设置
      if (req.method === 'GET' && url.pathname === '/_promptxy/settings') {
        await handleGetSettings(req, res);
        return;
      }

      // 更新设置
      if (req.method === 'POST' && url.pathname === '/_promptxy/settings') {
        await handleUpdateSettings(req, res);
        return;
      }

      // 健康检查
      if (req.method === 'GET' && url.pathname === '/_promptxy/health') {
        handleHealth(req, res);
        return;
      }

      // 统计信息
      if (req.method === 'GET' && url.pathname === '/_promptxy/stats') {
        await handleStats(req, res);
        return;
      }

      // 数据库信息
      if (req.method === 'GET' && url.pathname === '/_promptxy/database') {
        await handleDatabaseInfo(req, res);
        return;
      }

      // 404
      sendJson(res, 404, { error: 'Not Found', path: url.pathname });
    } catch (error: any) {
      sendJson(res, 500, { error: 'Internal Server Error', message: error?.message });
    }
  });
}
