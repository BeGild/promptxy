import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

import {
  emptyStatsMetrics,
  type PathsResponse,
  type RequestListResponse,
  type RequestRecord,
  type StatsDaily,
  type StatsHourly,
  type StatsMetrics,
  type StatsModel,
  type StatsRoute,
  type StatsSupplier,
  type StatsToday,
  type StatsTotal,
} from '../types.js';

import { openSqliteDb, type SqliteDb } from './sqlite.js';

// 说明：
// - 当前实现以“最小可用 + 兼容既有 API 返回结构”为优先目标
// - 统计相关接口先用 SQL 即时聚合（不做物化聚合表）
// - settings 仍沿用 settings.json（体积小，改动面最小）

function toJsonString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function safeJsonParse<T>(str: string | undefined): T | undefined {
  if (!str) return undefined;
  try {
    return JSON.parse(str) as T;
  } catch {
    return undefined;
  }
}

function ensureNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function metricsFromRow(row: Record<string, unknown>): StatsMetrics {
  const metrics = emptyStatsMetrics();
  metrics.inputTokens = ensureNumber(row.inputTokens);
  metrics.outputTokens = ensureNumber(row.outputTokens);
  metrics.totalTokens = metrics.inputTokens + metrics.outputTokens;

  metrics.inputCost = ensureNumber(row.inputCost);
  metrics.outputCost = ensureNumber(row.outputCost);
  metrics.totalCost = metrics.inputCost + metrics.outputCost;

  metrics.waitTime = ensureNumber(row.waitTime);
  metrics.durationTime = ensureNumber(row.durationTime);

  metrics.requestSuccess = ensureNumber(row.requestSuccess);
  metrics.requestFailed = ensureNumber(row.requestFailed);
  metrics.requestTotal = metrics.requestSuccess + metrics.requestFailed;

  metrics.ftutCount = ensureNumber(row.ftutCount);
  metrics.ftutSum = ensureNumber(row.ftutSum);
  metrics.ftutAvg = metrics.ftutCount > 0 ? metrics.ftutSum / metrics.ftutCount : 0;

  return metrics;
}

function formatDateLocal(timestampMs: number): string {
  const d = new Date(timestampMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dateKeyOfLocal(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(n => Number(n));
  return new Date(y, m - 1, d).getTime();
}

function routeIdToLocalService(routeId: string): string {
  const parts = routeId.split('-');
  if (parts.length >= 2 && parts[0] === 'route') {
    const localService = parts.slice(1, -1).join('-');
    if (localService) return localService;
  }
  return 'claude';
}

export class SqliteStorage {
  private dataDir: string;
  private dbPath: string;
  private settingsPath: string;
  private lockFilePath: string;

  private db: SqliteDb | null = null;
  private closing = false;

  private defaultSettings: Record<string, string> = {
    max_history: '1000',
    auto_cleanup: 'true',
    cleanup_interval_hours: '1',
    filtered_paths: '[]',
  };

  private settingsCache: Record<string, string> = { ...this.defaultSettings };

  private async safeAddColumn(table: string, column: string, typeDef: string): Promise<void> {
    const db = this.assertDb();
    try {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
    } catch (error: any) {
      const message = String(error?.message || '');
      if (
        message.includes('duplicate column name') ||
        message.includes('already exists') ||
        message.includes(`duplicate column name: ${column}`)
      ) {
        return;
      }
      throw error;
    }
  }

  constructor() {
    const homeDir = os.homedir();
    this.dataDir = path.join(homeDir, '.local', 'promptxy');
    this.dbPath = path.join(this.dataDir, 'promptxy.db');
    this.settingsPath = path.join(this.dataDir, 'settings.json');
    this.lockFilePath = path.join(this.dataDir, '.lock');
  }

  getDbPath(): string {
    return this.dbPath;
  }

  getDataDir(): string {
    return this.dataDir;
  }

  private async acquireLock(debugMode: boolean): Promise<void> {
    if (debugMode) {
      console.log('[PromptXY] 开发模式：跳过进程互斥锁检查');
      return;
    }

    await fs.mkdir(this.dataDir, { recursive: true });

    const isProcessAlive = async (pid: number): Promise<boolean> => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (e: any) {
        // EPERM: 进程存在但无权限发送信号（视为存活）
        if (e?.code === 'EPERM') {
          return true;
        }
        try {
          await fs.access(`/proc/${pid}`);
          return true;
        } catch {
          return false;
        }
      }
    };

    // 如果存在旧锁文件，尝试判断是否为僵尸锁
    try {
      const lockContent = await fs.readFile(this.lockFilePath, 'utf-8');
      const lockInfo = JSON.parse(lockContent) as { pid?: number; createdAt?: string };
      const pid = typeof lockInfo.pid === 'number' ? lockInfo.pid : undefined;

      if (pid !== undefined) {
        const alive = await isProcessAlive(pid);
        if (alive) {
          throw new Error(
            `PromptXY 已在运行 (PID: ${pid}${lockInfo.createdAt ? `, 启动时间: ${lockInfo.createdAt}` : ''})`,
          );
        }
      }

      // 旧锁无效，清理
      await fs.unlink(this.lockFilePath);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        // 非 “文件不存在” 的错误需要继续处理（例如 JSON 解析失败）
        // 尝试直接删除旧锁文件，删除失败则向上抛
        try {
          await fs.unlink(this.lockFilePath);
        } catch (unlinkErr: any) {
          if (unlinkErr?.code !== 'ENOENT') throw err;
        }
      }
    }

    // 创建新锁
    try {
      await fs.writeFile(
        this.lockFilePath,
        JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }, null, 2),
        { flag: 'wx' },
      );
    } catch (err: any) {
      if (err?.code === 'EEXIST') throw new Error('PromptXY 已有实例在运行，请勿重复启动');
      throw err;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await fs.unlink(this.lockFilePath);
    } catch {
      // ignore
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const content = await fs.readFile(this.settingsPath, 'utf-8');
      const loaded = JSON.parse(content) as Record<string, string>;
      this.settingsCache = { ...this.defaultSettings, ...loaded };
    } catch {
      this.settingsCache = { ...this.defaultSettings };
    }
  }

  private async saveSettings(): Promise<void> {
    const content = JSON.stringify(this.settingsCache, null, 2);
    await fs.writeFile(this.settingsPath, content, 'utf-8');
  }

  private assertDb(): SqliteDb {
    if (!this.db) {
      throw new Error('SQLite not initialized');
    }
    return this.db;
  }

  async initialize(debugMode = false): Promise<void> {
    await this.acquireLock(debugMode);
    await fs.mkdir(this.dataDir, { recursive: true });
    await this.loadSettings();

    this.db = await openSqliteDb(this.dbPath);

    // PRAGMA: 稳定性优先的常用组合
    await this.db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
`);

    await this.db.exec(`
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  client TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,

  request_size INTEGER,
  response_size INTEGER,
  response_status INTEGER,
  duration_ms INTEGER,
  error TEXT,

  matched_rules_brief TEXT,

  supplier_name TEXT,
  supplier_client TEXT,
  transformer_chain TEXT,
  transformed_path TEXT,

  route_id TEXT,
  route_name_snapshot TEXT,
  supplier_id TEXT,
  supplier_base_url TEXT,

  original_request_model TEXT,
  requested_model TEXT,
  upstream_model TEXT,
  billing_model TEXT,
  cached_input_tokens INTEGER,

  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  input_cost REAL,
  output_cost REAL,
  total_cost REAL,
  wait_time INTEGER,
  ftut INTEGER,
  usage_source TEXT,
  pricing_status TEXT,
  pricing_snapshot_json TEXT
);

