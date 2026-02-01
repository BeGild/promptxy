/**
 * 统一同步服务
 *
 * 协调价格同步和模型列表同步，提供定时任务调度
 */

import cron from 'node-cron';
import type { SyncConfig, SyncResult, SyncStatus, SyncLog } from '../types.js';
import { PriceSyncService } from './price-sync-service.js';
import { ModelSyncService } from './model-sync-service.js';
import { getSyncStorage, type SyncStorage } from './sync-storage.js';

/**
 * 统一同步服务
 */
export class SyncService {
  private priceService: PriceSyncService;
  private modelService: ModelSyncService;
  private storage: SyncStorage;
  private scheduler: cron.ScheduledTask | null = null;
  private currentSync: { type: 'price' | 'model' | 'all' } | null = null;

  constructor() {
    this.priceService = new PriceSyncService();
    this.modelService = new ModelSyncService();
    this.storage = getSyncStorage();
  }

  /**
   * 初始化同步服务
   */
  async init(config: SyncConfig): Promise<void> {
    // 初始化存储
    await this.storage.init();

    // 启动定时任务（如果启用）
    if (config.enabled) {
      this.startScheduler(config);
    }
  }

  /**
   * 启动定时调度器
   */
  startScheduler(config: SyncConfig): void {
    this.stopScheduler();

    // 生成 cron 表达式
    const cronExpr = this.buildCronExpression(config);

    this.scheduler = cron.schedule(cronExpr, async () => {
      await this.executeSyncWithRetry(config, 'all');
    });

    console.log(`[SyncService] 定时同步已启动: ${cronExpr}`);
  }

  /**
   * 停止定时调度器
   */
  stopScheduler(): void {
    if (this.scheduler) {
      this.scheduler.stop();
      this.scheduler = null;
      console.log('[SyncService] 定时同步已停止');
    }
  }

  /**
   * 生成 cron 表达式
   */
  private buildCronExpression(config: SyncConfig): string {
    if (config.syncTime) {
      // 具体时间格式：HH:mm -> cron: "mm HH * * *"
      const [hour, minute] = config.syncTime.split(':');
      return `${minute} ${hour} * * *`;
    }

    // 默认：每天凌晨3点
    return '0 3 * * *';
  }

  /**
   * 执行同步（带重试）
   */
  private async executeSyncWithRetry(
    config: SyncConfig,
    type: 'price' | 'model' | 'all'
  ): Promise<SyncResult[]> {
    const maxRetries = config.maxRetries;
    const retryDelay = config.retryDelayMs;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const results = await this.executeSync(type);
        return results;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const delay = retryDelay * (attempt + 1);
          console.log(`[SyncService] 同步失败，${delay}ms 后重试 (${attempt + 1}/${maxRetries})`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 执行同步
   */
  async executeSync(type: 'price' | 'model' | 'all'): Promise<SyncResult[]> {
    this.currentSync = { type };

    try {
      const results: SyncResult[] = [];

      if (type === 'price' || type === 'all') {
        const priceResult = await this.priceService.sync();
        results.push(priceResult);
        await this.saveLog(priceResult);
      }

      if (type === 'model' || type === 'all') {
        const modelResult = await this.modelService.sync();
        results.push(modelResult);
        await this.saveLog(modelResult);
      }

      return results;
    } finally {
      this.currentSync = null;
    }
  }

  /**
   * 保存同步日志
   */
  private async saveLog(result: SyncResult): Promise<void> {
    const log: SyncLog = {
      id: '',
      type: result.type,
      status: result.status,
      recordsCount: result.recordsCount,
      errorMessage: result.error,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      createdAt: Date.now(),
    };

    await this.storage.addLog(log);
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ========================================================================
  // 公共 API
  // ========================================================================

  /**
   * 手动触发价格同步
   */
  async syncPrices(): Promise<SyncResult> {
    const results = await this.executeSync('price');
    return results[0];
  }

  /**
   * 手动触发模型列表同步
   */
  async syncModels(): Promise<SyncResult> {
    const results = await this.executeSync('model');
    return results[0];
  }

  /**
   * 同步所有（价格 + 模型列表）
   */
  async syncAll(): Promise<SyncResult[]> {
    return this.executeSync('all');
  }

  /**
   * 获取同步状态
   */
  getStatus(): SyncStatus {
    const logs = this.storage.getLogs(1);
    const lastLog = logs[0];

    return {
      syncing: this.currentSync !== null,
      currentType: this.currentSync?.type,
      lastSyncTime: lastLog?.finishedAt,
      lastSyncResult: lastLog
        ? {
            type: lastLog.type,
            status: lastLog.status,
            recordsCount: lastLog.recordsCount,
            error: lastLog.errorMessage,
            duration: (lastLog.finishedAt || 0) - lastLog.startedAt,
            startedAt: lastLog.startedAt,
            finishedAt: lastLog.finishedAt || 0,
          }
        : undefined,
    };
  }

  /**
   * 获取同步日志
   */
  getLogs(limit?: number, type?: 'price' | 'model'): SyncLog[] {
    return this.storage.getLogs(limit, type);
  }
}

// 全局单例
let syncServiceInstance: SyncService | null = null;

/**
 * 获取同步服务实例
 */
export function getSyncService(): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService();
  }
  return syncServiceInstance;
}

/**
 * 重置同步服务实例（用于测试）
 */
export function resetSyncService(): void {
  if (syncServiceInstance) {
    syncServiceInstance.stopScheduler();
  }
  syncServiceInstance = null;
}
