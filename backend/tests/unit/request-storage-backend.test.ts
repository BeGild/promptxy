import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { mkdir, rm, access } from 'node:fs/promises';

import { initializeDatabase, resetDatabaseForTest } from '../../src/promptxy/database.js';

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
});