CREATE TABLE IF NOT EXISTS request_payloads (
  id TEXT PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE,
  original_body TEXT NOT NULL,
  transformed_body TEXT,
  modified_body TEXT NOT NULL,

  request_headers TEXT,
  original_request_headers TEXT,
  response_headers TEXT,
  response_body TEXT,
  matched_rules TEXT NOT NULL,
  transform_trace TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_ts ON requests(ts DESC);
CREATE INDEX IF NOT EXISTS idx_requests_client_ts ON requests(client, ts DESC);
CREATE INDEX IF NOT EXISTS idx_requests_path_ts ON requests(path, ts DESC);
`);

    await this.safeAddColumn('requests', 'route_name_snapshot', 'TEXT');
    await this.safeAddColumn('requests', 'pricing_status', 'TEXT');
    await this.safeAddColumn('requests', 'pricing_snapshot_json', 'TEXT');
    await this.safeAddColumn('requests', 'original_request_model', 'TEXT');
  }

  async close(): Promise<void> {
    this.closing = true;
    const db = this.db;
    this.db = null;
    if (db) {
      await db.close().catch(() => {});
    }
    await this.releaseLock();
  }

  getSetting(key: string): string | null {
    return this.settingsCache[key] ?? null;
  }

  getAllSettings(): Record<string, string> {
    return { ...this.settingsCache };
  }

  async updateSetting(key: string, value: string): Promise<void> {
    this.settingsCache[key] = value;
    await this.saveSettings();
  }

  getFilteredPaths(): string[] {
    const filteredPathsStr = this.getSetting('filtered_paths');
    if (!filteredPathsStr) return [];
    try {
      const paths = JSON.parse(filteredPathsStr);
      return Array.isArray(paths) ? paths : [];
    } catch {
      return [];
    }
  }

  shouldFilterPath(p: string, filteredPaths: string[]): boolean {
    for (const filteredPath of filteredPaths) {
      if (p === filteredPath) return true;
      if (filteredPath.endsWith('/') && p.startsWith(filteredPath)) return true;
      if (p.startsWith(filteredPath + '/')) return true;
    }
    return false;
  }

  // 请求操作

  async insert(record: RequestRecord): Promise<void> {
    // 写入是“最佳努力”：如果服务正在关闭或 db 已释放，不应影响代理主路径
    const db = this.db;
    if (!db || this.closing) return;

    try {
      const matchedRulesBrief = (() => {
        try {
          const arr = JSON.parse(record.matchedRules || '[]');
          if (Array.isArray(arr)) return JSON.stringify(arr.map((m: any) => m.ruleId).filter(Boolean));
        } catch {
          // ignore
        }
        return '[]';
      })();

      const responseBody = Array.isArray(record.responseBody) ? JSON.stringify(record.responseBody) : record.responseBody;

      await db.exec('BEGIN');
      await db.run(
        `
INSERT INTO requests (
  id, ts, client, path, method,
  request_size, response_size, response_status, duration_ms, error,
  matched_rules_brief,
  supplier_name, supplier_client, transformer_chain, transformed_path,
  route_id, route_name_snapshot, supplier_id, supplier_base_url,
  original_request_model, requested_model, upstream_model, billing_model, cached_input_tokens,
  input_tokens, output_tokens, total_tokens,
  input_cost, output_cost, total_cost,
  wait_time, ftut, usage_source,
  pricing_status, pricing_snapshot_json
) VALUES (
  ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?,
  ?, ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?
)
        `,
        [
          record.id,
          record.timestamp,
          record.client,
          record.path,
          record.method,
          record.requestSize ?? null,
          record.responseSize ?? null,
          record.responseStatus ?? null,
          record.durationMs ?? null,
          record.error ?? null,
          matchedRulesBrief,
          record.supplierName ?? null,
          record.supplierClient ?? null,
          record.transformerChain ?? null,
          record.transformedPath ?? null,
          record.routeId ?? null,
          record.routeNameSnapshot ?? null,
          record.supplierId ?? null,
          record.supplierBaseUrl ?? null,
          (record as any).originalRequestModel ?? null,
          record.requestedModel ?? null,
          record.upstreamModel ?? null,
          record.model ?? null,
          record.cachedInputTokens ?? null,
          record.inputTokens ?? null,
          record.outputTokens ?? null,
          record.totalTokens ?? null,
          record.inputCost ?? null,
          record.outputCost ?? null,
          record.totalCost ?? null,
          record.waitTime ?? null,
          record.ftut ?? null,
          record.usageSource ?? null,
          record.pricingStatus ?? null,
          record.pricingSnapshot ?? null,
        ],
      );

      await db.run(
        `
INSERT INTO request_payloads (
  id, original_body, transformed_body, modified_body,
  request_headers, original_request_headers,
  response_headers, response_body,
  matched_rules, transform_trace
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          record.id,
          record.originalBody,
          record.transformedBody ?? null,
          record.modifiedBody,
          toJsonString(record.requestHeaders) ?? null,
          toJsonString(record.originalRequestHeaders) ?? null,
          toJsonString(record.responseHeaders) ?? null,
          responseBody ?? null,
          record.matchedRules,
          record.transformTrace ?? null,
        ],
      );

      // 自动清理：保持 max_history
      const keepStr = this.getSetting('max_history');
      const keep = keepStr ? Number(keepStr) : 1000;
      if (Number.isFinite(keep) && keep > 0) {
        await db.run(
          `
DELETE FROM requests
WHERE id IN (
  SELECT id FROM requests
  ORDER BY ts DESC
  LIMIT -1 OFFSET ?
)
          `,
          [keep],
        );
      }

      await db.exec('COMMIT');
    } catch (e) {
      await db.exec('ROLLBACK').catch(() => {});

      // 关闭过程中的竞态：insert() 可能已拿到 db 引用，但 close() 在另一边发生。
      // 此时不应影响代理主路径，也无需污染日志。
      const msg = (e as any)?.message ? String((e as any).message) : '';
      if (this.closing || msg.includes('Database handle is closed') || msg.includes('SQLITE_MISUSE')) {
        return;
      }

      throw e;
    }
  }

  async query(options: {
    limit?: number;
    offset?: number;
    client?: string;
    startTime?: number;
    endTime?: number;
    search?: string;
  }): Promise<RequestListResponse> {
    const db = this.assertDb();
    const limit = Math.min(options.limit ?? 50, 100);
    const offset = options.offset ?? 0;

    const where: string[] = [];
    const params: unknown[] = [];

    if (options.client) {
      where.push('client = ?');
      params.push(options.client);
    }
    if (options.startTime !== undefined) {
      where.push('ts >= ?');
      params.push(options.startTime);
    }
    if (options.endTime !== undefined) {
      where.push('ts <= ?');
      params.push(options.endTime);
    }
    if (options.search) {
      const search = options.search;
      if (search.startsWith('/')) {
        where.push('path LIKE ?');
        params.push(`${search}%`);
      } else {
        where.push('(id LIKE ? COLLATE NOCASE OR path LIKE ? COLLATE NOCASE)');
        params.push(`%${search}%`, `%${search}%`);
      }
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = await db.get<{ total: number }>(
      `SELECT COUNT(1) as total FROM requests ${whereSql}`,
      params,
    );
    const total = totalRow?.total ?? 0;

    const rows = await db.all<{
      id: string;
      ts: number;
      client: string;
      path: string;
      method: string;
      request_size: number | null;
      response_size: number | null;
      response_status: number | null;
      duration_ms: number | null;
      error: string | null;
      matched_rules_brief: string | null;
      supplier_name: string | null;
      supplier_client: string | null;
      transformer_chain: string | null;
      transformed_path: string | null;
      route_name_snapshot: string | null;
      original_request_model: string | null;
      requested_model: string | null;
      upstream_model: string | null;
      billing_model: string | null;
      cached_input_tokens: number | null;
      input_tokens: number | null;
      output_tokens: number | null;
      total_tokens: number | null;
      total_cost: number | null;
      pricing_status: string | null;
      pricing_snapshot_json: string | null;
    }>(
      `
SELECT
  id, ts, client, path, method,
  request_size, response_size, response_status, duration_ms, error,
  matched_rules_brief,
  supplier_name, supplier_client, transformer_chain, transformed_path,
  route_name_snapshot,
  original_request_model, requested_model, upstream_model, billing_model,
  cached_input_tokens, input_tokens, output_tokens, total_tokens, total_cost,
  pricing_status, pricing_snapshot_json
FROM requests
${whereSql}
ORDER BY ts DESC
LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    const items = rows.map(r => ({
      id: r.id,
      timestamp: r.ts,
      client: r.client,
      path: r.path,
      method: r.method,
      requestSize: r.request_size ?? undefined,
      responseSize: r.response_size ?? undefined,
      matchedRules: safeJsonParse<string[]>(r.matched_rules_brief || '[]') ?? [],
      responseStatus: r.response_status ?? undefined,
      durationMs: r.duration_ms ?? undefined,
      error: r.error ?? undefined,
      supplierName: r.supplier_name ?? undefined,
      supplierClient: r.supplier_client ?? undefined,
      transformerChain: safeJsonParse<string[]>(r.transformer_chain || '') ?? undefined,
      transformedPath: r.transformed_path ?? undefined,
      routeNameSnapshot: r.route_name_snapshot ?? undefined,
      originalRequestModel: r.original_request_model ?? undefined,
      requestedModel: r.requested_model ?? undefined,
      upstreamModel: r.upstream_model ?? undefined,
      model: r.billing_model ?? undefined,
      cachedInputTokens: r.cached_input_tokens ?? undefined,
      inputTokens: r.input_tokens ?? undefined,
      outputTokens: r.output_tokens ?? undefined,
      totalTokens: r.total_tokens ?? undefined,
      totalCost: r.total_cost ?? undefined,
      pricingStatus: (r.pricing_status as RequestRecord['pricingStatus']) ?? undefined,
      pricingSnapshot: r.pricing_snapshot_json ?? undefined,
    }));

    return { total, limit, offset, items };
  }

  async getDetail(id: string): Promise<RequestRecord | null> {
    const db = this.assertDb();

    const row = await db.get<any>(
      `
SELECT
  r.id as id,
  r.ts as ts,
  r.client as client,
  r.path as path,
  r.method as method,
  r.request_size as request_size,
  r.response_size as response_size,
  r.response_status as response_status,
  r.duration_ms as duration_ms,
  r.error as error,
  r.supplier_name as supplier_name,
  r.supplier_client as supplier_client,
  r.transformer_chain as transformer_chain,
  r.transformed_path as transformed_path,
  r.route_id as route_id,
  r.route_name_snapshot as route_name_snapshot,
  r.supplier_id as supplier_id,
  r.supplier_base_url as supplier_base_url,
  r.original_request_model as original_request_model,
  r.requested_model as requested_model,
  r.upstream_model as upstream_model,
  r.billing_model as billing_model,
  r.cached_input_tokens as cached_input_tokens,
  r.input_tokens as input_tokens,
  r.output_tokens as output_tokens,
  r.total_tokens as total_tokens,
  r.input_cost as input_cost,
  r.output_cost as output_cost,
  r.total_cost as total_cost,
  r.wait_time as wait_time,
  r.ftut as ftut,
  r.usage_source as usage_source,
  r.pricing_status as pricing_status,
  r.pricing_snapshot_json as pricing_snapshot_json,

  p.original_body as original_body,
  p.transformed_body as transformed_body,
  p.modified_body as modified_body,
  p.request_headers as request_headers,
  p.original_request_headers as original_request_headers,
  p.response_headers as response_headers,
  p.response_body as response_body,
  p.matched_rules as matched_rules,
  p.transform_trace as transform_trace
FROM requests r
LEFT JOIN request_payloads p ON p.id = r.id
WHERE r.id = ?
      `,
      [id],
    );

    if (!row) return null;

    return {
      id: row.id,
      timestamp: row.ts,
      client: row.client,
      path: row.path,
      method: row.method,
      originalBody: row.original_body,
      transformedBody: row.transformed_body ?? undefined,
      modifiedBody: row.modified_body,
      requestHeaders: row.request_headers ?? undefined,
      originalRequestHeaders: row.original_request_headers ?? undefined,
      requestSize: row.request_size ?? undefined,
      responseSize: row.response_size ?? undefined,
      matchedRules: row.matched_rules ?? '[]',
      responseStatus: row.response_status ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      responseHeaders: row.response_headers ?? undefined,
      responseBody: row.response_body ?? undefined,
      error: row.error ?? undefined,
      routeId: row.route_id ?? undefined,
      routeNameSnapshot: row.route_name_snapshot ?? undefined,
      supplierId: row.supplier_id ?? undefined,
      supplierName: row.supplier_name ?? undefined,
      supplierBaseUrl: row.supplier_base_url ?? undefined,
      supplierClient: row.supplier_client ?? undefined,
      transformerChain: row.transformer_chain ?? undefined,
      transformTrace: row.transform_trace ?? undefined,
      transformedPath: row.transformed_path ?? undefined,
      originalRequestModel: row.original_request_model ?? undefined,
      requestedModel: row.requested_model ?? undefined,
      upstreamModel: row.upstream_model ?? undefined,
      cachedInputTokens: row.cached_input_tokens ?? undefined,
      model: row.billing_model ?? undefined,
      inputTokens: row.input_tokens ?? undefined,
      outputTokens: row.output_tokens ?? undefined,
      totalTokens: row.total_tokens ?? undefined,
      inputCost: row.input_cost ?? undefined,
      outputCost: row.output_cost ?? undefined,
      totalCost: row.total_cost ?? undefined,
      waitTime: row.wait_time ?? undefined,
      ftut: row.ftut ?? undefined,
      usageSource: row.usage_source ?? undefined,
      pricingStatus: row.pricing_status ?? undefined,
      pricingSnapshot: row.pricing_snapshot_json ?? undefined,
    };
  }

  async getUniquePaths(prefix?: string): Promise<PathsResponse> {
    const db = this.assertDb();
    const where = prefix ? 'WHERE path LIKE ?' : '';
    const params = prefix ? [`${prefix}%`] : undefined;
    const rows = await db.all<{ path: string }>(
      `SELECT DISTINCT path as path FROM requests ${where} ORDER BY path ASC`,
      params,
    );
    const paths = rows.map(r => r.path);
    return { paths, count: paths.length };
  }

  async getStats(): Promise<{ total: number; byClient: Record<string, number>; recent: number }> {
    const db = this.assertDb();
    const totalRow = await db.get<{ total: number }>('SELECT COUNT(1) as total FROM requests');
    const total = totalRow?.total ?? 0;

    const byClientRows = await db.all<{ client: string; cnt: number }>(
      `SELECT client as client, COUNT(1) as cnt FROM requests GROUP BY client`,
    );
    const byClient: Record<string, number> = {};
    for (const r of byClientRows) byClient[r.client] = r.cnt;

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentRow = await db.get<{ recent: number }>(
      `SELECT COUNT(1) as recent FROM requests WHERE ts > ?`,
      [oneDayAgo],
    );

    return { total, byClient, recent: recentRow?.recent ?? 0 };
  }

  async cleanupOld(keep: number): Promise<number> {
    const db = this.assertDb();
    const totalRow = await db.get<{ total: number }>('SELECT COUNT(1) as total FROM requests');
    const total = totalRow?.total ?? 0;
    if (total <= keep) return 0;

    const toDelete = total - keep;
    await db.run(
      `
DELETE FROM requests
WHERE id IN (
  SELECT id FROM requests
  ORDER BY ts DESC
  LIMIT -1 OFFSET ?
)
      `,
      [keep],
    );
    return toDelete;
  }

  async delete(id: string): Promise<boolean> {
    const db = this.assertDb();
    const res = await db.run('DELETE FROM requests WHERE id = ?', [id]);
    return res.changes > 0;
  }

  async rebuildIndexPublic(): Promise<{ success: boolean; message: string; count: number }> {
    const db = this.assertDb();
    const totalRow = await db.get<{ total: number }>('SELECT COUNT(1) as total FROM requests');
    return {
      success: true,
      message: 'SQLite 存储模式无需重建索引',
      count: totalRow?.total ?? 0,
    };
  }

  // ============================
  // 统计系统（SQL 即时聚合）
  // ============================

  private async aggregateMetrics(whereSql: string, params: unknown[]): Promise<StatsMetrics> {
    const db = this.assertDb();
    const row =
      (await db.get<Record<string, unknown>>(
        `
SELECT
  SUM(COALESCE(input_tokens, 0)) as inputTokens,
  SUM(COALESCE(output_tokens, 0)) as outputTokens,
  SUM(COALESCE(input_cost, 0)) as inputCost,
  SUM(COALESCE(output_cost, 0)) as outputCost,
  SUM(COALESCE(wait_time, 0)) as waitTime,
  SUM(COALESCE(duration_ms, 0)) as durationTime,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 1 ELSE 0 END) as requestSuccess,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 0 ELSE 1 END) as requestFailed,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN 1 ELSE 0 END) as ftutCount,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN ftut ELSE 0 END) as ftutSum
