/**
 * 同步数据存储服务
 *
 * 负责同步相关数据的持久化存储：
 * - 模型价格数据 (model_prices.json)
 * - 模型列表数据 (model_lists.json)
 * - 同步日志 (sync_logs.json)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type {
  StoredModelPrice,
  StoredModelList,
  SyncLog,
} from '../types.js';
import { randomUUID } from 'node:crypto';

const DATA_DIR = path.join(os.homedir(), '.local', 'promptxy');
const SYNC_DIR = path.join(DATA_DIR, 'sync');
const PRICES_FILE = path.join(SYNC_DIR, 'model_prices.json');
const LISTS_FILE = path.join(SYNC_DIR, 'model_lists.json');
const LOGS_FILE = path.join(SYNC_DIR, 'sync_logs.json');

/**
 * 同步存储服务
 */
export class SyncStorage {
  private pricesCache: Map<string, StoredModelPrice> = new Map();
  private listsCache: Map<string, StoredModelList> = new Map();
  private logsCache: SyncLog[] = [];

  /**
   * 初始化存储
   */
  async init(): Promise<void> {
    // 确保 sync 目录存在
    await fs.mkdir(SYNC_DIR, { recursive: true });

    // 加载价格数据
    await this.loadPrices();

    // 加载模型列表数据
    await this.loadLists();

    // 加载日志数据
    await this.loadLogs();
  }

  /**
   * 加载价格数据
   */
  private async loadPrices(): Promise<void> {
    try {
      const raw = await fs.readFile(PRICES_FILE, 'utf-8');
      const prices: StoredModelPrice[] = JSON.parse(raw);
      this.pricesCache.clear();
      for (const price of prices) {
        this.pricesCache.set(price.modelName, price);
      }
    } catch (error) {
      // 文件不存在或解析失败，使用空缓存
      this.pricesCache.clear();
    }
  }

  /**
   * 加载模型列表数据
   */
  private async loadLists(): Promise<void> {
    try {
      const raw = await fs.readFile(LISTS_FILE, 'utf-8');
      const lists: StoredModelList[] = JSON.parse(raw);
      this.listsCache.clear();
      for (const list of lists) {
        const key = this.makeListKey(list.provider, list.protocol, list.modelName);
        this.listsCache.set(key, list);
      }
    } catch (error) {
      this.listsCache.clear();
    }
  }

  /**
   * 加载日志数据
   */
  private async loadLogs(): Promise<void> {
    try {
      const raw = await fs.readFile(LOGS_FILE, 'utf-8');
      this.logsCache = JSON.parse(raw);
    } catch (error) {
      this.logsCache = [];
    }
  }

  /**
   * 持久化价格数据到文件
   */
  private async persistPrices(): Promise<void> {
    const prices = Array.from(this.pricesCache.values());
    await fs.writeFile(PRICES_FILE, JSON.stringify(prices, null, 2), 'utf-8');
  }

  /**
   * 持久化模型列表数据到文件
   */
  private async persistLists(): Promise<void> {
    const lists = Array.from(this.listsCache.values());
    await fs.writeFile(LISTS_FILE, JSON.stringify(lists, null, 2), 'utf-8');
  }

  /**
   * 持久化日志数据到文件
   */
  private async persistLogs(): Promise<void> {
    await fs.writeFile(LOGS_FILE, JSON.stringify(this.logsCache, null, 2), 'utf-8');
  }

  /**
   * 生成模型列表的缓存键
   */
  private makeListKey(provider: string, protocol: string, modelName: string): string {
    return `${provider}:${protocol}:${modelName}`;
  }

  // ========================================================================
  // 价格数据操作
  // ========================================================================

  /**
   * 批量保存价格数据
   */
  async savePrices(prices: StoredModelPrice[]): Promise<void> {
    const now = Date.now();
    for (const price of prices) {
      price.updatedAt = now;
      this.pricesCache.set(price.modelName, price);
    }
    await this.persistPrices();
  }

  /**
   * 获取价格数据
   */
  getPrice(modelName: string): StoredModelPrice | undefined {
    return this.pricesCache.get(modelName);
  }

  /**
   * 获取所有价格数据
   */
  getAllPrices(): StoredModelPrice[] {
    return Array.from(this.pricesCache.values());
  }

  /**
   * 获取指定供应商的价格数据
   */
  getPricesByProvider(provider: string): StoredModelPrice[] {
    return Array.from(this.pricesCache.values()).filter(
      (p) => p.provider === provider
    );
  }

  // ========================================================================
  // 模型列表操作
  // ========================================================================

  /**
   * 批量保存模型列表数据
   */
  async saveLists(lists: StoredModelList[]): Promise<void> {
    const now = Date.now();
    for (const list of lists) {
      list.createdAt = list.createdAt || now;
      const key = this.makeListKey(list.provider, list.protocol, list.modelName);
      this.listsCache.set(key, list);
    }
    await this.persistLists();
  }

  /**
   * 获取指定供应商和协议的模型列表
   */
  getModels(provider: string, protocol: string): string[] {
    const prefix = `${provider}:${protocol}:`;
    return Array.from(this.listsCache.keys())
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.substring(prefix.length))
      .sort();
  }

  /**
   * 获取所有模型列表数据
   */
  getAllLists(): StoredModelList[] {
    return Array.from(this.listsCache.values());
  }

  /**
   * 搜索模型列表（用于前端 Combobox 候选）
   */
  searchModels(options: {
    protocol?: string;
    q?: string;
    limit?: number;
  }): Array<{ modelName: string; source: string }> {
    const protocol = options.protocol?.trim();
    const q = options.q?.trim().toLowerCase();
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));

    let lists = this.getAllLists();

    if (protocol) {
      lists = lists.filter(item => item.protocol === protocol);
    }

    if (q) {
      lists = lists.filter(item => item.modelName.toLowerCase().includes(q));
    }

    return lists
      .slice(0, limit)
      .map(item => ({ modelName: item.modelName, source: item.source }));
  }

  // ========================================================================
  // 日志操作
  // ========================================================================

  /**
   * 添加同步日志
   */
  async addLog(log: SyncLog): Promise<void> {
    log.id = log.id || randomUUID();
    log.createdAt = log.createdAt || Date.now();
    this.logsCache.unshift(log); // 最新的在前面

    // 限制日志数量（最多保留 500 条）
    if (this.logsCache.length > 500) {
      this.logsCache = this.logsCache.slice(0, 500);
    }

    await this.persistLogs();
  }

  /**
   * 获取同步日志
   */
  getLogs(limit?: number, type?: 'price' | 'model'): SyncLog[] {
    let logs = this.logsCache;

    if (type) {
      logs = logs.filter((log) => log.type === type);
    }

    if (limit) {
      logs = logs.slice(0, limit);
    }

    return logs;
  }

  /**
   * 清理旧日志（删除 30 天前的日志）
   */
  async cleanupOldLogs(): Promise<number> {
    const cutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const originalLength = this.logsCache.length;
    this.logsCache = this.logsCache.filter((log) => log.createdAt > cutoffTime);

    if (this.logsCache.length < originalLength) {
      await this.persistLogs();
    }

    return originalLength - this.logsCache.length;
  }
}

// 全局单例
let storageInstance: SyncStorage | null = null;

/**
 * 获取同步存储实例
 */
export function getSyncStorage(): SyncStorage {
  if (!storageInstance) {
    storageInstance = new SyncStorage();
  }
  return storageInstance;
}

/**
 * 重置存储实例（用于测试）
 */
export function resetSyncStorage(): void {
  storageInstance = null;
}
