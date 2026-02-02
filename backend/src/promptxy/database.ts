import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as yaml from 'js-yaml';
import {
  RequestRecord,
  RequestListResponse,
  PathsResponse,
  ParsedSSEEvent,
  StatsMetrics,
  StatsTotal,
  StatsDaily,
  StatsHourly,
  StatsSupplier,
  StatsModel,
  StatsRoute,
  StatsToday,
  StatsCache as ExtendedStatsCache,
  emptyStatsMetrics,
} from './types.js';
import { getPricingService } from './pricing.js';

// ============================================================
// 类型定义
// ============================================================

/**
 * 请求索引结构（内存中的轻量级记录）
 */
interface RequestIndex {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  requestSize?: number;
  responseSize?: number;
  responseStatus?: number;
  durationMs?: number;
  error?: string;
  matchedRulesBrief: string[];

  // 供应商和转换信息
  supplierName?: string;
  supplierClient?: string;
  transformerChain?: string[];
  transformedPath?: string;
}

/**
 * 请求文件内容（完整数据）
 */
interface RequestFile {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  requestSize?: number;
  responseSize?: number;
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: Record<string, string> | string;
  originalBody: string;
  transformedBody?: string; // 转换器处理后的请求体（可选）
  modifiedBody: string;
  responseBody?: string | ParsedSSEEvent[];
  matchedRules: string;
  error?: string;
  requestHeaders?: Record<string, string> | string; // 协议转换后的请求头
  originalRequestHeaders?: Record<string, string> | string; // 原始请求头
  // 路由 / 供应商 / 转换信息
  routeId?: string;
  supplierId?: string;
  supplierName?: string;
  supplierBaseUrl?: string;
  supplierClient?: string; // 供应商客户端类型（如 'codex', 'claude', 'gemini'）
  transformerChain?: string;
  transformTrace?: string;
  transformedPath?: string; // 转换后的请求路径
  // 统计相关字段
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputCost?: number;
  outputCost?: number;
  totalCost?: number;
}

/**
 * 解析 headers 字段（兼容 JSON 字符串和对象格式）
 */
function parseHeaders(
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
 * 统计缓存结构（扩展版）
 */
interface StatsCache {
  // 现有字段
  byClient: Record<string, number>;
  lastCleanup: number;

  // 新增统计字段
  total: StatsTotal;
  daily: Record<string, StatsDaily>;
  hourly: Record<string, StatsHourly>;
  supplier: Record<string, StatsSupplier>;
  model: Record<string, StatsModel>;
  route: Record<string, StatsRoute>;
  today: StatsToday;

  // 缓存元数据
  lastFlush: number;
  dirty: boolean;
}

// ============================================================
// LRU 缓存实现
// ============================================================

/**
 * LRU (Least Recently Used) 缓存
 * 用于缓存最近访问的请求详情文件
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存值
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // 重新插入以更新访问顺序
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * 设置缓存值
   */
  set(key: K, value: V): void {
    // 删除旧值（如果存在）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // 添加新值
    this.cache.set(key, value);
    // 如果超过最大大小，删除最旧的条目
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * 删除缓存值
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }
}

// ============================================================
// 进程锁
// ============================================================

interface ProcessLockInfo {
  pid: number;
  startTime: number;
  createdAt: string;
}

// ============================================================
// 文件系统存储实现
// ============================================================

class FileSystemStorage {
  // 数据目录
  private dataDir: string;
  private requestsDir: string;
  private indexesDir: string;
  private settingsPath: string;
  private timestampIndexPath: string;
  private pathsIndexPath: string;
  private statsCachePath: string;
  private statsDetailedCachePath: string; // 新增：详细统计缓存路径

  // 索引落盘串行化（避免并发 flush 造成 tmp 文件竞态）
  private flushPromise: Promise<void> | null = null;
  private flushDirty = false;

  // 进程锁
  private lockFilePath: string;
  private lockFileHandle: fs.FileHandle | null = null;

  // 内存索引
  private timeIndex: RequestIndex[] = []; // 按时间戳倒序排列
  private pathCache: Set<string> = new Set(); // 唯一路径缓存

  // LRU 缓存
  private detailCache: LRUCache<string, RequestRecord>;

  // 统计缓存（扩展版）
  private statsCache: StatsCache = {
    byClient: {},
    lastCleanup: 0,
    total: { ...emptyStatsMetrics(), updatedAt: 0 },
    daily: {},
    hourly: {},
    supplier: {},
    model: {},
    route: {},
    today: {
      date: '',
      hourly: {},
      ...emptyStatsMetrics(),
    },
    lastFlush: 0,
    dirty: false,
  };

  // 定时刷新任务
  private statsFlushTimer: NodeJS.Timeout | null = null;

  // 默认设置
  private defaultSettings: Record<string, string> = {
    max_history: '1000',
    auto_cleanup: 'true',
    cleanup_interval_hours: '1',
    filtered_paths: '[]',
  };

  // 设置缓存
  private settingsCache: Record<string, string> = { ...this.defaultSettings };

