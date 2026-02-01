/**
 * 模型列表同步服务
 *
 * 从 models.dev 同步模型列表数据到本地存储
 */

import type { SyncResult, StoredModelList } from '../types.js';
import { ModelsDevClient } from './models-dev-client.js';
import { getSyncStorage } from './sync-storage.js';

/**
 * 模型列表同步服务
 */
export class ModelSyncService {
  private client: ModelsDevClient;
  private storage = getSyncStorage();

  constructor() {
    this.client = new ModelsDevClient();
  }

  /**
   * 执行模型列表同步
   */
  async sync(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      type: 'model',
      status: 'success',
      recordsCount: 0,
      duration: 0,
      startedAt: startTime,
      finishedAt: 0,
    };

    try {
      // 从 models.dev 获取数据
      const data = await this.client.fetchWithCache();

      // 转换为模型列表数据
      const lists = this.client.convertToModelLists(data);

      // 转换为存储格式
      const storedLists: StoredModelList[] = lists.map((l) => ({
        modelName: l.modelName,
        provider: l.provider,
        protocol: l.protocol as StoredModelList['protocol'],
        source: 'models.dev',
        syncedAt: Date.now(),
        createdAt: Date.now(),
      }));

      // 保存到存储
      await this.storage.saveLists(storedLists);

      result.recordsCount = storedLists.length;
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
   * 获取指定供应商和协议的模型列表
   */
  getModels(provider: string, protocol: string): string[] {
    return this.storage.getModels(provider, protocol);
  }

  /**
   * 获取所有模型列表
   */
  getAllLists(): StoredModelList[] {
    return this.storage.getAllLists();
  }
}