FROM requests
${whereSql}
        `,
        params,
      )) || {};
    return metricsFromRow(row);
  }

  async getStatsTotal(): Promise<StatsTotal> {
    const metrics = await this.aggregateMetrics('', []);
    return { ...metrics, updatedAt: Date.now() };
  }

  async getStatsDaily(limit: number = 30): Promise<StatsDaily[]> {
    const db = this.assertDb();
    const rows = await db.all<any>(
      `
SELECT
  date(ts / 1000, 'unixepoch', 'localtime') as date,
  SUM(COALESCE(input_tokens, 0)) as inputTokens,
  SUM(COALESCE(output_tokens, 0)) as outputTokens,
  SUM(COALESCE(input_cost, 0)) as inputCost,
  SUM(COALESCE(output_cost, 0)) as outputCost,
  SUM(COALESCE(wait_time, 0)) as waitTime,
  SUM(COALESCE(duration_ms, 0)) as durationTime,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 1 ELSE 0 END) as requestSuccess,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 0 ELSE 1 END) as requestFailed,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN 1 ELSE 0 END) as ftutCount,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN ftut ELSE 0 END) as ftutSum
FROM requests
GROUP BY date
ORDER BY date DESC
LIMIT ?
      `,
      [limit],
    );

    return rows.map((r: any) => {
      const metrics = metricsFromRow(r);
      const dateStr = String(r.date);
      return {
        ...metrics,
        date: dateStr,
        dateKey: dateKeyOfLocal(dateStr),
      };
    });
  }

  async getStatsHourly(): Promise<StatsHourly[]> {
    const db = this.assertDb();
    const today = formatDateLocal(Date.now());

    const rows = await db.all<any>(
      `
