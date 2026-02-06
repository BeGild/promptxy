import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { mkdir, rm, access } from 'node:fs/promises';

import { initializeDatabase, resetDatabaseForTest } from '../../src/promptxy/database.js';
import type { RequestRecord } from '../../src/promptxy/types.js';

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

describe('request storage (backend)', () => {
  const testHome = path.join(os.tmpdir(), `promptxy-storage-unit-${process.pid}`);

  beforeEach(async () => {
    await rm(testHome, { recursive: true, force: true }).catch(() => {});
    await mkdir(testHome, { recursive: true });
    process.env.HOME = testHome;
    process.env.XDG_DATA_HOME = testHome;
    await resetDatabaseForTest();
  });

  afterEach(async () => {
    await resetDatabaseForTest();
    await rm(testHome, { recursive: true, force: true }).catch(() => {});
  });

  it('initializeDatabase 应创建 SQLite 数据库文件，并且不创建 YAML requests/ 目录', async () => {
    await initializeDatabase(true);

    const dataDir = path.join(testHome, '.local', 'promptxy');
    const dbPath = path.join(dataDir, 'promptxy.db');
    const requestsDir = path.join(dataDir, 'requests');

    expect(await pathExists(dbPath)).toBe(true);
    expect(await pathExists(requestsDir)).toBe(false);
  });

  it('应写入并读取 routeNameSnapshot/pricingStatus/pricingSnapshot 字段', async () => {
    const storage = await initializeDatabase(true);

    const record: RequestRecord = {
      id: 'req-storage-fields-1',
      timestamp: Date.now(),
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: '{}',
      modifiedBody: '{}',
      matchedRules: '[]',
      routeId: 'route-claude-default',
      routeNameSnapshot: 'Claude 默认路由',
      responseStatus: 200,
      pricingStatus: 'calculated',
      pricingSnapshot: JSON.stringify({ ruleId: 'rule-private-001' }),
    };

    await storage.insert(record);

    const detail = await storage.getDetail(record.id);
    expect(detail).not.toBeNull();
    expect(detail?.routeNameSnapshot).toBe('Claude 默认路由');
    expect(detail?.pricingStatus).toBe('calculated');
    expect(detail?.pricingSnapshot).toContain('rule-private-001');

    const list = await storage.query({ limit: 10, offset: 0 });
    const item = list.items.find(it => it.id === record.id);
    expect(item?.routeNameSnapshot).toBe('Claude 默认路由');
    expect(item?.pricingStatus).toBe('calculated');
    expect(item?.pricingSnapshot).toContain('rule-private-001');
  });
});
