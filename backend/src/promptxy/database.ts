import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'node:path';
import * as os from 'node:os';
import { mkdir } from 'node:fs/promises';
import { RequestRecord, RequestListResponse, PathsResponse } from './types.js';

let dbInstance: Database | null = null;

/**
 * 获取数据库文件路径
 */
function getDbPath(): string {
  const homeDir = os.homedir();
  const dataDir = path.join(homeDir, '.local', 'promptxy');
  return path.join(dataDir, 'promptxy.db');
}

/**
 * 获取数据目录路径
 */
function getDataDir(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.local', 'promptxy');
}

/**
 * 初始化数据库
 */
export async function initializeDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = getDataDir();
  const dbPath = getDbPath();

  // 确保目录存在
  await mkdir(dataDir, { recursive: true });

  // 打开数据库
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // 初始化表结构
  await dbInstance.exec(`
    -- 请求历史表
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      client TEXT NOT NULL,
      path TEXT NOT NULL,
      method TEXT NOT NULL,

      -- 请求体（JSON字符串）
      original_body TEXT NOT NULL,
      modified_body TEXT NOT NULL,

      -- 请求/响应大小（字节）
      request_size INTEGER,
      response_size INTEGER,

      -- 匹配规则（JSON数组字符串）
      matched_rules TEXT NOT NULL,

      -- 响应信息
      response_status INTEGER,
      duration_ms INTEGER,
      response_headers TEXT,
      response_body TEXT,
      error TEXT
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_timestamp ON requests(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_client ON requests(client);
    CREATE INDEX IF NOT EXISTS idx_client_timestamp ON requests(client, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_path ON requests(path);

    -- 设置表
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- 插入默认设置
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('max_history', '1000'),
      ('auto_cleanup', 'true'),
      ('cleanup_interval_hours', '1'),
      ('filtered_paths', '[]');
  `);

  // 数据库迁移：为已有数据库添加新列
  try {
    // 检查列是否存在
    const tableInfo = await dbInstance.all(
      `PRAGMA table_info(requests)`
    );

    // 迁移 response_body 列
    const hasResponseBody = tableInfo.some((col: any) => col.name === 'response_body');
    if (!hasResponseBody) {
      await dbInstance.exec(`ALTER TABLE requests ADD COLUMN response_body TEXT`);
    }

    // 迁移 request_size 列
    const hasRequestSize = tableInfo.some((col: any) => col.name === 'request_size');
    if (!hasRequestSize) {
      await dbInstance.exec(`ALTER TABLE requests ADD COLUMN request_size INTEGER`);
    }

    // 迁移 response_size 列
    const hasResponseSize = tableInfo.some((col: any) => col.name === 'response_size');
    if (!hasResponseSize) {
      await dbInstance.exec(`ALTER TABLE requests ADD COLUMN response_size INTEGER`);
    }
  } catch {
    // 忽略迁移错误，可能是新数据库
  }

  return dbInstance;
}

/**
 * 获取数据库实例
 */
export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbInstance;
}

/**
 * 插入请求记录
 */