SELECT
  date(ts / 1000, 'unixepoch', 'localtime') as date,
  CAST(strftime('%H', ts / 1000, 'unixepoch', 'localtime') AS INTEGER) as hour,
  SUM(COALESCE(input_tokens, 0)) as inputTokens,
  SUM(COALESCE(output_tokens, 0)) as outputTokens,
  SUM(COALESCE(input_cost, 0)) as inputCost,
  SUM(COALESCE(output_cost, 0)) as outputCost,
  SUM(COALESCE(wait_time, 0)) as waitTime,
  SUM(COALESCE(duration_ms, 0)) as durationTime,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 1 ELSE 0 END) as requestSuccess,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 0 ELSE 1 END) as requestFailed,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN 1 ELSE 0 END) as ftutCount,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN ftut ELSE 0 END) as ftutSum
FROM requests
WHERE date(ts / 1000, 'unixepoch', 'localtime') = ?
GROUP BY date, hour
ORDER BY hour ASC
      `,
      [today],
    );

    return rows.map((r: any) => {
      const dateStr = String(r.date);
      const hour = Number(r.hour);
      const hourStr = String(hour).padStart(2, '0');
      return {
        ...metricsFromRow(r),
        date: dateStr,
        hour,
        dateHour: `${dateStr}:${hourStr}`,
      };
    });
  }

  async getStatsSupplier(): Promise<StatsSupplier[]> {
    const db = this.assertDb();
    const rows = await db.all<any>(
      `
