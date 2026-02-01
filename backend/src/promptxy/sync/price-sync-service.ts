/**
 * 价格同步服务
 *
 * 从 models.dev 同步模型价格数据到本地存储
 */

import type { SyncResult, StoredModelPrice } from '../types.js';
import { ModelsDevClient } from './models-dev-client.js';
import { getSyncStorage } from './sync-storage.js';

/**
 * 价格同步服务
 */
export class PriceSyncService {
  private client: ModelsDevClient;
  private storage = getSyncStorage();

  constructor() {
    this.client = new ModelsDevClient();
  }

  /**
   * 执行价格同步
   */
  async sync(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      type: 'price',
      status: 'success',
      recordsCount: 0,
      duration: 0,
      startedAt: startTime,
      finishedAt: 0,
    };

    try {
      // 从 models.dev 获取数据
      const data = await this.client.fetchWithCache();

      // 转换为价格数据
      const prices = this.client.convertToPrices(data);

      // 转换为存储格式
      const storedPrices: StoredModelPrice[] = prices.map((p) => ({
        modelName: p.modelName,
        provider: p.provider,
        inputPrice: p.inputPrice,
        outputPrice: p.outputPrice,
        cacheReadPrice: p.cacheReadPrice,
        cacheWritePrice: p.cacheWritePrice,
        source: 'models.dev',
        syncedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      // 保存到存储
      await this.storage.savePrices(storedPrices);

      result.recordsCount = storedPrices.length;
      result.status = 'success';
      result.finishedAt = Date.now();
      result.duration = result.finishedAt - startTime;
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      result.finishedAt = Date.now();
      result.duration = result.finishedAt - startTime;
    }

    return result;
  }

  /**
   * 获取指定模型的价格
   */
  getPrice(modelName: string): StoredModelPrice | undefined {
    return this.storage.getPrice(modelName);
  }

  /**
   * 获取所有价格
   */
  getAllPrices(): StoredModelPrice[] {
    return this.storage.getAllPrices();
  }

  /**
   * 获取指定供应商的价格
   */
  getPricesByProvider(provider: string): StoredModelPrice[] {
    return this.storage.getPricesByProvider(provider);
  }
}