export async function insertRequestRecord(record: RequestRecord): Promise<void> {
  const db = getDatabase();

  await db.run(
    `INSERT INTO requests (
      id, timestamp, client, path, method,
      original_body, modified_body, request_size, response_size, matched_rules,
      response_status, duration_ms, response_headers, response_body, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.timestamp,
      record.client,
      record.path,
      record.method,
      record.originalBody,
      record.modifiedBody,
      record.requestSize ?? null,
      record.responseSize ?? null,
      record.matchedRules,
      record.responseStatus ?? null,
      record.durationMs ?? null,
      record.responseHeaders ?? null,
      record.responseBody ?? null,
      record.error ?? null,
    ],
  );
}

/**
 * 获取唯一路径列表
 */
export async function getUniquePaths(prefix?: string): Promise<PathsResponse> {
  const db = getDatabase();

  let sql = 'SELECT DISTINCT path FROM requests';
  const params: any[] = [];

  if (prefix) {
    sql += ' WHERE path LIKE ?';
    params.push(`${prefix}%`);
  }

  sql += ' ORDER BY path ASC';

  const rows = await db.all<Array<{ path: string }>>(sql, params);

  return {
    paths: rows.map(r => r.path),
    count: rows.length,
  };
}

/**
 * 获取请求列表（带分页和筛选）
 */
export async function getRequestList(options: {
  limit?: number;
  offset?: number;
  client?: string;
  startTime?: number;
  endTime?: number;
  search?: string;
}): Promise<RequestListResponse> {
  const db = getDatabase();
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;
  const search = options.search ?? null;

  // 判断是否为路径搜索（以 / 开头）
  const isPathSearch = search && search.startsWith('/');

  // 构建搜索条件
  let searchCondition: string;
  let searchParams: (string | null)[];

  if (isPathSearch) {
    // 路径前缀匹配
    searchCondition = '(? IS NULL OR path LIKE ?)';
    searchParams = [search, `${search}%`];
  } else {
    // ID/路径/请求体模糊匹配
    searchCondition = '(? IS NULL OR id LIKE ? OR path LIKE ? OR original_body LIKE ?)';
    searchParams = [
      search,
      search ? `%${search}%` : null,
      search ? `%${search}%` : null,
      search ? `%${search}%` : null,
    ];
  }

  // 计算总数
  const countResult = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM requests
     WHERE (? IS NULL OR client = ?)
       AND (? IS NULL OR timestamp >= ?)
       AND (? IS NULL OR timestamp <= ?)
       AND ${searchCondition}`,
    [
      options.client ?? null,
      options.client ?? null,
      options.startTime ?? null,
      options.startTime ?? null,
      options.endTime ?? null,
      options.endTime ?? null,
      ...searchParams,
    ],
  );
  const total = countResult?.count ?? 0;

  // 获取分页数据
  const rows = await db.all<any[]>(
    `
     SELECT
       id, timestamp, client, path, method,
       request_size, response_size, matched_rules, response_status, duration_ms, error
     FROM requests
     WHERE (? IS NULL OR client = ?)
       AND (? IS NULL OR timestamp >= ?)
       AND (? IS NULL OR timestamp <= ?)
       AND ${searchCondition}
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`,
    [
      options.client ?? null,
      options.client ?? null,
      options.startTime ?? null,
      options.startTime ?? null,
      options.endTime ?? null,
      options.endTime ?? null,
      ...searchParams,
      limit,
      offset,
    ],
  );

  // 解析 matched_rules 为数组
  const items = rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    client: row.client,
    path: row.path,
    method: row.method,
    requestSize: row.request_size ?? undefined,
    responseSize: row.response_size ?? undefined,
    matchedRules: row.matched_rules ? JSON.parse(row.matched_rules).map((m: any) => m.ruleId) : [],
    responseStatus: row.response_status ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    error: row.error ?? undefined,
  }));

  return {
    total,
    limit,
    offset,
    items,
  };
}

/**
 * 获取单个请求详情
 */
export async function getRequestDetail(id: string): Promise<RequestRecord | null> {
  const db = getDatabase();

  const row = await db.get<any>(`SELECT * FROM requests WHERE id = ?`, [id]);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    timestamp: row.timestamp,
    client: row.client,
    path: row.path,
    method: row.method,
    originalBody: row.original_body,
    modifiedBody: row.modified_body,
    requestSize: row.request_size ?? undefined,
    responseSize: row.response_size ?? undefined,
    matchedRules: row.matched_rules,
    responseStatus: row.response_status ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    responseHeaders: row.response_headers ?? undefined,
    responseBody: row.response_body ?? undefined,
    error: row.error ?? undefined,
  };
}

/**
 * 清理旧数据
 */
