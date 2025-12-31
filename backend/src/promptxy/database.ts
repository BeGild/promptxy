import initSqlJs, { Database } from 'sql.js';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import { RequestRecord, RequestListResponse, PathsResponse } from './types.js';

let dbInstance: Database | null = null;
let sqlJsReady: Promise<any> | null = null;

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
 * 初始化 SQL.js
 */
function getSqlJs(): Promise<any> {
  if (!sqlJsReady) {
    sqlJsReady = initSqlJs();
  }
  return sqlJsReady;
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
  await fs.mkdir(dataDir, { recursive: true });

  // 初始化 SQL.js
  const SQL = await getSqlJs();

  // 尝试读取现有数据库，或创建新数据库
  let db: Database;
  try {
    const buffer = await fs.readFile(dbPath);
    db = new SQL.Database(buffer);
  } catch {
    // 文件不存在，创建新数据库
    db = new SQL.Database();
  }

  dbInstance = db;

  // 初始化表结构
  db.exec(`
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
    const tableInfo = db.exec(`PRAGMA table_info(requests)`).values;

    // 迁移 response_body 列
    const hasResponseBody = tableInfo.some((col: any[]) => col[1] === 'response_body');
    if (!hasResponseBody) {
      db.exec(`ALTER TABLE requests ADD COLUMN response_body TEXT`);
    }

    // 迁移 request_size 列
    const hasRequestSize = tableInfo.some((col: any[]) => col[1] === 'request_size');
    if (!hasRequestSize) {
      db.exec(`ALTER TABLE requests ADD COLUMN request_size INTEGER`);
    }

    // 迁移 response_size 列
    const hasResponseSize = tableInfo.some((col: any[]) => col[1] === 'response_size');
    if (!hasResponseSize) {
      db.exec(`ALTER TABLE requests ADD COLUMN response_size INTEGER`);
    }
  } catch {
    // 忽略迁移错误，可能是新数据库
  }

  return dbInstance;
}

/**
 * 保存数据库到文件
 */
export async function saveDatabase(): Promise<void> {
  if (!dbInstance) {
    return;
  }

  const dbPath = getDbPath();
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  await fs.writeFile(dbPath, buffer);
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
 * 插入后会自动检查数量是否超过 maxHistory，超过则清理旧记录
 */
export async function insertRequestRecord(record: RequestRecord): Promise<void> {
  const db = getDatabase();

  db.run(
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

  // 检查是否需要清理旧记录
  const maxHistory = getSetting('max_history');
  const keep = maxHistory ? Number(maxHistory) : 1000;
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM requests`);
  countStmt.step();
  const countResult = countStmt.getAsObject();
  countStmt.free();
  const total = (countResult as any).count ?? 0;

  if (total > keep) {
    // 删除旧数据，保留最新的 keep 条
    db.run(
      `DELETE FROM requests
       WHERE id NOT IN (
         SELECT id FROM requests
         ORDER BY timestamp DESC
         LIMIT ?
       )`,
      [keep],
    );
  }

  // 保存到文件
  await saveDatabase();
}

/**
 * 获取唯一路径列表
 */