SELECT
  supplier_id as supplierId,
  COALESCE(supplier_name, supplier_id) as supplierName,
  SUM(COALESCE(input_tokens, 0)) as inputTokens,
  SUM(COALESCE(output_tokens, 0)) as outputTokens,
  SUM(COALESCE(input_cost, 0)) as inputCost,
  SUM(COALESCE(output_cost, 0)) as outputCost,
  SUM(COALESCE(wait_time, 0)) as waitTime,
  SUM(COALESCE(duration_ms, 0)) as durationTime,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 1 ELSE 0 END) as requestSuccess,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 0 ELSE 1 END) as requestFailed,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN 1 ELSE 0 END) as ftutCount,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN ftut ELSE 0 END) as ftutSum
FROM requests
WHERE supplier_id IS NOT NULL
GROUP BY supplier_id
      `,
    );

    return rows.map((r: any) => ({
      ...metricsFromRow(r),
      supplierId: String(r.supplierId),
      supplierName: String(r.supplierName),
    }));
  }

  async getStatsModel(limit: number = 20, sortBy: keyof StatsMetrics = 'totalTokens'): Promise<StatsModel[]> {
    const db = this.assertDb();
    const rows = await db.all<any>(
      `
SELECT
  billing_model as model,
  SUM(COALESCE(input_tokens, 0)) as inputTokens,
  SUM(COALESCE(output_tokens, 0)) as outputTokens,
  SUM(COALESCE(input_cost, 0)) as inputCost,
  SUM(COALESCE(output_cost, 0)) as outputCost,
  SUM(COALESCE(wait_time, 0)) as waitTime,
  SUM(COALESCE(duration_ms, 0)) as durationTime,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 1 ELSE 0 END) as requestSuccess,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 0 ELSE 1 END) as requestFailed,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN 1 ELSE 0 END) as ftutCount,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN ftut ELSE 0 END) as ftutSum
