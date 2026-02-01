/**
 * 同步服务 API 客户端
 */

import { apiClient } from './client';
import type {
  SyncConfig,
  SyncResult,
  SyncStatus,
  SyncLogsResponse,
  SyncPreviewResponse,
} from '@/types/sync';

/**
 * 获取同步配置
 */
export async function getSyncConfig(): Promise<SyncConfig> {
  const response = await apiClient.get('/_promptxy/sync/config');
  return response.data;
}

/**
 * 更新同步配置
 */
export async function updateSyncConfig(config: SyncConfig): Promise<{ success: boolean; config: SyncConfig }> {
  const response = await apiClient.put('/_promptxy/sync/config', config);
  return response.data;
}

/**
 * 手动触发同步
 */
export async function triggerSync(type?: 'price' | 'model' | 'all'): Promise<{
  success: boolean;
  results: SyncResult[];
}> {
  const response = await apiClient.post('/_promptxy/sync/trigger', { type });
  return response.data;
}

/**
 * 同步价格
 */
export async function syncPrices(): Promise<{ success: boolean; result: SyncResult }> {
  const response = await apiClient.post('/_promptxy/sync/price');
  return response.data;
}

/**
 * 同步模型列表
 */
export async function syncModels(): Promise<{ success: boolean; result: SyncResult }> {
  const response = await apiClient.post('/_promptxy/sync/models');
  return response.data;
}

/**
 * 获取同步状态
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const response = await apiClient.get('/_promptxy/sync/status');
  return response.data;
}

/**
 * 获取同步日志
 */
export async function getSyncLogs(limit?: number, type?: 'price' | 'model'): Promise<SyncLogsResponse> {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (type) params.append('type', type);

  const response = await apiClient.get(`/_promptxy/sync/logs?${params}`);
  return response.data;
}

/**
 * 预览同步数据
 */
export async function previewSyncData(type?: 'price' | 'model'): Promise<SyncPreviewResponse> {
  const params = type ? `?type=${type}` : '';
  const response = await apiClient.get(`/_promptxy/sync/preview${params}`);
  return response.data;
}
