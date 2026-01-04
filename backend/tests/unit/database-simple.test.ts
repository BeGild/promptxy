import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TEST_RUN_ID =
  process.env.VITEST_WORKER_ID !== undefined
    ? `worker-${process.env.VITEST_WORKER_ID}`
    : `pid-${process.pid}`;
const TEST_HOME = path.join(os.tmpdir(), `promptxy-db-test-${TEST_RUN_ID}`);

const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_XDG_DATA_HOME = process.env.XDG_DATA_HOME;

async function cleanup() {
  await rm(TEST_HOME, { recursive: true, force: true }).catch(() => {});
}

describe('Database Module - FileSystemStorage', () => {
  beforeEach(async () => {
    await cleanup();
    await mkdir(TEST_HOME, { recursive: true });

    // 让数据库写入到测试目录而不是用户真实目录
    process.env.HOME = TEST_HOME;
    process.env.XDG_DATA_HOME = TEST_HOME;

    const { resetDatabaseForTest } = await import('../../src/promptxy/database.js');
    await resetDatabaseForTest();
  });

  afterEach(async () => {
    const { resetDatabaseForTest } = await import('../../src/promptxy/database.js');
    await resetDatabaseForTest();
    await cleanup();

    if (ORIGINAL_HOME !== undefined) process.env.HOME = ORIGINAL_HOME;
    else delete process.env.HOME;

    if (ORIGINAL_XDG_DATA_HOME !== undefined) process.env.XDG_DATA_HOME = ORIGINAL_XDG_DATA_HOME;
    else delete process.env.XDG_DATA_HOME;
  });

  it('应初始化数据库并可插入/读取请求记录', async () => {
    const { initializeDatabase, insertRequestRecord, getRequestDetail } =
      await import('../../src/promptxy/database.js');

    await initializeDatabase(true);

    const id = `test-${Date.now()}`;
    await insertRequestRecord({
      id,
      timestamp: Date.now(),
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: JSON.stringify({ system: 'original' }),
      modifiedBody: JSON.stringify({ system: 'modified' }),
      matchedRules: JSON.stringify([{ ruleId: 'rule-1', opType: 'set' }]),
      responseStatus: 200,
      durationMs: 123,
      routeId: 'route-claude-default',
      supplierId: 'claude-anthropic',
      supplierName: 'claude-anthropic',
      supplierBaseUrl: 'https://api.anthropic.com',
      transformerChain: JSON.stringify([]),
    });

    const detail = await getRequestDetail(id);
    expect(detail).toBeTruthy();
    expect(detail!.id).toBe(id);
    expect(detail!.supplierId).toBe('claude-anthropic');
  });
});

