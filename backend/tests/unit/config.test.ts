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

    expect(config.suppliers).toHaveLength(4);
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
    expect(config.suppliers).toHaveLength(4);
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

  it('应支持 supplier.modelPricingMappings 合法配置', async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

    await writeFile(
      TEST_CONFIG_PATH,
      JSON.stringify(
        {
          listen: { host: '127.0.0.1', port: 7070 },
          suppliers: [
            {
              id: 's1',
              name: 's1',
              displayName: 'S1',
              baseUrl: 'https://api.example.com',
              protocol: 'anthropic',
              enabled: true,
              auth: { type: 'none' },
              supportedModels: [],
              modelPricingMappings: [
                {
                  modelName: 'gpt-5-mini',
                  billingModel: 'gpt-5-mini',
                  priceMode: 'inherit',
                },
              ],
            },
          ],
          routes: [
            {
              id: 'route-claude-default',
              localService: 'claude',
              modelMappings: [
                {
                  id: 'mapping-default',
                  inboundModel: '*',
                  targetSupplierId: 's1',
                  enabled: true,
                },
              ],
              enabled: true,
            },
          ],
          rules: [],
          storage: { maxHistory: 100 },
          debug: false,
        },
        null,
        2,
      ),
      'utf-8',
    );

    const config = await loadConfig();
    expect(config.suppliers[0].modelPricingMappings?.[0].billingModel).toBe('gpt-5-mini');
  });

  it('应拒绝 modelPricingMappings 中重复 modelName', async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

    await writeFile(
      TEST_CONFIG_PATH,
      JSON.stringify(
        {
          listen: { host: '127.0.0.1', port: 7070 },
          suppliers: [
            {
              id: 's1',
              name: 's1',
              displayName: 'S1',
              baseUrl: 'https://api.example.com',
              protocol: 'anthropic',
              enabled: true,
              auth: { type: 'none' },
              supportedModels: [],
              modelPricingMappings: [
                {
                  modelName: 'm1',
                  billingModel: 'bm1',
                  priceMode: 'inherit',
                },
                {
                  modelName: 'm1',
                  billingModel: 'bm2',
                  priceMode: 'inherit',
                },
              ],
            },
          ],
          routes: [
            {
              id: 'route-claude-default',
              localService: 'claude',
              modelMappings: [
                {
                  id: 'mapping-default',
                  inboundModel: '*',
                  targetSupplierId: 's1',
                  enabled: true,
                },
              ],
              enabled: true,
            },
          ],
          rules: [],
          storage: { maxHistory: 100 },
          debug: false,
        },
        null,
        2,
      ),
      'utf-8',
    );

    await expect(loadConfig()).rejects.toThrow(/modelPricingMappings has duplicate modelName: m1/);
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

  describe('Routes 配置收敛（破坏性升级）', () => {
    it('应拒绝 claude route 中的 legacy 字段 modelMapping', async () => {
      await mkdir(TEST_ROOT, { recursive: true });
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const routes = [
        {
          id: 'route-claude-legacy',
          localService: 'claude',
          // 使用旧格式 modelMapping（单个对象而非数组）
          modelMapping: {
            rules: [
              {
                inboundModel: '*',
                targetSupplierId: 'claude-anthropic',
                outboundModel: undefined,
              },
            ],
          },
          enabled: true,
        },
      ];

      await writeFile(
        TEST_CONFIG_PATH,
        JSON.stringify(
          {
            listen: { host: '127.0.0.1', port: 7070 },
            suppliers: [
              {
                id: 'claude-anthropic',
                name: 'claude-anthropic',
                displayName: 'Claude (Anthropic)',
                baseUrl: 'https://api.anthropic.com',
                protocol: 'anthropic',
                enabled: true,
                auth: { type: 'none' },
                supportedModels: [],
              },
            ],
            routes,
            rules: [],
            storage: { maxHistory: 100 },
            debug: false,
          },
          null,
          2,
        ),
        'utf-8',
      );

      await expect(loadConfig()).rejects.toThrow(/config\.routes\[0\].*modelMapping/);
    });

    it('应拒绝 claude route 中的 legacy 字段 supplierId', async () => {
      await mkdir(TEST_ROOT, { recursive: true });
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const routes = [
        {
          id: 'route-claude-legacy',
          localService: 'claude',
          supplierId: 'claude-anthropic', // 旧字段
          enabled: true,
        },
      ];

      await writeFile(
        TEST_CONFIG_PATH,
        JSON.stringify(
          {
            listen: { host: '127.0.0.1', port: 7070 },
            suppliers: [
              {
                id: 'claude-anthropic',
                name: 'claude-anthropic',
                displayName: 'Claude (Anthropic)',
                baseUrl: 'https://api.anthropic.com',
                protocol: 'anthropic',
                enabled: true,
                auth: { type: 'none' },
                supportedModels: [],
              },
            ],
            routes,
            rules: [],
            storage: { maxHistory: 100 },
            debug: false,
          },
          null,
          2,
        ),
        'utf-8',
      );

      await expect(loadConfig()).rejects.toThrow(/config\.routes\[0\].*supplierId/);
    });

    it('应拒绝 claude route 中的 legacy 字段 defaultSupplierId', async () => {
      await mkdir(TEST_ROOT, { recursive: true });
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const routes = [
        {
          id: 'route-claude-legacy',
          localService: 'claude',
          defaultSupplierId: 'claude-anthropic', // 旧字段
          enabled: true,
        },
      ];

      await writeFile(
        TEST_CONFIG_PATH,
        JSON.stringify(
          {
            listen: { host: '127.0.0.1', port: 7070 },
            suppliers: [
              {
                id: 'claude-anthropic',
                name: 'claude-anthropic',
                displayName: 'Claude (Anthropic)',
                baseUrl: 'https://api.anthropic.com',
                protocol: 'anthropic',
                enabled: true,
                auth: { type: 'none' },
                supportedModels: [],
              },
            ],
            routes,
            rules: [],
            storage: { maxHistory: 100 },
            debug: false,
          },
          null,
          2,
        ),
        'utf-8',
      );

      await expect(loadConfig()).rejects.toThrow(/config\.routes\[0\].*defaultSupplierId/);
    });

    it('应拒绝 claude route 中的 legacy 字段 transformer', async () => {
      await mkdir(TEST_ROOT, { recursive: true });
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const routes = [
        {
          id: 'route-claude-legacy',
          localService: 'claude',
          modelMappings: [
            {
              id: 'mapping-default',
              inboundModel: '*',
              targetSupplierId: 'claude-anthropic',
              outboundModel: undefined,
              enabled: true,
            },
          ],
          transformer: 'claude-to-openai-chat', // 旧字段
          enabled: true,
        },
      ];

      await writeFile(
        TEST_CONFIG_PATH,
        JSON.stringify(
          {
            listen: { host: '127.0.0.1', port: 7070 },
            suppliers: [
              {
                id: 'claude-anthropic',
                name: 'claude-anthropic',
                displayName: 'Claude (Anthropic)',
                baseUrl: 'https://api.anthropic.com',
                protocol: 'anthropic',
                enabled: true,
                auth: { type: 'none' },
                supportedModels: [],
              },
            ],
            routes,
            rules: [],
            storage: { maxHistory: 100 },
            debug: false,
          },
          null,
          2,
        ),
        'utf-8',
      );

      await expect(loadConfig()).rejects.toThrow(/config\.routes\[0\].*transformer/);
    });

    it('应拒绝 codex route 中的 modelMappings（只允许 singleSupplierId）', async () => {
      await mkdir(TEST_ROOT, { recursive: true });
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const routes = [
        {
          id: 'route-codex-invalid',
          localService: 'codex',
          // codex 不应该有 modelMappings
          modelMappings: [
            {
              id: 'mapping-default',
              inboundModel: '*',
              targetSupplierId: 'openai-codex-official',
              outboundModel: undefined,
              enabled: true,
            },
          ],
          enabled: true,
        },
      ];

      await writeFile(
        TEST_CONFIG_PATH,
        JSON.stringify(
          {
            listen: { host: '127.0.0.1', port: 7070 },
            suppliers: [
              {
                id: 'openai-codex-official',
                name: 'openai-codex-official',
                displayName: 'OpenaiCodex',
                baseUrl: 'https://api.openai.com/v1',
                protocol: 'openai-codex',
                enabled: true,
                auth: { type: 'none' },
                supportedModels: [],
              },
            ],
            routes,
            rules: [],
            storage: { maxHistory: 100 },
            debug: false,
          },
          null,
          2,
        ),
        'utf-8',
      );

      await expect(loadConfig()).rejects.toThrow(/config\.routes\[0\].*modelMappings.*codex.*singleSupplierId/);
    });

    it('应拒绝 gemini route 中的 modelMappings（只允许 singleSupplierId）', async () => {
      await mkdir(TEST_ROOT, { recursive: true });
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const routes = [
        {
          id: 'route-gemini-invalid',
          localService: 'gemini',
          // gemini 不应该有 modelMappings
          modelMappings: [
            {
              id: 'mapping-default',
              inboundModel: '*',
              targetSupplierId: 'gemini-google',
              outboundModel: undefined,
              enabled: true,
            },
          ],
          enabled: true,
        },
      ];

      await writeFile(
        TEST_CONFIG_PATH,
        JSON.stringify(
          {
            listen: { host: '127.0.0.1', port: 7070 },
            suppliers: [
              {
                id: 'gemini-google',
                name: 'gemini-google',
                displayName: 'Gemini (Google)',
                baseUrl: 'https://generativelanguage.googleapis.com',
                protocol: 'gemini',
                enabled: true,
                auth: { type: 'none' },
                supportedModels: [],
              },
            ],
            routes,
            rules: [],
            storage: { maxHistory: 100 },
            debug: false,
          },
          null,
          2,
        ),
        'utf-8',
      );

      await expect(loadConfig()).rejects.toThrow(/config\.routes\[0\].*modelMappings.*gemini.*singleSupplierId/);
    });

    it('应拒绝 codex route 缺少 singleSupplierId', async () => {
      await mkdir(TEST_ROOT, { recursive: true });
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const routes = [
        {
          id: 'route-codex-missing-supplier',
          localService: 'codex',
          // 缺少 singleSupplierId
          enabled: true,
        },
      ];

      await writeFile(
        TEST_CONFIG_PATH,
        JSON.stringify(
          {
            listen: { host: '127.0.0.1', port: 7070 },
            suppliers: [
              {
                id: 'openai-codex-official',
                name: 'openai-codex-official',
                displayName: 'OpenaiCodex',
                baseUrl: 'https://api.openai.com/v1',
                protocol: 'openai-codex',
                enabled: true,
                auth: { type: 'none' },
                supportedModels: [],
              },
            ],
            routes,
            rules: [],
            storage: { maxHistory: 100 },
            debug: false,
          },
          null,
          2,
        ),
        'utf-8',
      );

      await expect(loadConfig()).rejects.toThrow(/config\.routes\[0\]\.singleSupplierId.*non-empty string/);
    });

    it('应拒绝 gemini route 缺少 singleSupplierId', async () => {
      await mkdir(TEST_ROOT, { recursive: true });
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const routes = [
        {
          id: 'route-gemini-missing-supplier',
          localService: 'gemini',
          // 缺少 singleSupplierId
          enabled: true,
        },
      ];

      await writeFile(
        TEST_CONFIG_PATH,
        JSON.stringify(
          {
            listen: { host: '127.0.0.1', port: 7070 },
            suppliers: [
              {
                id: 'gemini-google',
                name: 'gemini-google',
                displayName: 'Gemini (Google)',
                baseUrl: 'https://generativelanguage.googleapis.com',
                protocol: 'gemini',
                enabled: true,
                auth: { type: 'none' },
                supportedModels: [],
              },
            ],
            routes,
            rules: [],
            storage: { maxHistory: 100 },
            debug: false,
          },
          null,
          2,
        ),
        'utf-8',
      );

      await expect(loadConfig()).rejects.toThrow(/config\.routes\[0\]\.singleSupplierId.*non-empty string/);
    });

    it('应拒绝 claude route 使用 singleSupplierId（应使用 modelMappings）', async () => {
      await mkdir(TEST_ROOT, { recursive: true });
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const routes = [
        {
          id: 'route-claude-invalid',
          localService: 'claude',
          // claude 不应该有 singleSupplierId
          singleSupplierId: 'claude-anthropic',
          enabled: true,
        },
      ];

      await writeFile(
        TEST_CONFIG_PATH,
        JSON.stringify(
          {
            listen: { host: '127.0.0.1', port: 7070 },
            suppliers: [
              {
                id: 'claude-anthropic',
                name: 'claude-anthropic',
                displayName: 'Claude (Anthropic)',
                baseUrl: 'https://api.anthropic.com',
                protocol: 'anthropic',
                enabled: true,
                auth: { type: 'none' },
                supportedModels: [],
              },
            ],
            routes,
            rules: [],
            storage: { maxHistory: 100 },
            debug: false,
          },
          null,
          2,
        ),
        'utf-8',
      );

      await expect(loadConfig()).rejects.toThrow(/config\.routes\[0\].*singleSupplierId.*claude.*modelMappings/);
    });
  });
});
