import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { loadConfig, saveConfig, getConfigDir } from '../../src/promptxy/config.js';
import type { PromptxyConfig, Supplier } from '../../src/promptxy/types.js';
import { writeFile, mkdir, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TEST_ROOT = path.join(os.tmpdir(), `promptxy-config-test-${process.pid}`);
const TEST_CONFIG_PATH = path.join(TEST_ROOT, 'config.json');

const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_XDG_DATA_HOME = process.env.XDG_DATA_HOME;
const ORIGINAL_PROMPTXY_CONFIG = process.env.PROMPTXY_CONFIG;

async function resetEnvAndFs() {
  await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});

  process.env.HOME = TEST_ROOT;
  delete process.env.XDG_DATA_HOME;
  delete process.env.PROMPTXY_CONFIG;
  delete process.env.PROMPTXY_HOST;
  delete process.env.PROMPTXY_PORT;
  delete process.env.PROMPTXY_DEBUG;
  delete process.env.PROMPTXY_MAX_HISTORY;
}

describe('Config Module', () => {
  beforeAll(async () => {
    await resetEnvAndFs();
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});

    if (ORIGINAL_HOME !== undefined) process.env.HOME = ORIGINAL_HOME;
    else delete process.env.HOME;

    if (ORIGINAL_XDG_DATA_HOME !== undefined) process.env.XDG_DATA_HOME = ORIGINAL_XDG_DATA_HOME;
    else delete process.env.XDG_DATA_HOME;

    if (ORIGINAL_PROMPTXY_CONFIG !== undefined) process.env.PROMPTXY_CONFIG = ORIGINAL_PROMPTXY_CONFIG;
    else delete process.env.PROMPTXY_CONFIG;
  });

  beforeEach(async () => {
    await resetEnvAndFs();
  });

  it('应在无配置文件时加载默认配置（并允许通过 cliOptions 固定端口）', async () => {
    const config = await loadConfig({ port: 7070 });

    expect(config.listen.host).toBe('127.0.0.1');
    expect(config.listen.port).toBe(7070);

    expect(config.suppliers).toHaveLength(3);
    expect(config.routes).toHaveLength(3);

    // 默认路由应为三条入口各一条 enabled
    const enabledRoutes = config.routes.filter(r => r.enabled);
    expect(enabledRoutes).toHaveLength(3);

    expect(config.storage.maxHistory).toBeGreaterThan(0);
    expect(config.debug).toBe(false);
  });

  it('应从 PROMPTXY_CONFIG 指定路径加载并合并默认值', async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

    await writeFile(
      TEST_CONFIG_PATH,
      JSON.stringify(
        {
          listen: { host: '0.0.0.0', port: 8080 },
          debug: true,
        },
        null,
        2,
      ),
      'utf-8',
    );

    const config = await loadConfig();
    expect(config.listen.host).toBe('0.0.0.0');
    expect(config.listen.port).toBe(8080);
    expect(config.debug).toBe(true);

    // 未显式提供时应使用默认 suppliers/routes
    expect(config.suppliers).toHaveLength(3);
    expect(config.routes).toHaveLength(3);
  });

  it('应应用环境变量覆盖（host/port/debug/maxHistory）', async () => {
    process.env.PROMPTXY_HOST = '192.168.1.1';
    process.env.PROMPTXY_PORT = '9999';
    process.env.PROMPTXY_DEBUG = 'true';
    process.env.PROMPTXY_MAX_HISTORY = '500';

    const config = await loadConfig();
    expect(config.listen.host).toBe('192.168.1.1');
    expect(config.listen.port).toBe(9999);
    expect(config.debug).toBe(true);
    expect(config.storage.maxHistory).toBe(500);
  });

  it('应拒绝非法 listen.port', async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;
    await writeFile(TEST_CONFIG_PATH, JSON.stringify({ listen: { host: '127.0.0.1', port: 99999 } }));

    await expect(loadConfig()).rejects.toThrow('config.listen.port must be an integer in [1, 65535]');
  });

  it('应拒绝非法 supplier.baseUrl', async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

    const suppliers: Supplier[] = [
      {
        id: 's1',
        name: 's1',
        displayName: 's1',
        baseUrl: 'not-a-url',
        protocol: 'anthropic',
        enabled: true,
        auth: { type: 'none' },
        supportedModels: [],
      },
    ];

    await writeFile(
      TEST_CONFIG_PATH,
      JSON.stringify(
        {
          listen: { host: '127.0.0.1', port: 7070 },
          suppliers,
          routes: [],
          rules: [],
          storage: { maxHistory: 100 },
          debug: false,
        },
        null,
        2,
      ),
      'utf-8',
    );

    await expect(loadConfig()).rejects.toThrow('config.suppliers[0].baseUrl must be a valid URL');
  });

  it('应拒绝空 suppliers 数组', async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;
    await writeFile(
      TEST_CONFIG_PATH,
      JSON.stringify({ listen: { host: '127.0.0.1', port: 7070 }, suppliers: [] }, null, 2),
      'utf-8',
    );

    await expect(loadConfig()).rejects.toThrow('config.suppliers must contain at least one supplier');
  });

  it('应拒绝非法 routes 结构', async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;
    await writeFile(
      TEST_CONFIG_PATH,
      JSON.stringify({ listen: { host: '127.0.0.1', port: 7070 }, routes: 'oops' }, null, 2),
      'utf-8',
    );

    await expect(loadConfig()).rejects.toThrow('config.routes must be an array');
  });

  it('应保存配置到 PROMPTXY_CONFIG 指定路径', async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

    const config = await loadConfig({ port: 7070 });
    await saveConfig(config as PromptxyConfig);

    await access(TEST_CONFIG_PATH);
  });

  it('getConfigDir 应返回 PROMPTXY_CONFIG 所在目录', () => {
    process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;
    expect(getConfigDir()).toBe(TEST_ROOT);
  });
});
