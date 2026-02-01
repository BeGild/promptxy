# 模型列表自动同步 & 价格自动同步 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 实现 PromptXY 从 models.dev 自动同步模型价格和模型列表功能，支持定时自动同步和手动触发同步。

**架构:** 新建 sync 模块包含 ModelsDevClient（API 客户端）、PriceSyncService（价格同步）、ModelSyncService（模型列表同步）、SyncService（统一协调层）。数据持久化到现有文件系统存储（新增 sync 子目录），配置扩展到 PromptxyConfig。使用 node-cron 实现定时任务。

**技术栈:** TypeScript, node-cron, node-fetch (原生 fetch), 文件系统存储 (JSON), SSE (实时通知)

---

## 依赖安装

### Task 0: 安装必要依赖

**Files:**
- Modify: `package.json`

**Step 1: 添加 node-cron 依赖到 package.json**

```json
{
  "dependencies": {
    "@musistudio/llms": "^1.0.51",
    "js-yaml": "^4.1.1",
    "node-cron": "^3.0.3"
  }
}
```

**Step 2: 运行安装**

Run: `npm install`
Expected: 依赖安装成功，node_modules/node-cron 存在

**Step 3: 验证安装**

Run: `node -e "import('node-cron').then(() => console.log('OK'))"`
Expected: 输出 "OK"，无错误

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: 添加 node-cron 依赖用于定时同步任务"
```

---

## 阶段一：类型定义与数据模型

### Task 1: 扩展 types.ts 添加同步相关类型

**Files:**
- Modify: `backend/src/promptxy/types.ts`

**Step 1: 在 types.ts 末尾添加同步相关类型定义**

```typescript
// ============================================================================
// 同步服务类型
// ============================================================================

/**
 * 同步配置
 */
export interface SyncConfig {
  /** 是否启用定时同步 */
  enabled: boolean;
  /** 同步间隔（小时） */
  intervalHours: number;
  /** 具体同步时间（HH:mm 格式，可选） */
  syncTime?: string;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelayMs: number;
  /** 是否使用代理 */
  useProxy: boolean;
  /** 数据源配置 */
  sources: {
    /** 价格数据源 */
    prices: 'models.dev' | 'custom';
    /** 模型列表数据源 */
    models: 'models.dev' | 'custom';
  };
}

/**
 * 同步结果
 */
export interface SyncResult {
  /** 同步类型 */
  type: 'price' | 'model';
  /** 同步状态 */
  status: 'success' | 'failed' | 'partial';
  /** 同步记录数 */
  recordsCount: number;
  /** 错误信息 */
  error?: string;
  /** 耗时（毫秒） */
  duration: number;
  /** 开始时间戳 */
  startedAt: number;
  /** 完成时间戳 */
  finishedAt: number;
}

/**
 * 同步状态
 */
export interface SyncStatus {
  /** 是否正在同步 */
  syncing: boolean;
  /** 当前同步类型 */
  currentType?: 'price' | 'model' | 'all';
  /** 上次同步时间 */
  lastSyncTime?: number;
  /** 上次同步结果 */
  lastSyncResult?: SyncResult;
  /** 下次同步时间 */
  nextSyncTime?: number;
}

/**
 * 模型价格数据（来自 models.dev）
 */
export interface ModelPriceData {
  /** 模型名称 */
  id: string;
  /** 价格信息 */
  cost: {
    /** 输入价格（美元/1M tokens） */
    input: number;
    /** 输出价格（美元/1M tokens） */
    output: number;
    /** 缓存读取价格 */
    cache_read?: number;
    /** 缓存写入价格 */
    cache_write?: number;
  };
}

/**
 * models.dev API 响应格式
 */
export interface ModelsDevResponse {
  [provider: string]: {
    models: {
      [modelName: string]: ModelPriceData;
    };
  };
}

/**
 * 同步日志记录
 */
export interface SyncLog {
  /** 日志 ID */
  id: string;
  /** 同步类型 */
  type: 'price' | 'model';
  /** 同步状态 */
  status: 'success' | 'failed' | 'partial';
  /** 记录数 */
  recordsCount: number;
  /** 错误信息 */
  errorMessage?: string;
  /** 开始时间戳 */
  startedAt: number;
  /** 完成时间戳 */
  finishedAt?: number;
  /** 创建时间戳 */
  createdAt: number;
}

/**
 * 存储的模型价格数据
 */