  constructor() {
    const homeDir = os.homedir();
    this.dataDir = path.join(homeDir, '.local', 'promptxy');
    this.requestsDir = path.join(this.dataDir, 'requests');
    this.indexesDir = path.join(this.dataDir, 'indexes');
    this.settingsPath = path.join(this.dataDir, 'settings.json');
    this.timestampIndexPath = path.join(this.indexesDir, 'timestamp.idx');
    this.pathsIndexPath = path.join(this.indexesDir, 'paths.idx');
    this.statsCachePath = path.join(this.indexesDir, 'stats.json');
    this.statsDetailedCachePath = path.join(this.indexesDir, 'stats-detailed.json'); // 新增
    this.lockFilePath = path.join(this.dataDir, '.lock');
    this.detailCache = new LRUCache<string, RequestRecord>(50);
  }

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 检查进程是否存活
   */
  private async isProcessAlive(pid: number): Promise<boolean> {
    try {
      // 方法1: 尝试发送信号 0（不终止进程，只检查存在性）
      process.kill(pid, 0);
      return true;
    } catch {
      // 方法2: 检查 /proc/<pid> 目录（仅 Linux）
      try {
        await fs.access(`/proc/${pid}`);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * 获取进程锁（生产环境）
   */
  private async acquireLock(debugMode: boolean): Promise<void> {
    // 开发环境（debug 模式）跳过文件锁检查
    if (debugMode) {
      console.log('[PromptXY] 开发模式：跳过进程互斥锁检查');
      return;
    }

    try {
      // 检查锁文件是否已存在
      try {
        const lockContent = await fs.readFile(this.lockFilePath, 'utf-8');
        const lockInfo: ProcessLockInfo = JSON.parse(lockContent);

        // 检查锁文件中的进程是否仍在运行
        const isAlive = await this.isProcessAlive(lockInfo.pid);
        if (isAlive) {
          throw new Error(
            `PromptXY 已在运行 (PID: ${lockInfo.pid}, 启动时间: ${lockInfo.createdAt})\n` +
              `如需重新启动，请先执行: kill ${lockInfo.pid}`,
          );
        }

        // 进程已不存在，清理旧锁文件
        console.log(`[PromptXY] 检测到过期锁文件 (PID ${lockInfo.pid} 已不存在)，自动清理`);
        await fs.unlink(this.lockFilePath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          // ENOENT 表示锁文件不存在，这是正常情况
          // 其他错误需要抛出
          throw error;
        }
      }

      // 创建新锁文件（使用独占创建模式）
      const lockInfo: ProcessLockInfo = {
        pid: process.pid,
        startTime: Date.now(),
        createdAt: new Date().toISOString(),
      };

      // 打开锁文件并获取文件句柄（用于后续释放）
      this.lockFileHandle = await fs.open(this.lockFilePath, 'wx');
      await this.lockFileHandle.writeFile(JSON.stringify(lockInfo, null, 2));

      console.log(`[PromptXY] 获取进程锁成功 (PID: ${process.pid})`);
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        throw new Error('PromptXY 已有实例在运行，请勿重复启动');
      }
      throw error;
    }
  }

  /**
   * 释放进程锁
   */
  private async releaseLock(): Promise<void> {
    // 停止定时刷新任务
    this.stopStatsFlushTimer();

    // 刷新统计缓存到磁盘
    await this.flushDetailedStats();

    if (this.lockFileHandle) {
      try {
        await this.lockFileHandle.close();
        await fs.unlink(this.lockFilePath);
        console.log(`[PromptXY] 释放进程锁成功 (PID: ${process.pid})`);
      } catch (error) {
        console.warn('[PromptXY] 释放进程锁失败:', error);
      } finally {
        this.lockFileHandle = null;
      }
    }
  }

  /**
   * 初始化存储系统
   * @param debugMode 是否为开发模式（true=跳过进程锁）
   */
  async initialize(debugMode = false): Promise<void> {
    // 获取进程锁（生产环境）
    await this.acquireLock(debugMode);

    // 创建目录结构
    await fs.mkdir(this.requestsDir, { recursive: true });
    await fs.mkdir(this.indexesDir, { recursive: true });

    // 加载设置
    await this.loadSettings();

    // 加载索引
    await this.loadIndex();

    // 加载路径索引
    await this.loadPathIndex();

    // 加载统计缓存
    await this.loadStatsCache();

    // 加载详细统计缓存
    await this.loadDetailedStatsCache();

    // 启动定时刷新任务
    this.startStatsFlushTimer();
  }

  // ============================================================
  // ID 生成和解析
  // ============================================================

  /**
   * 生成新的请求 ID
   * 格式: YYYY-MM-DD_HH-mm-ss-SSS_random
   * 示例: 2025-01-15_14-30-25-123_a1b2c3
   */
  static generateRequestId(): string {
    const now = new Date();

    // 格式化日期部分
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // 格式化时间部分（使用 - 分隔避免 Windows 文件系统问题）
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');

    // 生成 6 位随机字符串
    const random = Math.random().toString(36).substring(2, 8).padEnd(6, '0');

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${ms}_${random}`;
  }

  /**
   * 从请求 ID 解析时间戳
   */
  static parseTimestampFromId(id: string): number {
    // 解析格式: YYYY-MM-DD_HH-mm-ss-SSS_random
    const match = id.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})-(\d{3})_/);
    if (!match) {
      return Date.now();
    }

    const [, year, month, day, hours, minutes, seconds, ms] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
      Number(ms),
    );

    return date.getTime();
  }

  // ============================================================
  // 原子写入
  // ============================================================

  /**
   * 原子写入文件
   * 先写入临时文件，然后使用 rename() 原子性地替换目标文件
   * 确保父目录存在，防止目录被意外删除导致写入失败
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    const tempPath = path.join(
      dir,
      `${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random()
        .toString(16)
        .slice(2)}.tmp`,
    );

    try {
      // 确保父目录存在（防止目录被意外删除）
      await fs.mkdir(dir, { recursive: true });

      // 写入临时文件
      await fs.writeFile(tempPath, content, 'utf-8');

      // 原子性重命名
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // 清理临时文件
      try {
        await fs.unlink(tempPath);
      } catch {
        // 忽略清理错误
      }
      throw error;
    }
  }

  // ============================================================
  // YAML 序列化
  // ============================================================

  /**
   * 将请求记录写入 YAML 文件
   */
  private async writeRequestFile(record: RequestRecord): Promise<void> {
    const filePath = path.join(this.requestsDir, `${record.id}.yaml`);

    // 调试日志：检查统计字段（始终输出）
    console.log('[PromptXY] Writing request:', {
      id: record.id,
      hasModel: record.model !== undefined,
      hasInputTokens: record.inputTokens !== undefined,
      hasOutputTokens: record.outputTokens !== undefined,
      model: record.model,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
    });

    const fileContent: RequestFile = {
      id: record.id,
      timestamp: record.timestamp,
      client: record.client,
      path: record.path,
      method: record.method,
      requestSize: record.requestSize,
      responseSize: record.responseSize,
      responseStatus: record.responseStatus,
      durationMs: record.durationMs,
      responseHeaders: record.responseHeaders,
      originalBody: record.originalBody,
      transformedBody: record.transformedBody,
      modifiedBody: record.modifiedBody,
      responseBody: record.responseBody,
      matchedRules: record.matchedRules,
      error: record.error,
      requestHeaders: record.requestHeaders,
      originalRequestHeaders: record.originalRequestHeaders,
      routeId: record.routeId,
      supplierId: record.supplierId,
      supplierName: record.supplierName,
      supplierBaseUrl: record.supplierBaseUrl,
      transformerChain: record.transformerChain,
      transformTrace: record.transformTrace,
      // 统计相关字段
      model: record.model,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      inputCost: record.inputCost,
      outputCost: record.outputCost,
      totalCost: record.totalCost,
    };

    // 使用 YAML dump，大字段使用多行字符串语法
    const yamlContent = yaml.dump(fileContent, {
      lineWidth: -1, // 禁用行宽限制
      noRefs: true, // 禁用引用
      sortKeys: false, // 保持原始顺序
    });

    await this.atomicWrite(filePath, yamlContent);
  }

  /**
   * 从 YAML 文件加载请求记录
   */
  private async loadRequestFile(id: string): Promise<RequestRecord | null> {
    const filePath = path.join(this.requestsDir, `${id}.yaml`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileContent = yaml.load(content) as RequestFile;

      return {
        id: fileContent.id,
        timestamp: fileContent.timestamp,
        client: fileContent.client,
        path: fileContent.path,
        method: fileContent.method,
        requestSize: fileContent.requestSize,
        responseSize: fileContent.responseSize,
        responseStatus: fileContent.responseStatus,
        durationMs: fileContent.durationMs,
        responseHeaders: parseHeaders(fileContent.responseHeaders) as any,
        originalBody: fileContent.originalBody,
        transformedBody: fileContent.transformedBody,
        modifiedBody: fileContent.modifiedBody,
        responseBody: fileContent.responseBody,
        matchedRules: fileContent.matchedRules,
        error: fileContent.error,
        requestHeaders: parseHeaders(fileContent.requestHeaders) as any,
        originalRequestHeaders: parseHeaders(fileContent.originalRequestHeaders) as any,
        routeId: fileContent.routeId,
        supplierId: fileContent.supplierId,
        supplierName: fileContent.supplierName,
        supplierBaseUrl: fileContent.supplierBaseUrl,
        supplierClient: fileContent.supplierClient,
        transformerChain: fileContent.transformerChain,
        transformTrace: fileContent.transformTrace,
        transformedPath: fileContent.transformedPath,
        // 统计相关字段
        model: fileContent.model,
        inputTokens: fileContent.inputTokens,
        outputTokens: fileContent.outputTokens,
        totalTokens: fileContent.totalTokens,
        inputCost: fileContent.inputCost,
        outputCost: fileContent.outputCost,
        totalCost: fileContent.totalCost,
      };
    } catch (error) {
      console.error(`[PromptXY] 加载请求文件失败: ${id}`, error);
      return null;
    }
  }

  // ============================================================
  // 索引管理
  // ============================================================

  /**
   * 加载时间索引
   */
  private async loadIndex(): Promise<void> {
    try {
      const content = await fs.readFile(this.timestampIndexPath, 'utf-8');
      const lines = content.trim().split('\n');

      this.timeIndex = lines
        .filter(line => line.trim())
        .map(line => this.parseIndexLine(line))
        .filter((item): item is RequestIndex => item !== null);

      // 按时间戳倒序排列
      this.timeIndex.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      // 文件不存在或读取失败，尝试重建索引
      await this.rebuildIndex();
    }
  }

  /**
   * 解析索引行
   */
  private parseIndexLine(line: string): RequestIndex | null {
    const parts = line.split('|');
    if (parts.length < 11) {
      return null;
    }

    const [
      timestampStr,
      id,
      client,
      path,
      method,
      reqSizeStr,
      respSizeStr,
      statusStr,
      durationStr,
      error,
      rulesStr,
      supplierName = '',
      supplierClient = '',
      transformerChainStr = '',
      transformedPath = '',
    ] = parts;

    // 解析 transformerChain（从 JSON 字符串转为数组）
    let transformerChain: string[] | undefined;
    if (transformerChainStr) {
      try {
        transformerChain = JSON.parse(transformerChainStr);
      } catch {
        transformerChain = undefined;
      }
    }

    return {
      id,
      timestamp: Number(timestampStr),
      client,
      path,
      method,
      requestSize: reqSizeStr ? Number(reqSizeStr) : undefined,
      responseSize: respSizeStr ? Number(respSizeStr) : undefined,
      responseStatus: statusStr ? Number(statusStr) : undefined,
      durationMs: durationStr ? Number(durationStr) : undefined,
      error: error || undefined,
      matchedRulesBrief: rulesStr ? JSON.parse(rulesStr) : [],
      // 供应商和转换信息
      supplierName: supplierName || undefined,
      supplierClient: supplierClient || undefined,
      transformerChain: transformerChain,
      transformedPath: transformedPath || undefined,
    };
  }

  /**
   * 格式化索引行
   */
  private formatIndexLine(index: RequestIndex): string {
    return [
      index.timestamp,
      index.id,
      index.client,
      index.path,
      index.method,
      index.requestSize ?? '',
      index.responseSize ?? '',
      index.responseStatus ?? '',
      index.durationMs ?? '',
      index.error ?? '',
      JSON.stringify(index.matchedRulesBrief),
      // 供应商和转换信息
      index.supplierName ?? '',
      index.supplierClient ?? '',
      index.transformerChain ? JSON.stringify(index.transformerChain) : '',
      index.transformedPath ?? '',
    ].join('|');
  }

  /**
   * 加载路径索引
   */
  private async loadPathIndex(): Promise<void> {
    try {
      const content = await fs.readFile(this.pathsIndexPath, 'utf-8');
      const lines = content.trim().split('\n');
      this.pathCache = new Set(lines.filter(line => line.trim()));
    } catch (error) {
      // 文件不存在，初始化为空集合
      this.pathCache = new Set();
    }
  }

  /**
   * 重建索引（从 requests/ 目录）
   */
  private async rebuildIndex(): Promise<void> {
    try {
      const files = await fs.readdir(this.requestsDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml'));

      const newTimeIndex: RequestIndex[] = [];

      for (const file of yamlFiles) {
        const id = file.replace('.yaml', '');
        const record = await this.loadRequestFile(id);
        if (record) {
          // 解析 transformerChain（从 JSON 字符串转为数组）
          let transformerChain: string[] | undefined;
          if (record.transformerChain) {
            try {
              transformerChain = JSON.parse(record.transformerChain);
            } catch {
              transformerChain = undefined;
            }
          }

          newTimeIndex.push({
            id: record.id,
            timestamp: record.timestamp,
            client: record.client,
            path: record.path,
            method: record.method,
            requestSize: record.requestSize,
            responseSize: record.responseSize,
            responseStatus: record.responseStatus,
            durationMs: record.durationMs,
            error: record.error,
            matchedRulesBrief: record.matchedRules
              ? JSON.parse(record.matchedRules).map((m: any) => m.ruleId)
              : [],
            // 供应商和转换信息
            supplierName: record.supplierName,
            supplierClient: record.supplierClient,
            transformerChain: transformerChain,
            transformedPath: record.transformedPath,
          });
          this.pathCache.add(record.path);
        }
      }

      // 按时间戳倒序排列
      newTimeIndex.sort((a, b) => b.timestamp - a.timestamp);
      this.timeIndex = newTimeIndex;

      // 持久化索引
      await this.flushIndex();
    } catch (error) {
      console.error('[PromptXY] 重建索引失败', error);
    }
  }

  /**
   * 公共方法：重建索引（从 requests/ 目录）
   * 返回重建结果
   */
  async rebuildIndexPublic(): Promise<{ success: boolean; message: string; count: number }> {
    try {
      const files = await fs.readdir(this.requestsDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml'));

      const newTimeIndex: RequestIndex[] = [];

      for (const file of yamlFiles) {
        const id = file.replace('.yaml', '');
        const record = await this.loadRequestFile(id);
        if (record) {
          // 解析 transformerChain（从 JSON 字符串转为数组）
          let transformerChain: string[] | undefined;
          if (record.transformerChain) {
            try {
              transformerChain = JSON.parse(record.transformerChain);
            } catch {
              transformerChain = undefined;
            }
          }

          newTimeIndex.push({
            id: record.id,
            timestamp: record.timestamp,
            client: record.client,
            path: record.path,
            method: record.method,
            requestSize: record.requestSize,
            responseSize: record.responseSize,
            responseStatus: record.responseStatus,
            durationMs: record.durationMs,
            error: record.error,
            matchedRulesBrief: record.matchedRules
              ? JSON.parse(record.matchedRules).map((m: any) => m.ruleId)
              : [],
            // 供应商和转换信息
            supplierName: record.supplierName,
            supplierClient: record.supplierClient,
            transformerChain: transformerChain,
            transformedPath: record.transformedPath,
          });
          this.pathCache.add(record.path);
        }
      }

      // 按时间戳倒序排列
      newTimeIndex.sort((a, b) => b.timestamp - a.timestamp);
      this.timeIndex = newTimeIndex;

      // 持久化索引
      await this.flushIndex();

      return {
        success: true,
        message: '索引重建成功',
        count: newTimeIndex.length,
      };
    } catch (error: any) {
      console.error('[PromptXY] 重建索引失败', error);
      return {
        success: false,
        message: `索引重建失败: ${error?.message || String(error)}`,
        count: 0,
      };
    }
  }

  /**
   * 更新索引（添加新条目）
   */
  private updateIndex(index: RequestIndex): void {
    // 插入到正确位置（保持时间戳倒序）
    let insertPos = 0;
    for (let i = 0; i < this.timeIndex.length; i++) {
      if (this.timeIndex[i].timestamp < index.timestamp) {
        insertPos = i;
        break;
      }
      insertPos = i + 1;
    }

    this.timeIndex.splice(insertPos, 0, index);

    // 更新路径缓存
    this.pathCache.add(index.path);

    // 更新统计缓存
    if (!this.statsCache.byClient[index.client]) {
      this.statsCache.byClient[index.client] = 0;
    }
    this.statsCache.byClient[index.client]++;
  }

  // ============================================================
  // 统计系统方法
  // ============================================================

  /**
   * 获取今天的日期字符串
   */
  private getToday(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 从请求记录提取指标
   */
  private extractMetrics(record: RequestRecord): StatsMetrics {
    const metrics = emptyStatsMetrics();

    // Token 数据
    metrics.inputTokens = record.inputTokens || 0;
    metrics.outputTokens = record.outputTokens || 0;
    metrics.totalTokens = metrics.inputTokens + metrics.outputTokens;

    // 费用数据
    metrics.inputCost = record.inputCost || 0;
    metrics.outputCost = record.outputCost || 0;
    metrics.totalCost = metrics.inputCost + metrics.outputCost;

    // 时间数据
    metrics.waitTime = record.waitTime || 0;
    metrics.durationTime = record.durationMs || 0;

    // FTUT 数据
    if (record.ftut) {
      metrics.ftutCount = 1;
      metrics.ftutSum = record.ftut;
      metrics.ftutAvg = record.ftut;
    }

    // 请求计数
    const isSuccess = record.responseStatus && record.responseStatus >= 200 && record.responseStatus < 400;
    if (isSuccess) {
      metrics.requestSuccess = 1;
    } else {
      metrics.requestFailed = 1;
    }
    metrics.requestTotal = 1;

    return metrics;
  }

  /**
   * 合并指标（累加）
   */
  private mergeMetrics(target: StatsMetrics, source: StatsMetrics): void {
    target.inputTokens += source.inputTokens;
    target.outputTokens += source.outputTokens;
    target.totalTokens = target.inputTokens + target.outputTokens;

    target.inputCost += source.inputCost;
    target.outputCost += source.outputCost;
    target.totalCost = target.inputCost + target.outputCost;

    target.waitTime += source.waitTime;
    target.durationTime += source.durationTime;

    target.requestSuccess += source.requestSuccess;
    target.requestFailed += source.requestFailed;
    target.requestTotal += source.requestTotal;

    if (source.ftutCount > 0) {
      target.ftutCount += source.ftutCount;
      target.ftutSum += source.ftutSum;
      target.ftutAvg = target.ftutSum / target.ftutCount;
    }
  }

  /**
   * 更新统计缓存（在 insertRequestRecord 时调用）
   */
  private updateStatsCache(record: RequestRecord): void {
    const metrics = this.extractMetrics(record);
    const now = record.timestamp;
    const date = new Date(now);
    const dateStr = this.getToday();
    const hour = date.getHours();
    const hourStr = String(hour).padStart(2, '0');
    const dateHourKey = `${dateStr}:${hourStr}`;

    // 更新总览统计
    this.mergeMetrics(this.statsCache.total, metrics);
    this.statsCache.total.updatedAt = now;

    // 更新每日统计
    if (!this.statsCache.daily[dateStr]) {
      this.statsCache.daily[dateStr] = {
        ...emptyStatsMetrics(),
        date: dateStr,
        dateKey: now,
      };
    }
    this.mergeMetrics(this.statsCache.daily[dateStr], metrics);

    // 更新小时统计（仅保留当天）
    if (dateStr === this.getToday()) {
      if (!this.statsCache.hourly[dateHourKey]) {
        this.statsCache.hourly[dateHourKey] = {
          ...emptyStatsMetrics(),
          date: dateStr,
          hour,
          dateHour: dateHourKey,
        };
      }
      this.mergeMetrics(this.statsCache.hourly[dateHourKey], metrics);

      // 更新今日统计
      if (this.statsCache.today.date !== dateStr) {
        // 日期变更，重置今日统计
        this.statsCache.today = {
          date: dateStr,
          hourly: {},
          ...emptyStatsMetrics(),
        };
      }
      this.mergeMetrics(this.statsCache.today, metrics);

      // 更新今日小时统计
      if (!this.statsCache.today.hourly[hour]) {
        this.statsCache.today.hourly[hour] = emptyStatsMetrics();
      }
      this.mergeMetrics(this.statsCache.today.hourly[hour], metrics);
    }

    // 更新供应商统计
    if (record.supplierId) {
      const supplierKey = record.supplierId;
      if (!this.statsCache.supplier[supplierKey]) {
        this.statsCache.supplier[supplierKey] = {
          ...emptyStatsMetrics(),
          supplierId: record.supplierId,
          supplierName: record.supplierName || record.supplierId,
        };
      }
      this.mergeMetrics(this.statsCache.supplier[supplierKey], metrics);
    }

    // 更新模型统计
    const model = (record as any).model;
    if (model) {
      const modelKey = model;
      if (!this.statsCache.model[modelKey]) {
        this.statsCache.model[modelKey] = {
          ...emptyStatsMetrics(),
          model: model,
          supplierName: record.supplierName,
        };
      }
      this.mergeMetrics(this.statsCache.model[modelKey], metrics);
    }

    // 更新路由统计
    if (record.routeId) {
      const routeKey = record.routeId;
      if (!this.statsCache.route[routeKey]) {
        // 从配置中查找 localService
        const localService = this.getLocalServiceForRoute(record.routeId);
        this.statsCache.route[routeKey] = {
          ...emptyStatsMetrics(),
          routeId: record.routeId,
          localService: localService || 'claude',
        };
      }
      this.mergeMetrics(this.statsCache.route[routeKey], metrics);
    }

    // 标记为脏数据
    this.statsCache.dirty = true;
  }

  /**
   * 从 routeId 解析 localService
   * routeId 格式: route-{localService}-{suffix}，例如 route-claude-default, route-codex-default
   */
  private getLocalServiceForRoute(routeId: string): string {
    // 解析 routeId: route-{localService}-{suffix}
    const parts = routeId.split('-');
    if (parts.length >= 2 && parts[0] === 'route') {
      // 支持多级 localService，例如 "openai-chat" -> parts[1] = "openai", parts[2] = "chat"
      // 提取 route- 后的部分，直到最后一个 -{suffix}
      const localService = parts.slice(1, -1).join('-');
      if (localService) {
        return localService;
      }
    }
    // 兜底默认值
    return 'claude';
  }

  /**
   * 启动定时刷新任务
   */
  private startStatsFlushTimer(): void {
    // 每 30 秒刷新一次
    this.statsFlushTimer = setInterval(() => {
      this.flushDetailedStats().catch(err => {
        console.error('[PromptXY] 定期刷新统计失败', err);
      });
    }, 30 * 1000);
  }

  /**
   * 停止定时刷新任务
   */
  private stopStatsFlushTimer(): void {
    if (this.statsFlushTimer) {
      clearInterval(this.statsFlushTimer);
      this.statsFlushTimer = null;
    }
  }

  /**
   * 刷新详细统计到磁盘
   */
  private async flushDetailedStats(): Promise<void> {
    if (!this.statsCache.dirty) {
      return;
    }

    try {
      const content = JSON.stringify(this.statsCache, null, 2);
      await this.atomicWrite(this.statsDetailedCachePath, content);

      this.statsCache.dirty = false;
      this.statsCache.lastFlush = Date.now();

      console.log('[PromptXY] 详细统计数据已刷新到磁盘');
    } catch (error) {
      console.error('[PromptXY] 刷新详细统计失败', error);
    }
  }

  /**
   * 加载详细统计缓存（启动时）
   */
  private async loadDetailedStatsCache(): Promise<void> {
    try {
      const content = await fs.readFile(this.statsDetailedCachePath, 'utf-8');
      const loaded = JSON.parse(content) as StatsCache;

      // 合并加载的数据，确保所有必要字段都存在
      this.statsCache = {
        byClient: loaded.byClient || {},
        lastCleanup: loaded.lastCleanup || 0,
        total: loaded.total || { ...emptyStatsMetrics(), updatedAt: 0 },
        daily: loaded.daily || {},
        hourly: loaded.hourly || {},
        supplier: loaded.supplier || {},
        model: loaded.model || {},
        route: loaded.route || {},
        today: {
          ...emptyStatsMetrics(),
          ...loaded.today,
          date: loaded.today?.date || this.getToday(),
          hourly: loaded.today?.hourly || {},
        },
        lastFlush: loaded.lastFlush || 0,
        dirty: loaded.dirty || false,
      };

      // 清理过小时统计（只保留今天的）
      const today = this.getToday();
      Object.keys(this.statsCache.hourly).forEach(key => {
        if (!key.startsWith(today)) {
          delete this.statsCache.hourly[key];
        }
      });

      console.log('[PromptXY] 详细统计缓存已加载');
    } catch (error) {
      // 文件不存在或解析失败，确保所有字段正确初始化
      this.statsCache.total = { ...emptyStatsMetrics(), updatedAt: 0 };
      this.statsCache.daily = {};
      this.statsCache.hourly = {};
      this.statsCache.supplier = {};
      this.statsCache.model = {};
      this.statsCache.route = {};
      this.statsCache.today = {
        date: this.getToday(),
        hourly: {},
        ...emptyStatsMetrics(),
      };
      console.log('[PromptXY] 使用默认详细统计缓存');
    }
  }

  /**
   * 获取总览统计
   */
  getStatsTotal(): StatsTotal {
    return this.statsCache.total;
  }

  /**
   * 获取每日统计
   */
  getStatsDaily(limit: number = 30): StatsDaily[] {
    const items = Object.values(this.statsCache.daily)
      .sort((a, b) => b.dateKey - a.dateKey)
      .slice(0, limit);
    return items;
  }

  /**
   * 获取小时统计（当日）
   */
  getStatsHourly(): StatsHourly[] {
    const today = this.getToday();
    const items = Object.values(this.statsCache.hourly)
      .filter(h => h.date === today)
      .sort((a, b) => a.hour - b.hour);
    return items;
  }

  /**
   * 获取供应商统计
   */
  getStatsSupplier(): StatsSupplier[] {
    return Object.values(this.statsCache.supplier);
  }

  /**
   * 获取模型统计
   */
  getStatsModel(limit: number = 20, sortBy: keyof StatsMetrics = 'totalCost'): StatsModel[] {
    return Object.values(this.statsCache.model)
      .sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number))
      .slice(0, limit);
  }

  /**
   * 获取路由统计
   */
  getStatsRoute(): StatsRoute[] {
    return Object.values(this.statsCache.route);
  }

  /**
   * 获取今日统计
   */
  getStatsToday(): StatsToday {
    return this.statsCache.today;
  }

  /**
   * 持久化索引文件
   */
  private async flushIndex(): Promise<void> {
    // 串行化：同一时刻只允许一个 flush 跑；期间有更新则在结束后再补刷一次
    if (this.flushPromise) {
      this.flushDirty = true;
      return this.flushPromise;
    }

    const run = async (): Promise<void> => {
      try {
        do {
          this.flushDirty = false;

          // 写入时间索引
          const timestampContent = this.timeIndex.map(idx => this.formatIndexLine(idx)).join('\n');
          await this.atomicWrite(this.timestampIndexPath, timestampContent);

          // 写入路径索引
          const pathsContent = Array.from(this.pathCache).sort().join('\n');
          await this.atomicWrite(this.pathsIndexPath, pathsContent);

          // 写入统计缓存
          await this.saveStatsCache();
        } while (this.flushDirty);
      } catch (error) {
        console.error('[PromptXY] 持久化索引失败', error);
      }
    };

    this.flushPromise = run().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  // ============================================================
  // 统计缓存
  // ============================================================

  /**
   * 加载统计缓存
   */
  private async loadStatsCache(): Promise<void> {
    try {
      const content = await fs.readFile(this.statsCachePath, 'utf-8');
      this.statsCache = JSON.parse(content);
    } catch (error) {
      // 文件不存在或解析失败，使用默认值
      this.statsCache = {
        byClient: {},
        lastCleanup: 0,
        total: { ...emptyStatsMetrics(), updatedAt: 0 },
        daily: {},
        hourly: {},
        supplier: {},
        model: {},
        route: {},
        today: {
          date: '',
          hourly: {},
          ...emptyStatsMetrics(),
        },
        lastFlush: 0,
        dirty: false,
      };
    }
  }

  /**
   * 保存统计缓存
   */
  private async saveStatsCache(): Promise<void> {
    try {
      const content = JSON.stringify(this.statsCache, null, 2);
      await this.atomicWrite(this.statsCachePath, content);
    } catch (error) {
      console.error('[PromptXY] 保存统计缓存失败', error);
    }
  }

  // ============================================================
  // 设置管理
  // ============================================================

  /**
   * 加载设置
   */
  private async loadSettings(): Promise<void> {
    try {
      const content = await fs.readFile(this.settingsPath, 'utf-8');
      const loaded = JSON.parse(content);
      this.settingsCache = { ...this.defaultSettings, ...loaded };
    } catch (error) {
      // 文件不存在或解析失败，使用默认设置
      this.settingsCache = { ...this.defaultSettings };
    }
  }

  /**
   * 保存设置
   */
  private async saveSettings(): Promise<void> {
    try {
      const content = JSON.stringify(this.settingsCache, null, 2);
      await this.atomicWrite(this.settingsPath, content);
    } catch (error) {
      console.error('[PromptXY] 保存设置失败', error);
    }
  }

  /**
   * 获取设置值
   */
  getSetting(key: string): string | null {
    return this.settingsCache[key] ?? null;
  }

  /**
   * 获取所有设置
   */
  getAllSettings(): Record<string, string> {
    return { ...this.settingsCache };
  }

  /**
   * 更新设置值
   */
  async updateSetting(key: string, value: string): Promise<void> {
    this.settingsCache[key] = value;
    await this.saveSettings();
  }

  // ============================================================
  // 请求操作
  // ============================================================

  /**
   * 插入请求记录
   */
  async insert(record: RequestRecord): Promise<void> {
    // 1. 写入请求文件
    await this.writeRequestFile(record);

    // 2. 解析 transformerChain（从 JSON 字符串转为数组）
    let transformerChain: string[] | undefined;
    if (record.transformerChain) {
      try {
        transformerChain = JSON.parse(record.transformerChain);
      } catch {
        transformerChain = undefined;
      }
    }

    // 3. 创建索引条目
    const index: RequestIndex = {
      id: record.id,
      timestamp: record.timestamp,
      client: record.client,
      path: record.path,
      method: record.method,
      requestSize: record.requestSize,
      responseSize: record.responseSize,
      responseStatus: record.responseStatus,
      durationMs: record.durationMs,
      error: record.error,
      matchedRulesBrief: record.matchedRules
        ? JSON.parse(record.matchedRules).map((m: any) => m.ruleId)
        : [],
      // 供应商和转换信息
      supplierName: record.supplierName,
      supplierClient: record.supplierClient,
      transformerChain: transformerChain,
      transformedPath: record.transformedPath,
    };

    // 4. 更新内存索引
    this.updateIndex(index);

    // 5. 更新统计缓存（多维度聚合）
    this.updateStatsCache(record);

    // 6. 异步持久化索引
    this.flushIndex().catch(err => console.error('[PromptXY] 异步持久化索引失败', err));

    // 7. 自动清理旧记录
    const maxHistory = this.getSetting('max_history');
    const keep = maxHistory ? Number(maxHistory) : 1000;

    if (this.timeIndex.length > keep) {
      await this.cleanupOld(keep);
    }
  }

  /**
   * 查询请求列表
   */
  query(options: {
    limit?: number;
    offset?: number;
    client?: string;
    startTime?: number;
    endTime?: number;
    search?: string;
  }): RequestListResponse {
    const limit = Math.min(options.limit ?? 50, 100);
    const offset = options.offset ?? 0;
    const search = options.search ?? null;

    // 内存过滤
    let filtered = this.timeIndex;

    // 客户端过滤
    if (options.client) {
      filtered = filtered.filter(idx => idx.client === options.client);
    }

    // 时间范围过滤
    if (options.startTime !== undefined) {
      filtered = filtered.filter(idx => idx.timestamp >= options.startTime!);
    }

    if (options.endTime !== undefined) {
      filtered = filtered.filter(idx => idx.timestamp <= options.endTime!);
    }

    // 搜索过滤
    if (search) {
      const isPathSearch = search.startsWith('/');

      if (isPathSearch) {
        // 路径前缀匹配
        filtered = filtered.filter(idx => idx.path.startsWith(search));
      } else {
        // ID/路径模糊匹配
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(
          idx =>
            idx.id.toLowerCase().includes(searchLower) ||
            idx.path.toLowerCase().includes(searchLower),
        );
      }
    }

    const total = filtered.length;

    // 分页
    const paginated = filtered.slice(offset, offset + limit);

    const items = paginated.map(idx => ({
      id: idx.id,
      timestamp: idx.timestamp,
      client: idx.client,
      path: idx.path,
      method: idx.method,
      requestSize: idx.requestSize,
      responseSize: idx.responseSize,
      matchedRules: idx.matchedRulesBrief,
      responseStatus: idx.responseStatus,
      durationMs: idx.durationMs,
      error: idx.error,
      // 供应商和转换信息
      supplierName: idx.supplierName,
      supplierClient: idx.supplierClient,
      transformerChain: idx.transformerChain,
      transformedPath: idx.transformedPath,
    }));

    return {
      total,
      limit,
      offset,
      items,
    };
  }

  /**
   * 获取请求详情（带 LRU 缓存）
   */
  async getDetail(id: string): Promise<RequestRecord | null> {
    // 首先检查缓存
    const cached = this.detailCache.get(id);
    if (cached) {
      return cached;
    }

    // 从文件加载
    const record = await this.loadRequestFile(id);
    if (record) {
      // 更新缓存
      this.detailCache.set(id, record);
    }

    return record;
  }

  /**
   * 获取唯一路径列表
   */
  getUniquePaths(prefix?: string): PathsResponse {
    let paths = Array.from(this.pathCache);

    if (prefix) {
      paths = paths.filter(p => p.startsWith(prefix));
    }

    paths.sort();

    return {
      paths,
      count: paths.length,
    };
  }

  /**
   * 获取请求统计信息
   */
  getStats(): {
    total: number;
    byClient: Record<string, number>;
    recent: number;
  } {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // 计算最近 24 小时的请求数
    const recent = this.timeIndex.filter(idx => idx.timestamp > oneDayAgo).length;

    return {
      total: this.timeIndex.length,
      byClient: this.statsCache.byClient,
      recent,
    };
  }

  /**
   * 清理旧记录
   */
  async cleanupOld(keep: number): Promise<number> {
    if (this.timeIndex.length <= keep) {
      return 0;
    }

    const toDelete = this.timeIndex.slice(keep);
    const deletedCount = toDelete.length;

    // 删除请求文件
    for (const idx of toDelete) {
      const filePath = path.join(this.requestsDir, `${idx.id}.yaml`);

      try {
        await fs.unlink(filePath);
      } catch (error) {
        // 忽略删除失败的文件
      }

      // 从缓存中移除
      this.detailCache.delete(idx.id);

      // 更新统计缓存
      if (this.statsCache.byClient[idx.client]) {
        this.statsCache.byClient[idx.client]--;
      }
    }

    // 更新内存索引
    this.timeIndex = this.timeIndex.slice(0, keep);

    // 重新构建路径缓存
    this.pathCache = new Set(this.timeIndex.map(idx => idx.path));

    // 持久化索引
    await this.flushIndex();

    return deletedCount;
  }

  /**
   * 删除单个请求
   */
  async delete(id: string): Promise<boolean> {
    const indexPos = this.timeIndex.findIndex(idx => idx.id === id);
    if (indexPos === -1) {
      return false;
    }

    const index = this.timeIndex[indexPos];

    // 删除请求文件
    const filePath = path.join(this.requestsDir, `${id}.yaml`);
    try {
      await fs.unlink(filePath);
    } catch {
      // 忽略删除失败
    }

    // 从索引中移除
    this.timeIndex.splice(indexPos, 1);

    // 从路径缓存中移除（检查是否还有其他请求使用相同路径）
    const hasOtherWithPath = this.timeIndex.some(idx => idx.path === index.path);
    if (!hasOtherWithPath) {
      this.pathCache.delete(index.path);
    }

    // 从缓存中移除
    this.detailCache.delete(id);

    // 更新统计缓存
    if (this.statsCache.byClient[index.client]) {
      this.statsCache.byClient[index.client]--;
    }

    // 持久化索引
    await this.flushIndex();

    return true;
  }

  /**
   * 获取过滤路径列表
   */
  getFilteredPaths(): string[] {
    const filteredPathsStr = this.getSetting('filtered_paths');
    if (!filteredPathsStr) {
      return [];
    }

    try {
      const paths = JSON.parse(filteredPathsStr);
      return Array.isArray(paths) ? paths : [];
    } catch {
      return [];
    }
  }

  /**
   * 检查路径是否应该被过滤
   */
  shouldFilterPath(path: string, filteredPaths: string[]): boolean {
    for (const filteredPath of filteredPaths) {
      // 精确匹配
      if (path === filteredPath) {
        return true;
      }
      // 前缀匹配
      if (filteredPath.endsWith('/') && path.startsWith(filteredPath)) {
        return true;
      }
      if (path.startsWith(filteredPath + '/')) {
        return true;
      }
    }
    return false;
  }
}

// ============================================================
// 全局存储实例
// ============================================================

let storageInstance: FileSystemStorage | null = null;

// ============================================================
// API 兼容层 - 导出函数
// ============================================================

/**
 * 初始化数据库（兼容旧 API）
 * @param debugMode 是否为开发模式（true=跳过进程锁）
 */
export async function initializeDatabase(debugMode = false): Promise<FileSystemStorage> {
  if (storageInstance) {
    return storageInstance;
  }

  const storage = new FileSystemStorage();
  await storage.initialize(debugMode);

  storageInstance = storage;
  return storageInstance;
}

/**
 * 保存数据库（空操作，文件系统自动持久化）
 */
export async function saveDatabase(): Promise<void> {
  // 文件系统存储自动持久化，无需手动保存
}

/**
 * 获取数据库实例（兼容旧 API）
 */
export function getDatabase(): FileSystemStorage {
  if (!storageInstance) {
    throw new Error('Storage not initialized. Call initializeDatabase() first.');
  }
  return storageInstance;
}

/**
 * 插入请求记录
 */
export async function insertRequestRecord(record: RequestRecord): Promise<void> {
  const storage = getDatabase();
  await storage.insert(record);
}

/**
 * 获取请求列表
 */
export async function getRequestList(options: {
  limit?: number;
  offset?: number;
  client?: string;
  startTime?: number;
  endTime?: number;
  search?: string;
}): Promise<RequestListResponse> {
  const storage = getDatabase();
  return storage.query(options);
}

/**
 * 获取请求详情
 */
export async function getRequestDetail(id: string): Promise<RequestRecord | null> {
  const storage = getDatabase();
  return storage.getDetail(id);
}

/**
 * 获取唯一路径列表
 */
export async function getUniquePaths(prefix?: string): Promise<PathsResponse> {
  const storage = getDatabase();
  return storage.getUniquePaths(prefix);
}

/**
 * 获取请求统计信息
 */
export async function getRequestStats(): Promise<{
  total: number;
  byClient: Record<string, number>;
  recent: number;
}> {
  const storage = getDatabase();
  return storage.getStats();
}

/**
 * 清理旧请求
 */
export async function cleanupOldRequests(keep: number = 100): Promise<number> {
  const storage = getDatabase();
  return storage.cleanupOld(keep);
}

/**
 * 删除单个请求
 */
export async function deleteRequest(id: string): Promise<boolean> {
  const storage = getDatabase();
  return storage.delete(id);
}

/**
 * 获取设置值
 */
export function getSetting(key: string): string | null {
  const storage = getDatabase();
  return storage.getSetting(key);
}

/**
 * 获取所有设置
 */
export function getAllSettings(): Record<string, string> {
  const storage = getDatabase();
  return storage.getAllSettings();
}

/**
 * 更新设置值
 */
export async function updateSetting(key: string, value: string): Promise<void> {
  const storage = getDatabase();
  await storage.updateSetting(key, value);
}

/**
 * 获取过滤路径列表
 */
export function getFilteredPaths(): string[] {
  const storage = getDatabase();
  return storage.getFilteredPaths();
}

/**
 * 检查路径是否应该被过滤
 */
export function shouldFilterPath(path: string, filteredPaths: string[]): boolean {
  const storage = getDatabase();
  return storage.shouldFilterPath(path, filteredPaths);
}

/**
 * 获取数据库信息（兼容旧 API）
 */
export async function getDatabaseInfo(): Promise<{
  path: string;
  size: number;
  recordCount: number;
}> {
  const storage = getDatabase();

  // 计算总大小（请求文件 + 索引文件）
  const homeDir = os.homedir();
  const dataDir = path.join(homeDir, '.local', 'promptxy');

  let totalSize = 0;

  try {
    const requestsDir = path.join(dataDir, 'requests');
    const files = await fs.readdir(requestsDir);

    for (const file of files) {
      const filePath = path.join(requestsDir, file);
      try {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      } catch {
        // 忽略无法访问的文件
      }
    }

    // 添加索引文件大小
    const indexPaths = [
      path.join(dataDir, 'indexes', 'timestamp.idx'),
      path.join(dataDir, 'indexes', 'paths.idx'),
      path.join(dataDir, 'indexes', 'stats.json'),
    ];

    for (const indexPath of indexPaths) {
      try {
        const stats = await fs.stat(indexPath);
        totalSize += stats.size;
      } catch {
        // 文件可能不存在
      }
    }
  } catch {
    // 目录可能不存在
  }

  return {
    path: dataDir,
    size: totalSize,
    recordCount: storage.getStats().total,
  };
}

/**
 * 重置数据库实例（仅用于测试）
 */
export async function resetDatabaseForTest(): Promise<void> {
  storageInstance = null;
}

/**
 * 重建索引
 */
export async function rebuildIndex(): Promise<{
  success: boolean;
  message: string;
  count: number;
}> {
  const storage = getDatabase();
  return storage.rebuildIndexPublic();
}

/**
 * 导出请求 ID 生成函数
 */
export const generateRequestId = () => FileSystemStorage.generateRequestId();

// ============================================================================
// 统计系统导出函数
// ============================================================================

/**
 * 获取总览统计
 */
export function getStatsTotal(): StatsTotal {
  const storage = getDatabase();
  return storage.getStatsTotal();
}

/**
 * 获取每日统计列表
 */
export function getStatsDaily(limit: number = 30): StatsDaily[] {
  const storage = getDatabase();
  return storage.getStatsDaily(limit);
}

/**
 * 获取小时统计列表（仅当日）
 */
export function getStatsHourly(): StatsHourly[] {
  const storage = getDatabase();
  return storage.getStatsHourly();
}

/**
 * 获取供应商统计列表
 */
export function getStatsSupplier(): StatsSupplier[] {
  const storage = getDatabase();
  return storage.getStatsSupplier();
}

/**
 * 获取模型统计列表
 */
export function getStatsModel(limit: number = 20, sortBy: keyof StatsMetrics = 'totalTokens'): StatsModel[] {
  const storage = getDatabase();
  return storage.getStatsModel(limit, sortBy);
}

/**
 * 获取路由统计列表
 */
export function getStatsRoute(): StatsRoute[] {
  const storage = getDatabase();
  return storage.getStatsRoute();
}

/**
 * 获取今日统计
 */
export function getStatsToday(): StatsToday {
  const storage = getDatabase();
  return storage.getStatsToday();
}

/**
 * 导出 FileSystemStorage 类和类型
 */
export { FileSystemStorage };
