import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'node:path';
import * as os from 'node:os';
import { mkdir } from 'node:fs/promises';
import { RequestRecord, RequestListResponse } from './types.js';

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

    -- 设置表
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- 插入默认设置
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('max_history', '100'),
      ('auto_cleanup', 'true'),
      ('cleanup_interval_hours', '1');
  `);

  // 数据库迁移：为已有数据库添加 response_body 列
  try {
    // 检查列是否存在
    const tableInfo = await dbInstance.all(
      `PRAGMA table_info(requests)`
    );
    const hasResponseBody = tableInfo.some((col: any) => col.name === 'response_body');

    if (!hasResponseBody) {
      await dbInstance.exec(`ALTER TABLE requests ADD COLUMN response_body TEXT`);
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
      original_body, modified_body, matched_rules,
      response_status, duration_ms, response_headers, response_body, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.timestamp,
      record.client,
      record.path,
      record.method,
      record.originalBody,
      record.modifiedBody,
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

  // 计算总数
  const countResult = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM requests
     WHERE (? IS NULL OR client = ?)
       AND (? IS NULL OR timestamp >= ?)
       AND (? IS NULL OR timestamp <= ?)
       AND (? IS NULL OR id LIKE ? OR path LIKE ? OR original_body LIKE ?)`,
    [
      options.client ?? null,
      options.client ?? null,
      options.startTime ?? null,
      options.startTime ?? null,
      options.endTime ?? null,
      options.endTime ?? null,
      search,
      search ? `%${search}%` : null,
      search ? `%${search}%` : null,
      search ? `%${search}%` : null,
    ],
  );
  const total = countResult?.count ?? 0;

  // 获取分页数据
  const rows = await db.all<any[]>(
    `
     SELECT
       id, timestamp, client, path, method,
       matched_rules, response_status, duration_ms, error
     FROM requests
     WHERE (? IS NULL OR client = ?)
       AND (? IS NULL OR timestamp >= ?)
       AND (? IS NULL OR timestamp <= ?)
       AND (? IS NULL OR id LIKE ? OR path LIKE ? OR original_body LIKE ?)
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`,
    [
      options.client ?? null,
      options.client ?? null,
      options.startTime ?? null,
      options.startTime ?? null,
      options.endTime ?? null,
      options.endTime ?? null,
      search,
      search ? `%${search}%` : null,
      search ? `%${search}%` : null,
      search ? `%${search}%` : null,
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