export async function getUniquePaths(prefix?: string): Promise<PathsResponse> {
  const db = getDatabase();

  let sql = 'SELECT DISTINCT path FROM requests';
  const params: (string | number)[] = [];

  if (prefix) {
    sql += ' WHERE path LIKE ?';
    params.push(`${prefix}%`);
  }

  sql += ' ORDER BY path ASC';

  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[][] = [];

  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  return {
    paths: rows.map(r => (r as any).path),
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

  // 构建完整查询
  const baseParams = [
    options.client ?? null,
    options.client ?? null,
    options.startTime ?? null,
    options.startTime ?? null,
    options.endTime ?? null,
    options.endTime ?? null,
    ...searchParams,
  ];

  // 计算总数
  const countStmt = db.prepare(
    `SELECT COUNT(*) as count FROM requests
     WHERE (? IS NULL OR client = ?)
       AND (? IS NULL OR timestamp >= ?)
       AND (? IS NULL OR timestamp <= ?)
       AND ${searchCondition}`,
  );
  countStmt.bind(baseParams);
  countStmt.step();
  const countResult = countStmt.getAsObject();
  countStmt.free();
  const total = (countResult as any).count ?? 0;

  // 获取分页数据
  const selectStmt = db.prepare(`
     SELECT
       id, timestamp, client, path, method,
       request_size, response_size, matched_rules, response_status, duration_ms, error
     FROM requests
     WHERE (? IS NULL OR client = ?)
       AND (? IS NULL OR timestamp >= ?)
       AND (? IS NULL OR timestamp <= ?)
       AND ${searchCondition}
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`
  );

  selectStmt.bind([...baseParams, limit, offset]);
  const rows: any[] = [];
  while (selectStmt.step()) {
    rows.push(selectStmt.getAsObject());
  }
  selectStmt.free();

  // 解析 matched_rules 为数组
  const items = rows.map((row: any) => ({
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

  const stmt = db.prepare(`SELECT * FROM requests WHERE id = ?`);
  stmt.bind([id]);
  const hasRow = stmt.step();
  if (!hasRow) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject();
  stmt.free();

  return {
    id: (row as any).id,
    timestamp: (row as any).timestamp,
    client: (row as any).client,
    path: (row as any).path,
    method: (row as any).method,
    originalBody: (row as any).original_body,
    modifiedBody: (row as any).modified_body,
    requestSize: (row as any).request_size ?? undefined,
    responseSize: (row as any).response_size ?? undefined,
    matchedRules: (row as any).matched_rules,
    responseStatus: (row as any).response_status ?? undefined,
    durationMs: (row as any).duration_ms ?? undefined,
    responseHeaders: (row as any).response_headers ?? undefined,
    responseBody: (row as any).response_body ?? undefined,
    error: (row as any).error ?? undefined,
  };
}

/**
 * 清理旧数据
 */
export async function cleanupOldRequests(keep: number = 100): Promise<number> {
  const db = getDatabase();

  // 获取要删除的记录数 - 使用 prepare 而不是 exec
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM requests`);
  countStmt.step();
  const countResult = countStmt.getAsObject();
  countStmt.free();
  const total = (countResult as any).count ?? 0;

  if (total <= keep) {
    await saveDatabase();
    return 0;
  }

  // 删除旧数据
  db.run(
    `DELETE FROM requests
     WHERE id NOT IN (
       SELECT id FROM requests
       ORDER BY timestamp DESC
       LIMIT ?
     )`,
    [keep],
  );

  await saveDatabase();

  return total - keep;
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

  // 总数 - 使用 prepare 而不是 exec
  const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM requests`);
  totalStmt.step();
  const totalResult = totalStmt.getAsObject();
  totalStmt.free();
  const total = (totalResult as any).count ?? 0;

  // 按客户端分组
  const clientStmt = db.prepare(`SELECT client, COUNT(*) as count FROM requests GROUP BY client`);
  const byClient: Record<string, number> = {};
  while (clientStmt.step()) {
    const row = clientStmt.getAsObject() as any;
    byClient[row.client] = row.count;
  }
  clientStmt.free();

  // 最近24小时
  const recentStmt = db.prepare(
    `SELECT COUNT(*) as count FROM requests WHERE timestamp > ?`
  );
  recentStmt.bind([Date.now() - 24 * 60 * 60 * 1000]);
  recentStmt.step();
  const recentResult = recentStmt.getAsObject() as any;
  recentStmt.free();
  const recent = recentResult.count ?? 0;

  return { total, byClient, recent };
}

/**
 * 删除单个请求
 */
export async function deleteRequest(id: string): Promise<boolean> {
  const db = getDatabase();

  const stmt = db.prepare(`DELETE FROM requests WHERE id = ?`);
  stmt.bind([id]);
  stmt.step();
  const changes = db.getRowsModified();
  stmt.free();

  await saveDatabase();

  return changes > 0;
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

  // 使用 prepare 而不是 exec
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM requests`);
  countStmt.step();
  const countResult = countStmt.getAsObject();
  countStmt.free();
  const recordCount = (countResult as any).count ?? 0;

  // 尝试获取文件大小
  let size = 0;
  try {
    const stats = await fs.stat(dbPath);
    size = stats.size;
  } catch {
    // 如果文件不存在或无法访问，返回 0
  }

  return {
    path: dbPath,
    size,
    recordCount,
  };
}

/**
 * 获取单个设置值
 */
export function getSetting(key: string): string | null {
  const db = getDatabase();
  const stmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);
  stmt.bind([key]);
  if (stmt.step()) {
    const result = stmt.getAsObject() as any;
    stmt.free();
    return result.value ?? null;
  }
  stmt.free();
  return null;
}

/**
 * 获取所有设置
 */
export function getAllSettings(): Record<string, string> {
  const db = getDatabase();
  const stmt = db.prepare(`SELECT key, value FROM settings`);
  const settings: Record<string, string> = {};
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    settings[row.key] = row.value;
  }
  stmt.free();
  return settings;
}

/**
 * 更新设置值
 */
export async function updateSetting(key: string, value: string): Promise<void> {
  const db = getDatabase();
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
  await saveDatabase();
}

/**
 * 获取过滤路径列表
 * 返回需要被过滤掉的路径数组（不记录到数据库）
 */
export function getFilteredPaths(): string[] {
  const db = getDatabase();
  const stmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);
  stmt.bind(['filtered_paths']);
  if (stmt.step()) {
    const result = stmt.getAsObject() as any;
    stmt.free();
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
  stmt.free();
  return [];
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
      dbInstance.close();
    } catch {
      // 忽略关闭错误
    }
    dbInstance = null;
  }

  // 删除数据库文件以确保完全干净的状态
  const dbPath = getDbPath();
  try {
    await fs.unlink(dbPath);
  } catch {
    // 文件不存在，忽略
  }
}