export interface StoredModelPrice {
  /** 模型名称 */
  modelName: string;
  /** 供应商 */
  provider: string;
  /** 输入价格（美元/1K tokens） */
  inputPrice: number;
  /** 输出价格（美元/1K tokens） */
  outputPrice: number;
  /** 缓存读取价格 */
  cacheReadPrice: number;
  /** 缓存写入价格 */
  cacheWritePrice: number;
  /** 数据来源 */
  source: string;
  /** 同步时间戳 */
  syncedAt: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/**
 * 存储的模型列表数据
 */
export interface StoredModelList {
  /** 模型名称 */
  modelName: string;
  /** 供应商 */
  provider: string;
  /** 协议类型 */
  protocol: 'anthropic' | 'openai-codex' | 'openai-chat' | 'gemini';
  /** 数据来源 */
  source: string;
  /** 同步时间戳 */
  syncedAt: number;
  /** 创建时间戳 */
  createdAt: number;
}
```

**Step 2: 验证类型定义**

Run: `cd backend && npx tsc --noEmit`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add backend/src/promptxy/types.ts
git commit -m "types: 添加同步服务相关类型定义"
```

### Task 2: 扩展 PromptxyConfig 添加 sync 配置

**Files:**
- Modify: `backend/src/promptxy/types.ts`

**Step 1: 在 PromptxyConfig 接口中添加 sync 字段**

找到 `export interface PromptxyConfig` 定义，在末尾添加：

```typescript
export interface PromptxyConfig {
  listen: ListenConfig;
  suppliers: Supplier[];
  routes: Route[];
  rules: PromptxyRule[];
  storage: {
    maxHistory: number;
  };
  debug: boolean;
  // 新增：同步配置
  sync?: SyncConfig;
}
```

**Step 2: 在 DEFAULT_CONFIG 中添加默认 sync 配置**

在 `backend/src/promptxy/config.ts` 的 `DEFAULT_CONFIG` 中添加：

```typescript
const DEFAULT_CONFIG: PromptxyConfig = {
  // ... 现有配置
  debug: false,
  // 新增：默认同步配置
  sync: {
    enabled: false,           // 默认不启用自动同步
    intervalHours: 24,        // 每24小时同步一次
    syncTime: '03:00',        // 凌晨3点执行
    maxRetries: 3,            // 最多重试3次
    retryDelayMs: 5000,       // 重试延迟5秒
    useProxy: false,          // 默认不使用代理
    sources: {
      prices: 'models.dev',
      models: 'models.dev',
    },
  },
};
```

**Step 3: 验证配置**

Run: `cd backend && npx tsc --noEmit`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add backend/src/promptxy/types.ts backend/src/promptxy/config.ts
git commit -m "config: 添加 sync 配置到 PromptxyConfig"
```

---

## 阶段二：数据存储层

### Task 3: 创建同步数据存储服务

**Files:**
- Create: `backend/src/promptxy/sync/sync-storage.ts`

**Step 1: 创建 sync-storage.ts 文件**

```typescript
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
  ModelsDevResponse,
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
   * 保存价格数据
   */
  private async savePrices(): Promise<void> {
    const prices = Array.from(this.pricesCache.values());
    await fs.writeFile(PRICES_FILE, JSON.stringify(prices, null, 2), 'utf-8');
  }

  /**
   * 保存模型列表数据
   */
  private async saveLists(): Promise<void> {
    const lists = Array.from(this.listsCache.values());
    await fs.writeFile(LISTS_FILE, JSON.stringify(lists, null, 2), 'utf-8');
  }