FROM requests
WHERE billing_model IS NOT NULL AND billing_model != ''
GROUP BY billing_model
      `,
    );

    const items = rows.map((r: any) => ({
      ...metricsFromRow(r),
      model: String(r.model),
    }));

    items.sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
    return items.slice(0, limit);
  }

  async getStatsRoute(): Promise<StatsRoute[]> {
    const db = this.assertDb();
    const rows = await db.all<any>(
      `
SELECT
  route_id as routeId,
  SUM(COALESCE(input_tokens, 0)) as inputTokens,
  SUM(COALESCE(output_tokens, 0)) as outputTokens,
  SUM(COALESCE(input_cost, 0)) as inputCost,
  SUM(COALESCE(output_cost, 0)) as outputCost,
  SUM(COALESCE(wait_time, 0)) as waitTime,
  SUM(COALESCE(duration_ms, 0)) as durationTime,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 1 ELSE 0 END) as requestSuccess,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 0 ELSE 1 END) as requestFailed,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN 1 ELSE 0 END) as ftutCount,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN ftut ELSE 0 END) as ftutSum
FROM requests
WHERE route_id IS NOT NULL AND route_id != ''
GROUP BY route_id
      `,
    );

    return rows.map((r: any) => ({
      ...metricsFromRow(r),
      routeId: String(r.routeId),
      localService: routeIdToLocalService(String(r.routeId)),
    }));
  }

  async getStatsToday(): Promise<StatsToday> {
    const today = formatDateLocal(Date.now());
    const hourly = await this.getStatsHourly();

    const hourlyMap: Record<number, StatsMetrics> = {};
    for (const h of hourly) {
      hourlyMap[h.hour] = {
        inputTokens: h.inputTokens,
        outputTokens: h.outputTokens,
        totalTokens: h.totalTokens,
        inputCost: h.inputCost,
        outputCost: h.outputCost,
        totalCost: h.totalCost,
        waitTime: h.waitTime,
        durationTime: h.durationTime,
        requestSuccess: h.requestSuccess,
        requestFailed: h.requestFailed,
        requestTotal: h.requestTotal,
        ftutCount: h.ftutCount,
        ftutSum: h.ftutSum,
        ftutAvg: h.ftutAvg,
      };
    }

    const totalMetrics = await this.aggregateMetrics(
      'WHERE date(ts / 1000, \'unixepoch\', \'localtime\') = ?',
      [today],
    );

    return { date: today, hourly: hourlyMap, ...totalMetrics };
  }

  async getStatsDataByRange(options: {
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
    const db = this.assertDb();

    const where: string[] = [];
    const params: unknown[] = [];
    if (options.startTime !== undefined) {
      where.push('ts >= ?');
      params.push(options.startTime);
    }
    if (options.endTime !== undefined) {
      where.push('ts <= ?');
      params.push(options.endTime);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // daily：在 range 内按天聚合
    let dailyRows = await db.all<any>(
      `
