import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

import type {
  RequestRecord,
  RequestListResponse,
  PathsResponse,
  StatsMetrics,
  StatsTotal,
  StatsDaily,
  StatsHourly,
  StatsSupplier,
  StatsModel,
  StatsRoute,
  StatsToday,
} from './types.js';

import { SqliteStorage } from './storage/sqlite-storage.js';

export type FileSystemStorage = SqliteStorage;

let storageInstance: SqliteStorage | null = null;

/**
 * 初始化数据库（SQLite）
 * @param debugMode 是否为开发模式（true=跳过进程锁）
 */
export async function initializeDatabase(debugMode = false): Promise<SqliteStorage> {
  if (storageInstance) {
    return storageInstance;
  }

  const storage = new SqliteStorage();
  await storage.initialize(debugMode);
  storageInstance = storage;
  return storageInstance;
}

/**
 * 保存数据库（SQLite 自动持久化，无需额外操作）
 */
export async function saveDatabase(): Promise<void> {
  // no-op
}

/**
 * 获取数据库实例（兼容旧 API）
 */
export function getDatabase(): SqliteStorage {
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
 * 获取请求统计信息（轻量：total/byClient/recent）
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
export function shouldFilterPath(p: string, filteredPaths: string[]): boolean {
  const storage = getDatabase();
  return storage.shouldFilterPath(p, filteredPaths);
}

/**
 * 获取数据库信息（兼容旧 API：path 为数据目录，size 为存储占用）
 */
export async function getDatabaseInfo(): Promise<{
  path: string;
  size: number;
  recordCount: number;
}> {
  const storage = getDatabase();
  const dataDir = storage.getDataDir();
  const dbPath = storage.getDbPath();

  const files = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  let size = 0;
  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      size += stat.size;
    } catch {
      // ignore missing files
    }
  }

  const stats = await storage.getStats();

  return {
    path: dataDir,
    size,
    recordCount: stats.total,
  };
}

/**
 * 重置数据库实例（仅用于测试）
 */
export async function resetDatabaseForTest(): Promise<void> {
  if (storageInstance) {
    await storageInstance.close().catch(() => {});
  }
  storageInstance = null;
}

/**
 * 重建索引（SQLite 模式为 noop，但保持 API 可用）
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
 * 请求 ID 生成
 * 格式: YYYY-MM-DD_HH-mm-ss-SSS_random
 * 示例: 2025-01-15_14-30-25-123_a1b2c3
 */
export function generateRequestId(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  const random = Math.random().toString(36).substring(2, 8).padEnd(6, '0');

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${ms}_${random}`;
}

// ============================================================================
// 统计系统导出函数（改为异步：SQL 即时聚合）
// ============================================================================

export async function getStatsTotal(): Promise<StatsTotal> {
  const storage = getDatabase();
  return storage.getStatsTotal();
}

export async function getStatsDaily(limit: number = 30): Promise<StatsDaily[]> {
  const storage = getDatabase();
  return storage.getStatsDaily(limit);
}

export async function getStatsHourly(): Promise<StatsHourly[]> {
  const storage = getDatabase();
  return storage.getStatsHourly();
}

export async function getStatsSupplier(): Promise<StatsSupplier[]> {
  const storage = getDatabase();
  return storage.getStatsSupplier();
}

export async function getStatsModel(
  limit: number = 20,
  sortBy: keyof StatsMetrics = 'totalTokens',
): Promise<StatsModel[]> {
  const storage = getDatabase();
  return storage.getStatsModel(limit, sortBy);
}

export async function getStatsRoute(): Promise<StatsRoute[]> {
  const storage = getDatabase();
  return storage.getStatsRoute();
}

export async function getStatsToday(): Promise<StatsToday> {
  const storage = getDatabase();
  return storage.getStatsToday();
}

export async function getStatsDataByRange(options: {
  startTime?: number;
  endTime?: number;
  limitDays?: number;
}): Promise<{
  total: StatsTotal;
  daily: StatsDaily[];
  supplier: StatsSupplier[];
  model: StatsModel[];
  route: StatsRoute[];
}> {
  const storage = getDatabase();
  return storage.getStatsDataByRange(options);
}

/**
 * 供 CLI/调试使用：默认数据目录路径（保持与旧实现一致）
 */
export function getDefaultDataDir(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.local', 'promptxy');
}
