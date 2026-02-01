/**
 * 同步服务 API 处理函数
 */

import * as http from 'node:http';
import { URL } from 'node:url';
import { readRequestBody } from '../http.js';
import { sendJson } from '../api-handlers.js';
import { getSyncService } from './sync-service.js';
import { getSyncStorage } from './sync-storage.js';
import { saveConfig } from '../config.js';
import type { PromptxyConfig, SyncConfig } from '../types.js';

/**
 * 发送 JSON 错误响应
 */
function jsonError(res: http.ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

/**
 * 处理获取同步配置
 */
export async function handleGetSyncConfig(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
): Promise<void> {
  try {
    sendJson(res, 200, config.sync || {
      enabled: false,
      intervalHours: 24,
      syncTime: '03:00',
      maxRetries: 3,
      retryDelayMs: 5000,
      useProxy: false,
      sources: {
        prices: 'models.dev',
        models: 'models.dev',
      },
    });
  } catch (error: any) {
    jsonError(res, 500, { error: 'Failed to get sync config', message: error?.message });
  }
}

/**
 * 处理更新同步配置
 */
export async function handleUpdateSyncConfig(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: PromptxyConfig,
): Promise<void> {
  try {
    const body = await readRequestBody(req, { maxBytes: 10 * 1024 });
    const syncConfig = JSON.parse(body.toString()) as SyncConfig;

    // 更新配置
    config.sync = {
      ...config.sync,
      ...syncConfig,
    };

    await saveConfig(config);

    // 重启同步服务
    const syncService = getSyncService();
    if (config.sync) {
      await syncService.init(config.sync);
    }

    sendJson(res, 200, { success: true, config: config.sync });
  } catch (error: any) {
    jsonError(res, 400, { error: error?.message || 'Failed to update sync config' });
  }
}

/**
 * 处理手动触发同步
 */
export async function handleSyncTrigger(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await readRequestBody(req, { maxBytes: 1024 });
    const data = JSON.parse(body.toString()) as any;
    const type = data.type || 'all';

    const syncService = getSyncService();
    const results = await syncService.executeSync(type);

    sendJson(res, 200, {
      success: true,
      results,
    });
  } catch (error: any) {
    jsonError(res, 500, { error: error?.message || 'Sync failed' });
  }
}

/**
 * 处理同步价格
 */
export async function handleSyncPrice(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const syncService = getSyncService();
    const result = await syncService.syncPrices();

    sendJson(res, 200, {
      success: result.status === 'success',
      result,
    });
  } catch (error: any) {
    jsonError(res, 500, { error: error?.message || 'Price sync failed' });
  }
}

/**
 * 处理同步模型列表
 */
export async function handleSyncModels(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const syncService = getSyncService();
    const result = await syncService.syncModels();

    sendJson(res, 200, {
      success: result.status === 'success',
      result,
    });
  } catch (error: any) {
    jsonError(res, 500, { error: error?.message || 'Model sync failed' });
  }
}

/**
 * 处理获取同步状态
 */
export async function handleGetSyncStatus(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const syncService = getSyncService();
    const status = syncService.getStatus();
    sendJson(res, 200, status);
  } catch (error: any) {
    jsonError(res, 500, { error: 'Failed to get sync status', message: error?.message });
  }
}

/**
 * 处理获取同步日志
 */
export async function handleGetSyncLogs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
    const type = url.searchParams.get('type') as 'price' | 'model' | undefined;

    const syncService = getSyncService();
    const logs = syncService.getLogs(limit, type);

    sendJson(res, 200, { logs });
  } catch (error: any) {
    jsonError(res, 500, { error: 'Failed to get sync logs', message: error?.message });
  }
}

/**
 * 处理预览同步数据
 */
export async function handleSyncPreview(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const type = url.searchParams.get('type') as 'price' | 'model' | undefined;
    const storage = getSyncStorage();

    let data: any = {};

    if (!type || type === 'price') {
      data.prices = storage.getAllPrices().slice(0, 10); // 只返回前10条
    }

    if (!type || type === 'model') {
      data.models = storage.getAllLists().slice(0, 10);
    }

    sendJson(res, 200, data);
  } catch (error: any) {
    jsonError(res, 500, { error: 'Failed to preview sync data', message: error?.message });
  }
}