SELECT
  date(ts / 1000, 'unixepoch', 'localtime') as date,
  SUM(COALESCE(input_tokens, 0)) as inputTokens,
  SUM(COALESCE(output_tokens, 0)) as outputTokens,
  SUM(COALESCE(input_cost, 0)) as inputCost,
  SUM(COALESCE(output_cost, 0)) as outputCost,
  SUM(COALESCE(wait_time, 0)) as waitTime,
  SUM(COALESCE(duration_ms, 0)) as durationTime,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 1 ELSE 0 END) as requestSuccess,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 0 ELSE 1 END) as requestFailed,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN 1 ELSE 0 END) as ftutCount,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN ftut ELSE 0 END) as ftutSum
FROM requests
${whereSql}
GROUP BY date
ORDER BY date ASC
      `,
      params,
    );

    if (options.limitDays && dailyRows.length > options.limitDays) {
      dailyRows = dailyRows.slice(-options.limitDays);
    }

    const daily: StatsDaily[] = dailyRows.map((r: any) => {
      const dateStr = String(r.date);
      return {
        ...metricsFromRow(r),
        date: dateStr,
        dateKey: dateKeyOfLocal(dateStr),
      };
    });

    // total：基于 daily 的合计（与原实现一致）
    const totalMetrics: StatsMetrics = emptyStatsMetrics();
    for (const d of daily) {
      totalMetrics.inputTokens += d.inputTokens;
      totalMetrics.outputTokens += d.outputTokens;
      totalMetrics.totalTokens = totalMetrics.inputTokens + totalMetrics.outputTokens;
      totalMetrics.inputCost += d.inputCost;
      totalMetrics.outputCost += d.outputCost;
      totalMetrics.totalCost = totalMetrics.inputCost + totalMetrics.outputCost;
      totalMetrics.waitTime += d.waitTime;
      totalMetrics.durationTime += d.durationTime;
      totalMetrics.requestSuccess += d.requestSuccess;
      totalMetrics.requestFailed += d.requestFailed;
      totalMetrics.requestTotal = totalMetrics.requestSuccess + totalMetrics.requestFailed;
      if (d.ftutCount > 0) {
        totalMetrics.ftutCount += d.ftutCount;
        totalMetrics.ftutSum += d.ftutSum;
        totalMetrics.ftutAvg = totalMetrics.ftutSum / totalMetrics.ftutCount;
      }
    }
    const total: StatsTotal = { ...totalMetrics, updatedAt: Date.now() };

    // supplier/model/route：在 range 内聚合（更精确）
    const supplier = await this.getStatsSupplierByWhere(whereSql, params);
    const model = await this.getStatsModelByWhere(whereSql, params);
    const route = await this.getStatsRouteByWhere(whereSql, params);

    return { total, daily, supplier, model, route };
  }

  private async getStatsSupplierByWhere(whereSql: string, params: unknown[]): Promise<StatsSupplier[]> {
    const db = this.assertDb();
    const rows = await db.all<any>(
      `