export async function cleanupOldRequests(keep: number = 100): Promise<number> {
  const db = getDatabase();

  // 获取要删除的记录数
  const countResult = await db.get<{ count: number }>(`SELECT COUNT(*) as count FROM requests`);
  const total = countResult?.count ?? 0;

  if (total <= keep) {
    return 0;
  }

  // 删除旧数据
  const result = await db.run(
    `DELETE FROM requests
     WHERE id NOT IN (
       SELECT id FROM requests
       ORDER BY timestamp DESC
       LIMIT ?
     )`,
    [keep],
  );

  return result.changes ?? 0;
}

/**
 * 获取请求统计信息
 */
export async function getRequestStats(): Promise<{
  total: number;
  byClient: Record<string, number>;
  recent: number;
}> {
  const db = getDatabase();

  // 总数
  const totalResult = await db.get<{ count: number }>(`SELECT COUNT(*) as count FROM requests`);
  const total = totalResult?.count ?? 0;

  // 按客户端分组
  const clientRows = await db.all<Array<{ client: string; count: number }>>(
    `SELECT client, COUNT(*) as count FROM requests GROUP BY client`,
  );
  const byClient: Record<string, number> = {};
  for (const row of clientRows) {
    byClient[row.client] = row.count;
  }

  // 最近24小时
  const recentResult = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM requests WHERE timestamp > ?`,
    [Date.now() - 24 * 60 * 60 * 1000],
  );
  const recent = recentResult?.count ?? 0;

  return { total, byClient, recent };
}

/**
 * 删除单个请求
 */
export async function deleteRequest(id: string): Promise<boolean> {
  const db = getDatabase();

  const result = await db.run(`DELETE FROM requests WHERE id = ?`, [id]);

  return (result.changes ?? 0) > 0;
}

/**
 * 获取数据库大小信息
 */
export async function getDatabaseInfo(): Promise<{
  path: string;
  size: number;
  recordCount: number;
}> {
  const dbPath = getDbPath();
  const db = getDatabase();

  const countResult = await db.get<{ count: number }>(`SELECT COUNT(*) as count FROM requests`);

  // 尝试获取文件大小
  let size = 0;
  try {
    const { stat } = await import('node:fs/promises');
    const stats = await stat(dbPath);
    size = stats.size;
  } catch {
    // 如果文件不存在或无法访问，返回 0
  }

  return {
    path: dbPath,
    size,
    recordCount: countResult?.count ?? 0,
  };
}

/**
 * 获取单个设置值
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = getDatabase();
  const result = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [key]);
  return result?.value ?? null;
}

/**
 * 获取所有设置
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const db = getDatabase();
  const rows = await db.all<Array<{ key: string; value: string }>>(`SELECT key, value FROM settings`);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

/**
 * 更新设置值
 */
export async function updateSetting(key: string, value: string): Promise<void> {
  const db = getDatabase();
  await db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
}

/**
 * 获取过滤路径列表
 * 返回需要被过滤掉的路径数组（不记录到数据库）
 */
export async function getFilteredPaths(): Promise<string[]> {
  const db = getDatabase();
  const result = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, ['filtered_paths']);
  if (!result?.value) {
    return [];
  }
  try {
    const paths = JSON.parse(result.value);
    return Array.isArray(paths) ? paths : [];
  } catch {
    return [];
  }
}

/**
 * 检查路径是否应该被过滤（不记录）
 * 支持精确匹配和前缀匹配
 */
export function shouldFilterPath(path: string, filteredPaths: string[]): boolean {
  for (const filteredPath of filteredPaths) {
    // 精确匹配
    if (path === filteredPath) {
      return true;
    }
    // 前缀匹配（如果过滤路径以 / 结尾，则表示前缀匹配）
    if (filteredPath.endsWith('/') && path.startsWith(filteredPath)) {
      return true;
    }
    // 前缀匹配（路径以过滤路径 + / 开头）
    if (path.startsWith(filteredPath + '/')) {
      return true;
    }
  }
  return false;
}

/**
 * 重置数据库实例（仅用于测试）
 * 关闭当前连接并清除实例，允许重新初始化
 */
export async function resetDatabaseForTest(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.close();
    } catch {
      // 忽略关闭错误
    }
    dbInstance = null;
  }
}
