import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// 测试数据库路径 - 使用临时目录避免冲突
const TEST_RUN_ID =
  process.env.VITEST_WORKER_ID !== undefined
    ? `worker-${process.env.VITEST_WORKER_ID}`
    : `pid-${process.pid}`;
const TEST_DB_DIR = path.join(os.tmpdir(), `promptxy-test-${TEST_RUN_ID}`);
const TEST_CONFIG_PATH = path.join(TEST_DB_DIR, 'config.json');

describe('Database Module - Simplified', () => {
  async function cleanup() {
    try {
      await rm(TEST_DB_DIR, { recursive: true, force: true });
    } catch {}
    delete process.env.PROMPTXY_CONFIG;
  }

  beforeAll(async () => {
    await cleanup();
    await mkdir(TEST_DB_DIR, { recursive: true });
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    // 设置环境变量指向测试配置和数据库目录
    const testConfig = {
      listen: { host: '127.0.0.1', port: 7070 },
      api: { host: '127.0.0.1', port: 7071 },
      suppliers: [
        {
          id: 'test-supplier',
          name: 'Test Supplier',
          baseUrl: 'https://api.test.com',
          localPrefix: '/test',
          pathMappings: [],
          enabled: true,
        },
      ],
      rules: [],
      storage: { maxHistory: 100, autoCleanup: true, cleanupInterval: 1 },
      debug: false,
    };
    await writeFile(TEST_CONFIG_PATH, JSON.stringify(testConfig));
    process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

    // 设置数据库路径环境变量，使用测试目录（在整个测试期间保持）
    process.env.HOME = TEST_DB_DIR;
    process.env.XDG_DATA_HOME = TEST_DB_DIR;

    // 清理测试数据库文件目录
    try {
      const dbDir = path.join(TEST_DB_DIR, 'promptxy');
      await rm(dbDir, { recursive: true, force: true });
    } catch {}

    // 重置数据库实例
    const { resetDatabaseForTest } = await import('../../src/promptxy/database.js');
    await resetDatabaseForTest();
  });

  afterEach(async () => {
    // 重置数据库实例（在删除文件之前，确保文件被释放）
    const { resetDatabaseForTest } = await import('../../src/promptxy/database.js');
    await resetDatabaseForTest();

    // 清理整个测试数据库目录
    try {
      await rm(path.join(TEST_DB_DIR, 'promptxy'), { recursive: true, force: true });
    } catch {}

    // 恢复环境变量
    delete process.env.PROMPTXY_CONFIG;
    delete process.env.HOME;
    delete process.env.XDG_DATA_HOME;
  });

  it('should initialize database successfully', async () => {
    const { initializeDatabase, getDatabase } =
      await import('../../src/promptxy/database.js');
    const db = await initializeDatabase();
    expect(db).toBeDefined();

    // 验证表已创建
    const tables = db.exec(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('requests', 'settings')
    `);
    expect(tables.length).toBeGreaterThan(0);
  });

  it('should insert and retrieve request record', async () => {
    const { initializeDatabase, insertRequestRecord, getRequestDetail } =
      await import('../../src/promptxy/database.js');

    const record = {
      id: 'test-simple-' + Date.now(),
      timestamp: Date.now(),
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: JSON.stringify({ system: 'original' }),
      modifiedBody: JSON.stringify({ system: 'modified' }),
      matchedRules: JSON.stringify([{ ruleId: 'rule-1', opType: 'set' }]),
      responseStatus: 200,
      durationMs: 100,
    };

    await initializeDatabase();
    await insertRequestRecord(record);
    const detail = await getRequestDetail(record.id);

    expect(detail).toBeDefined();
    expect(detail?.id).toBe(record.id);
    expect(detail?.client).toBe('claude');
  });

  it('should get request list with filtering', async () => {
    const { initializeDatabase, insertRequestRecord, getRequestList } =
      await import('../../src/promptxy/database.js');

    // 使用唯一ID避免冲突
    const baseTime = Date.now();
    const uniquePrefix = 'filter-' + baseTime;

    await initializeDatabase();

    // 插入测试数据
    for (let i = 0; i < 5; i++) {
      await insertRequestRecord({
        id: `${uniquePrefix}-${i}`,
        timestamp: baseTime + i,
        client: i % 2 === 0 ? 'claude' : 'codex',
        path: '/test',
        method: 'POST',
        originalBody: '{}',
        modifiedBody: '{}',
        matchedRules: '[]',
      });
    }

    // 测试默认列表
    const allList = await getRequestList({});
    // 只统计当前测试的数据
    const testItems = allList.items.filter(item => item.id.startsWith(uniquePrefix));
    expect(testItems.length).toBe(5);

    // 测试客户端过滤
    const claudeList = await getRequestList({ client: 'claude' });
    const claudeTestItems = claudeList.items.filter(item => item.id.startsWith(uniquePrefix));
    expect(claudeTestItems.length).toBe(3);
    expect(claudeTestItems.every(item => item.client === 'claude')).toBe(true);
  });

  it('should cleanup old requests', async () => {
    const {
      initializeDatabase,
      insertRequestRecord,
      cleanupOldRequests,
      getRequestList,
    } = await import('../../src/promptxy/database.js');

    const baseTime = Date.now();
    const uniquePrefix = 'cleanup-' + baseTime;

    await initializeDatabase();

    // 插入 10 条记录
    for (let i = 0; i < 10; i++) {
      await insertRequestRecord({
        id: `${uniquePrefix}-${i}`,
        timestamp: baseTime + i,
        client: 'claude',
        path: '/test',
        method: 'POST',
        originalBody: '{}',
        modifiedBody: '{}',
        matchedRules: '[]',
      });
    }

    // 清理，只保留 3 条
    const deleted = await cleanupOldRequests(3);
    expect(deleted).toBe(7);

    // 验证剩余记录 - 只检查当前测试的数据
    const list = await getRequestList({});
    const testItems = list.items.filter(item => item.id.startsWith(uniquePrefix));
    expect(testItems.length).toBe(3);
  });

  it('should get statistics', async () => {
    const { initializeDatabase, insertRequestRecord, getRequestStats } =
      await import('../../src/promptxy/database.js');

    const uniquePrefix = 'stats-' + Date.now();

    await initializeDatabase();

    // 插入不同客户端的记录
    await insertRequestRecord({
      id: uniquePrefix + '-claude-1',
      timestamp: Date.now(),
      client: 'claude',
      path: '/test',
      method: 'POST',
      originalBody: '{}',
      modifiedBody: '{}',
      matchedRules: '[]',
    });

    await insertRequestRecord({
      id: uniquePrefix + '-codex-1',
      timestamp: Date.now(),
      client: 'codex',
      path: '/test',
      method: 'POST',
      originalBody: '{}',
      modifiedBody: '{}',
      matchedRules: '[]',
    });

    const stats = await getRequestStats();
    // 验证至少包含我们插入的数据
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.byClient.claude).toBeGreaterThanOrEqual(1);
    expect(stats.byClient.codex).toBeGreaterThanOrEqual(1);
  });

  it('should delete request', async () => {
    const {
      initializeDatabase,
      insertRequestRecord,
      deleteRequest,
      getRequestDetail,
    } = await import('../../src/promptxy/database.js');

    const uniqueId = 'delete-test-' + Date.now();
    const record = {
      id: uniqueId,
      timestamp: Date.now(),
      client: 'claude',
      path: '/test',
      method: 'POST',
      originalBody: '{}',
      modifiedBody: '{}',
      matchedRules: '[]',
    };

    await initializeDatabase();
    await insertRequestRecord(record);

    // 验证存在
    let detail = await getRequestDetail(uniqueId);
    expect(detail).toBeDefined();

    // 删除
    const deleted = await deleteRequest(uniqueId);
    expect(deleted).toBe(true);

    // 验证已删除
    detail = await getRequestDetail(uniqueId);
    expect(detail).toBeNull();
  });
});