SELECT
  supplier_id as supplierId,
  COALESCE(supplier_name, supplier_id) as supplierName,
  SUM(COALESCE(input_tokens, 0)) as inputTokens,
  SUM(COALESCE(output_tokens, 0)) as outputTokens,
  SUM(COALESCE(input_cost, 0)) as inputCost,
  SUM(COALESCE(output_cost, 0)) as outputCost,
  SUM(COALESCE(wait_time, 0)) as waitTime,
  SUM(COALESCE(duration_ms, 0)) as durationTime,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 1 ELSE 0 END) as requestSuccess,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 0 ELSE 1 END) as requestFailed,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN 1 ELSE 0 END) as ftutCount,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN ftut ELSE 0 END) as ftutSum
FROM requests
${whereSql ? `${whereSql} AND supplier_id IS NOT NULL` : 'WHERE supplier_id IS NOT NULL'}
GROUP BY supplier_id
      `,
      params,
    );
    return rows.map((r: any) => ({ ...metricsFromRow(r), supplierId: String(r.supplierId), supplierName: String(r.supplierName) }));
  }

  private async getStatsModelByWhere(whereSql: string, params: unknown[]): Promise<StatsModel[]> {
    const db = this.assertDb();
    const rows = await db.all<any>(
      `
SELECT
  billing_model as model,
  SUM(COALESCE(input_tokens, 0)) as inputTokens,
  SUM(COALESCE(output_tokens, 0)) as outputTokens,
  SUM(COALESCE(input_cost, 0)) as inputCost,
  SUM(COALESCE(output_cost, 0)) as outputCost,
  SUM(COALESCE(wait_time, 0)) as waitTime,
  SUM(COALESCE(duration_ms, 0)) as durationTime,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 1 ELSE 0 END) as requestSuccess,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 0 ELSE 1 END) as requestFailed,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN 1 ELSE 0 END) as ftutCount,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN ftut ELSE 0 END) as ftutSum
FROM requests
${whereSql ? `${whereSql} AND billing_model IS NOT NULL AND billing_model != ''` : `WHERE billing_model IS NOT NULL AND billing_model != ''`}
GROUP BY billing_model
      `,
      params,
    );
    return rows.map((r: any) => ({ ...metricsFromRow(r), model: String(r.model) }));
  }

  private async getStatsRouteByWhere(whereSql: string, params: unknown[]): Promise<StatsRoute[]> {
    const db = this.assertDb();
    const rows = await db.all<any>(
      `
SELECT
  route_id as routeId,
  SUM(COALESCE(input_tokens, 0)) as inputTokens,
  SUM(COALESCE(output_tokens, 0)) as outputTokens,
  SUM(COALESCE(input_cost, 0)) as inputCost,
  SUM(COALESCE(output_cost, 0)) as outputCost,
  SUM(COALESCE(wait_time, 0)) as waitTime,
  SUM(COALESCE(duration_ms, 0)) as durationTime,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 1 ELSE 0 END) as requestSuccess,
  SUM(CASE WHEN response_status >= 200 AND response_status < 400 THEN 0 ELSE 1 END) as requestFailed,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN 1 ELSE 0 END) as ftutCount,
  SUM(CASE WHEN ftut IS NOT NULL AND ftut > 0 THEN ftut ELSE 0 END) as ftutSum
FROM requests
${whereSql ? `${whereSql} AND route_id IS NOT NULL AND route_id != ''` : `WHERE route_id IS NOT NULL AND route_id != ''`}
GROUP BY route_id
      `,
      params,
    );
    return rows.map((r: any) => ({
      ...metricsFromRow(r),
      routeId: String(r.routeId),
      localService: routeIdToLocalService(String(r.routeId)),
    }));
  }
}