  /**
   * 保存日志数据
   */
  private async saveLogs(): Promise<void> {
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
    await this.savePrices();
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
    await this.saveLists();
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

    await this.saveLogs();
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
      await this.saveLogs();
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
```

**Step 2: 验证代码编译**

Run: `cd backend && npx tsc --noEmit`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add backend/src/promptxy/sync/sync-storage.ts
git commit -m "sync: 创建同步数据存储服务"
```

---

## 阶段三：API 客户端

### Task 4: 创建 models.dev API 客户端

**Files:**
- Create: `backend/src/promptxy/sync/models-dev-client.ts`

**Step 1: 创建 models-dev-client.ts 文件**

```typescript
/**
 * models.dev API 客户端
 *
 * 从 models.dev 获取模型价格和列表数据
 * API: https://github.com/sst/models.dev
 */

import type { ModelsDevResponse, ModelPriceData } from '../types.js';

const API_URL = 'https://models.dev/api.json';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24小时缓存

/**
 * 缓存数据
 */
interface CachedData {
  data: ModelsDevResponse;
  timestamp: number;
}

/**
 * models.dev API 客户端
 */
export class ModelsDevClient {
  private cache: CachedData | null = null;

  /**
   * 获取完整数据（带缓存）
   */
  async fetchWithCache(maxAge: number = CACHE_MAX_AGE): Promise<ModelsDevResponse> {
    // 检查缓存
    if (this.cache && Date.now() - this.cache.timestamp < maxAge) {
      return this.cache.data;
    }

    // 获取新数据
    const data = await this.fetchAll();

    // 更新缓存
    this.cache = {
      data,
      timestamp: Date.now(),
    };

    return data;
  }

  /**
   * 获取完整数据
   */
  async fetchAll(): Promise<ModelsDevResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    try {
      const response = await fetch(API_URL, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PromptXY/2.0',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as ModelsDevResponse;
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时（30秒）');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 获取指定供应商的模型数据
   */
  async fetchByProvider(provider: string): Promise<Record<string, ModelPriceData>> {
    const data = await this.fetchWithCache();
    return data[provider]?.models || {};
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * 将 models.dev 响应转换为价格数据数组
   */
  convertToPrices(data: ModelsDevResponse): Array<{
    modelName: string;
    provider: string;
    inputPrice: number;
    outputPrice: number;
    cacheReadPrice: number;
    cacheWritePrice: number;
  }> {
    const prices: Array<{
      modelName: string;
      provider: string;
      inputPrice: number;
      outputPrice: number;
      cacheReadPrice: number;
      cacheWritePrice: number;
    }> = [];

    for (const [provider, providerData] of Object.entries(data)) {
      for (const [modelName, modelData] of Object.entries(providerData.models)) {
        prices.push({
          modelName: modelName.toLowerCase(),
          provider,
          inputPrice: modelData.cost.input / 1000, // 转换为美元/1K tokens
          outputPrice: modelData.cost.output / 1000,
          cacheReadPrice: (modelData.cost.cache_read || 0) / 1000,
          cacheWritePrice: (modelData.cost.cache_write || 0) / 1000,
        });
      }
    }

    return prices;
  }

  /**
   * 将 models.dev 响应转换为模型列表数据数组
   */
  convertToModelLists(data: ModelsDevResponse): Array<{
    modelName: string;
    provider: string;
    protocol: string;
  }> {
    const lists: Array<{
      modelName: string;
      provider: string;
      protocol: string;
    }> = [];

    const providerProtocolMap: Record<string, string> = {
      openai: 'openai-chat',
      anthropic: 'anthropic',
      google: 'gemini',
    };

    for (const [provider, providerData] of Object.entries(data)) {
      const protocol = providerProtocolMap[provider] || provider;
      for (const modelName of Object.keys(providerData.models)) {
        lists.push({
          modelName: modelName.toLowerCase(),
          provider,
          protocol,
        });
      }
    }

    return lists;
  }
}
```

**Step 2: 验证编译**

Run: `cd backend && npx tsc --noEmit`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add backend/src/promptxy/sync/models-dev-client.ts
git commit -m "sync: 创建 models.dev API 客户端"
```

---

## 阶段四：同步服务核心

### Task 5: 创建价格同步服务

**Files:**
- Create: `backend/src/promptxy/sync/price-sync-service.ts`

**Step 1: 创建 price-sync-service.ts 文件**

```typescript
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
      result.duration = result.finishedAt - result.startTime;
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      result.finishedAt = Date.now();
      result.duration = result.finishedAt - result.startTime;
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
```

**Step 2: 验证编译**

Run: `cd backend && npx tsc --noEmit`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add backend/src/promptxy/sync/price-sync-service.ts
git commit -m "sync: 创建价格同步服务"
```

### Task 6: 创建模型列表同步服务

**Files:**
- Create: `backend/src/promptxy/sync/model-sync-service.ts`

**Step 1: 创建 model-sync-service.ts 文件**

```typescript
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
      result.duration = result.finishedAt - result.startTime;
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      result.finishedAt = Date.now();
      result.duration = result.finishedAt - result.startTime;
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
```

**Step 2: 验证编译**

Run: `cd backend && npx tsc --noEmit`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add backend/src/promptxy/sync/model-sync-service.ts
git commit -m "sync: 创建模型列表同步服务"
```

### Task 7: 创建统一同步服务

**Files:**
- Create: `backend/src/promptxy/sync/sync-service.ts`

**Step 1: 创建 sync-service.ts 文件**

```typescript
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
```

**Step 2: 验证编译**

Run: `cd backend && npx tsc --noEmit`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add backend/src/promptxy/sync/sync-service.ts
git commit -m "sync: 创建统一同步服务"
```

---

## 阶段五：API 接口

### Task 8: 添加同步 API handlers

**Files:**
- Modify: `backend/src/promptxy/api-handlers.ts`

**Step 1: 在 api-handlers.ts 顶部添加同步服务导入**

在现有导入后添加：

```typescript
import { getSyncService, type SyncService } from './sync/sync-service.js';
import { getSyncStorage } from './sync/sync-storage.js';
```

**Step 2: 在 setupServer 函数中注册同步相关路由**

找到 `setupServer` 函数中路由注册部分，在现有路由后添加：

```typescript
// ========================================================================
// 同步服务路由
// ========================================================================

/**
 * GET /_promptxy/sync/config - 获取同步配置
 */
server.get('/_promptxy/sync/config', async (_req, reply) => {
  const config = configService.getConfig();
  reply.send(config.sync || {
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
});

/**
 * PUT /_promptxy/sync/config - 更新同步配置
 */
server.put('/_promptxy/sync/config', async (req, reply) => {
  try {
    const syncConfig = req.body as any;
    const config = configService.getConfig();

    // 更新配置
    config.sync = {
      ...config.sync,
      ...syncConfig,
    };

    await configService.saveConfig(config);

    // 重启同步服务
    const syncService = getSyncService();
    await syncService.init(config.sync);

    reply.send({ success: true, config: config.sync });
  } catch (error) {
    reply.code(400).send({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /_promptxy/sync/trigger - 手动触发同步
 */
server.post('/_promptxy/sync/trigger', async (req, reply) => {
  try {
    const body = req.body as any;
    const type = body.type || 'all';

    const syncService = getSyncService();
    const results = await syncService.executeSync(type);

    reply.send({
      success: true,
      results,
    });
  } catch (error) {
    reply.code(500).send({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /_promptxy/sync/price - 同步价格
 */
server.post('/_promptxy/sync/price', async (_req, reply) => {
  try {
    const syncService = getSyncService();
    const result = await syncService.syncPrices();

    reply.send({
      success: result.status === 'success',
      result,
    });
  } catch (error) {
    reply.code(500).send({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /_promptxy/sync/models - 同步模型列表
 */
server.post('/_promptxy/sync/models', async (_req, reply) => {
  try {
    const syncService = getSyncService();
    const result = await syncService.syncModels();

    reply.send({
      success: result.status === 'success',
      result,
    });
  } catch (error) {
    reply.code(500).send({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /_promptxy/sync/status - 获取同步状态
 */
server.get('/_promptxy/sync/status', async (_req, reply) => {
  const syncService = getSyncService();
  const status = syncService.getStatus();
  reply.send(status);
});

/**
 * GET /_promptxy/sync/logs - 获取同步日志
 */
server.get('/_promptxy/sync/logs', async (req, reply) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  const type = req.query.type as 'price' | 'model' | undefined;

  const syncService = getSyncService();
  const logs = syncService.getLogs(limit, type);

  reply.send({ logs });
});

/**
 * GET /_promptxy/sync/preview - 预览即将同步的数据
 */
server.get('/_promptxy/sync/preview', async (req, reply) => {
  const type = req.query.type as 'price' | 'model' | undefined;
  const storage = getSyncStorage();

  let data: any = {};

  if (!type || type === 'price') {
    data.prices = storage.getAllPrices().slice(0, 10); // 只返回前10条
  }

  if (!type || type === 'model') {
    data.models = storage.getAllLists().slice(0, 10);
  }

  reply.send(data);
});
```

**Step 3: 验证编译**

Run: `cd backend && npx tsc --noEmit`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add backend/src/promptxy/api-handlers.ts
git commit -m "api: 添加同步服务 API 接口"
```

---

## 阶段六：启动集成

### Task 9: 在 main.ts 中初始化同步服务

**Files:**
- Modify: `backend/src/main.ts`

**Step 1: 在 main.ts 中添加同步服务初始化**

找到主服务启动代码后，添加同步服务初始化：

```typescript
import { getSyncService } from './promptxy/sync/sync-service.js';

// 在主服务启动后添加
async function main() {
  // ... 现有代码 ...

  // 启动主服务器
  const config = configService.getConfig();

  // 初始化同步服务
  const syncService = getSyncService();
  if (config.sync) {
    await syncService.init(config.sync);
    console.log('[Main] 同步服务已初始化');
  }

  // ... 其他代码 ...
}
```

**Step 2: 验证编译**

Run: `cd backend && npx tsc --noEmit`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add backend/src/main.ts
git commit -m "main: 在启动时初始化同步服务"
```

---

## 阶段七：前端实现

### Task 10: 创建前端同步类型定义

**Files:**
- Create: `frontend/src/types/sync.ts`

**Step 1: 创建 sync.ts 类型文件**

```typescript
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
```

**Step 2: Commit**

```bash
git add frontend/src/types/sync.ts
git commit -m "types(frontend): 添加同步服务类型定义"
```

### Task 11: 创建同步 API 客户端

**Files:**
- Create: `frontend/src/api/sync.ts`

**Step 1: 创建 sync.ts API 客户端**

```typescript
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
```

**Step 2: Commit**

```bash
git add frontend/src/api/sync.ts
git commit -m "api(frontend): 创建同步服务 API 客户端"
```

### Task 12: 创建同步管理页面

**Files:**
- Create: `frontend/src/pages/SyncManagementPage.tsx`

**Step 1: 创建同步管理页面组件**

```typescript
/**
 * 同步管理页面
 *
 * STYLESYSTEM COMPLIANCE: 使用 Tailwind 语义类名和 CSS 变量
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Save,
  Settings,
  History,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Database,
  DollarSign,
  List,
} from 'lucide-react';
import { Button } from '@heroui/react';
import {
  getSyncConfig,
  updateSyncConfig,
  getSyncStatus,
  getSyncLogs,
  syncPrices,
  syncModels,
  triggerSync,
  type SyncConfig,
  type SyncStatus,
  type SyncLog,
} from '@/api/sync';

const SyncManagementPageComponent: React.FC = () => {
  const queryClient = useQueryClient();

  // 获取同步配置
  const {
    data: config,
    isLoading: configLoading,
  } = useQuery({
    queryKey: ['sync', 'config'],
    queryFn: getSyncConfig,
    refetchInterval: false,
  });

  // 获取同步状态
  const {
    data: status,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['sync', 'status'],
    queryFn: getSyncStatus,
    refetchInterval: 5000, // 每5秒刷新状态
  });

  // 获取同步日志
  const {
    data: logsData,
  } = useQuery({
    queryKey: ['sync', 'logs'],
    queryFn: () => getSyncLogs(20),
    refetchInterval: 10000, // 每10秒刷新日志
  });

  const logs = logsData?.logs || [];

  // 配置状态
  const [editConfig, setEditConfig] = useState<SyncConfig | null>(null);

  // 同步操作 mutations
  const syncPricesMutation = useMutation({
    mutationFn: syncPrices,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });

  const syncModelsMutation = useMutation({
    mutationFn: syncModels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: () => triggerSync('all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: updateSyncConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });

  // 初始化编辑状态
  useEffect(() => {
    if (config && !editConfig) {
      setEditConfig({ ...config });
    }
  }, [config, editConfig]);

  // 格式化时间戳
  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  // 格式化持续时间
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // 获取状态图标
  const getStatusIcon = (status: 'success' | 'failed' | 'partial') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success-default" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-danger-default" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-warning-default" />;
    }
  };

  // 保存配置
  const handleSaveConfig = async () => {
    if (!editConfig) return;
    await updateConfigMutation.mutateAsync(editConfig);
  };

  if (configLoading || !config || !editConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  const syncing = status?.syncing || false;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-primary to-accent bg-clip-text text-transparent">
            数据同步
          </h1>
          <p className="text-sm text-secondary mt-1">管理模型价格和列表的自动同步</p>
        </div>
      </div>

      {/* 同步配置 */}
      <div className="bg-elevated rounded-lg p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-brand-primary" />
          <h2 className="text-lg font-semibold">同步配置</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 启用自动同步 */}
          <div className="flex items-center justify-between">
            <label className="text-sm">启用自动同步</label>
            <input
              type="checkbox"
              checked={editConfig.enabled}
              onChange={(e) => setEditConfig({ ...editConfig, enabled: e.target.checked })}
              className="w-4 h-4"
            />
          </div>

          {/* 同步间隔 */}
          <div className="flex items-center justify-between">
            <label className="text-sm">同步间隔</label>
            <select
              value={editConfig.intervalHours.toString()}
              onChange={(e) => setEditConfig({ ...editConfig, intervalHours: parseInt(e.target.value) })}
              className="bg-surface border border-border rounded px-3 py-1 text-sm"
            >
              <option value="1">每小时</option>
              <option value="6">每6小时</option>
              <option value="12">每12小时</option>
              <option value="24">每天</option>
              <option value="168">每周</option>
            </select>
          </div>

          {/* 具体时间 */}
          <div className="flex items-center justify-between">
            <label className="text-sm">具体时间</label>
            <input
              type="time"
              value={editConfig.syncTime || ''}
              onChange={(e) => setEditConfig({ ...editConfig, syncTime: e.target.value })}
              className="bg-surface border border-border rounded px-3 py-1 text-sm"
            />
          </div>

          {/* 最大重试 */}
          <div className="flex items-center justify-between">
            <label className="text-sm">最大重试次数</label>
            <input
              type="number"
              min="0"
              max="10"
              value={editConfig.maxRetries}
              onChange={(e) => setEditConfig({ ...editConfig, maxRetries: parseInt(e.target.value) || 0 })}
              className="bg-surface border border-border rounded px-3 py-1 text-sm w-20"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            color="primary"
            variant="flat"
            size="sm"
            startContent={<Save className="w-4 h-4" />}
            onPress={handleSaveConfig}
            isDisabled={updateConfigMutation.isPending}
          >
            {updateConfigMutation.isPending ? '保存中...' : '保存配置'}
          </Button>
        </div>
      </div>

      {/* 手动触发 */}
      <div className="bg-elevated rounded-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">手动触发</h2>
            <p className="text-sm text-secondary mt-1">
              上次同步: {formatTime(status?.lastSyncTime)}
            </p>
          </div>
          {status?.lastSyncResult && (
            <div className="flex items-center gap-2 text-sm">
              {getStatusIcon(status.lastSyncResult.status)}
              <span>
                {status.lastSyncResult.recordsCount} 条记录
                ({formatDuration(status.lastSyncResult.duration)})
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            color="primary"
            variant="flat"
            startContent={<DollarSign className="w-4 h-4" />}
            onPress={() => syncPricesMutation.mutate()}
            isDisabled={syncing || syncPricesMutation.isPending}
            isLoading={syncPricesMutation.isPending}
          >
            同步价格
          </Button>

          <Button
            color="primary"
            variant="flat"
            startContent={<List className="w-4 h-4" />}
            onPress={() => syncModelsMutation.mutate()}
            isDisabled={syncing || syncModelsMutation.isPending}
            isLoading={syncModelsMutation.isPending}
          >
            同步模型列表
          </Button>

          <Button
            color="primary"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={() => syncAllMutation.mutate()}
            isDisabled={syncing || syncAllMutation.isPending}
            isLoading={syncAllMutation.isPending}
          >
            {syncing ? '同步中...' : '同步全部'}
          </Button>
        </div>
      </div>

      {/* 同步日志 */}
      <div className="bg-elevated rounded-lg p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-brand-primary" />
          <h2 className="text-lg font-semibold">同步日志</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3">时间</th>
                <th className="text-left py-2 px-3">类型</th>
                <th className="text-left py-2 px-3">状态</th>
                <th className="text-left py-2 px-3">记录数</th>
                <th className="text-left py-2 px-3">耗时</th>
                <th className="text-left py-2 px-3">错误</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-secondary">
                    暂无同步日志
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-surface/50">
                    <td className="py-2 px-3">{formatTime(log.startedAt)}</td>
                    <td className="py-2 px-3">
                      {log.type === 'price' ? '价格' : '模型列表'}
                    </td>
                    <td className="py-2 px-3">{getStatusIcon(log.status)}</td>
                    <td className="py-2 px-3">{log.recordsCount.toLocaleString()}</td>
                    <td className="py-2 px-3">
                      {log.finishedAt ? formatDuration(log.finishedAt - log.startedAt) : '-'}
                    </td>
                    <td className="py-2 px-3 text-danger-default truncate max-w-xs">
                      {log.errorMessage || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const SyncManagementPage = React.memo(SyncManagementPageComponent);
```

**Step 2: Commit**

```bash
git add frontend/src/pages/SyncManagementPage.tsx
git commit -m "feat(frontend): 创建同步管理页面"
```

### Task 13: 添加路由和导航

**Files:**
- Modify: `frontend/src/router/index.tsx`
- Modify: `frontend/src/App.tsx` (如果需要)

**Step 1: 在路由中添加同步管理页面**

找到路由定义文件，添加同步管理页面路由：

```typescript
import { SyncManagementPage } from '@/pages/SyncManagementPage';

// 在路由配置中添加
{
  path: '/sync',
  element: <SyncManagementPage />,
}
```

**Step 2: 在导航菜单中添加链接**

找到导航菜单配置，添加同步管理入口：

```typescript
{
  key: 'sync',
  label: '数据同步',
  icon: RefreshCw,
  path: '/sync',
}
```

**Step 3: 验证前端编译**

Run: `cd frontend && npm run build`
Expected: 构建成功，无错误

**Step 4: Commit**

```bash
git add frontend/src/router/index.tsx
git commit -m "feat(frontend): 添加同步管理页面路由"
```

---

## 阶段八：测试与验证

### Task 14: 编写后端单元测试

**Files:**
- Create: `backend/src/sync/sync.test.ts`

**Step 1: 创建测试文件**

```typescript
/**
 * 同步服务单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModelsDevClient } from '../sync/models-dev-client.js';
import { PriceSyncService } from '../sync/price-sync-service.js';
import { ModelSyncService } from '../sync/model-sync-service.js';

describe('ModelsDevClient', () => {
  let client: ModelsDevClient;

  beforeEach(() => {
    client = new ModelsDevClient();
  });

  it('should fetch data from API', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as any;

    const data = await client.fetchAll();
    expect(data).toBeDefined();
  });
});

describe('PriceSyncService', () => {
  it('should sync prices successfully', async () => {
    // 测试实现
  });
});

describe('ModelSyncService', () => {
  it('should sync model lists successfully', async () => {
    // 测试实现
  });
});
```

**Step 2: 运行测试**

Run: `npm test -- sync.test.ts`
Expected: 测试通过

**Step 3: Commit**

```bash
git add backend/src/sync/sync.test.ts
git commit -m "test: 添加同步服务单元测试"
```

### Task 15: 端到端测试

**Step 1: 启动开发服务器**

Run: `./scripts/dev.sh &`
Expected: 后端和前端都启动成功

**Step 2: 测试同步功能**

1. 访问 `http://localhost:5173/sync`
2. 验证页面显示正常
3. 点击 "同步价格" 按钮
4. 验证同步成功，日志显示记录
5. 修改同步配置
6. 保存并验证配置更新

**Step 3: 验证数据持久化**

Run: `ls -la ~/.local/promptxy/sync/`
Expected: 存在 model_prices.json, model_lists.json, sync_logs.json

**Step 4: 清理测试进程**

Run: `pkill -f "tsx backend/src/main.ts" && pkill -f "vite"`
Expected: 进程已终止

---

## 验收标准

### 功能验收

- [ ] 可以手动触发价格同步
- [ ] 可以手动触发模型列表同步
- [ ] 可以一键同步所有数据
- [ ] 同步结果正确记录到日志
- [ ] 可以查看同步历史日志
- [ ] 可以配置自动同步（启用/禁用、间隔、时间）
- [ ] 配置保存后自动生效
- [ ] 同步失败时自动重试
- [ ] 数据正确持久化到文件系统

### 性能验收

- [ ] 单次同步（价格+模型）在 30 秒内完成
- [ ] 定时任务不影响主服务性能
- [ ] 前端页面响应流畅

### 兼容性验收

- [ ] 向后兼容，不影响现有功能
- [ ] 配置文件升级正确处理
- [ ] 旧版本配置可以正常迁移

---

## 回滚计划

如果出现问题，可以按以下步骤回滚：

1. `git revert <commit-hash>` - 逐个回滚提交
2. 或 `git reset --hard <stable-commit>` - 回滚到稳定版本

关键检查点：
- Task 9 后：验证主服务可以正常启动
- Task 13 后：验证前端可以正常加载
- Task 15 后：完整功能验证

---

**实施完成后请更新以下文档：**
- README.md：添加同步功能说明
- docs/configuration.md：添加 sync 配置说明
- CHANGELOG.md：记录版本更新
