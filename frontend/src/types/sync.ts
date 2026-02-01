/**
 * 同步服务类型定义
 */

export interface SyncConfig {
  enabled: boolean;
  intervalHours: number;
  syncTime?: string;
  maxRetries: number;
  retryDelayMs: number;
  useProxy: boolean;
  sources: {
    prices: 'models.dev' | 'custom';
    models: 'models.dev' | 'custom';
  };
}

export interface SyncResult {
  type: 'price' | 'model';
  status: 'success' | 'failed' | 'partial';
  recordsCount: number;
  error?: string;
  duration: number;
  startedAt: number;
  finishedAt: number;
}

export interface SyncStatus {
  syncing: boolean;
  currentType?: 'price' | 'model' | 'all';
  lastSyncTime?: number;
  lastSyncResult?: SyncResult;
  nextSyncTime?: number;
}

export interface SyncLog {
  id: string;
  type: 'price' | 'model';
  status: 'success' | 'failed' | 'partial';
  recordsCount: number;
  errorMessage?: string;
  startedAt: number;
  finishedAt?: number;
  createdAt: number;

  // 计算属性：耗时（毫秒）
  duration?: number;
}

export interface SyncLogsResponse {
  logs: SyncLog[];
}

export interface SyncPreviewResponse {
  prices?: Array<{
    modelName: string;
    provider: string;
    inputPrice: number;
    outputPrice: number;
  }>;
  models?: Array<{
    modelName: string;
    provider: string;
    protocol: string;
  }>;
}
