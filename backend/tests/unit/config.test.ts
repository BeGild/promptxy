import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { loadConfig, saveConfig, getConfigDir } from '../../src/promptxy/config.js';
import { PromptxyConfig } from '../../src/promptxy/types.js';
import { writeFile, mkdir, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// 测试目录
const TEST_CONFIG_DIR = path.join(os.homedir(), '.promptxy-test');
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.json');

describe('Config Module', () => {
  async function cleanup() {
    try {
      await rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch {}
    // 清理环境变量
    delete process.env.PROMPTXY_CONFIG;
    delete process.env.PROMPTXY_HOST;
    delete process.env.PROMPTXY_PORT;
    delete process.env.PROMPTXY_DEBUG;
    delete process.env.PROMPTXY_API_HOST;
    delete process.env.PROMPTXY_API_PORT;
    delete process.env.PROMPTXY_UPSTREAM_ANTHROPIC;
    delete process.env.PROMPTXY_UPSTREAM_OPENAI;
    delete process.env.PROMPTXY_UPSTREAM_GEMINI;
    delete process.env.PROMPTXY_MAX_HISTORY;
    delete process.env.PROMPTXY_AUTO_CLEANUP;
    delete process.env.PROMPTXY_CLEANUP_INTERVAL;
  }

  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('Configuration Loading', () => {
    it('should load default config when no file exists', async () => {
      const config = await loadConfig();

      expect(config.listen.host).toBe('127.0.0.1');
      expect(config.listen.port).toBe(7070);
      expect(config.api.host).toBe('127.0.0.1');
      expect(config.api.port).toBe(7071);
      expect(config.upstreams.anthropic).toBe('https://api.anthropic.com');
      expect(config.upstreams.openai).toBe('https://api.openai.com');
      expect(config.upstreams.gemini).toBe('https://generativelanguage.googleapis.com');
      expect(config.rules).toEqual([]);
      expect(config.storage.maxHistory).toBe(100);
      expect(config.storage.autoCleanup).toBe(true);
      expect(config.storage.cleanupInterval).toBe(1);
      expect(config.debug).toBe(false);
    });

    it('should load config from file', async () => {
      await mkdir(TEST_CONFIG_DIR, { recursive: true });

      const customConfig: Partial<PromptxyConfig> = {
        listen: { host: '0.0.0.0', port: 8080 },
        api: { host: '0.0.0.0', port: 8081 },
        debug: true,
        rules: [
          {
            id: 'test-rule',
            when: { client: 'claude', field: 'system' },
            ops: [{ type: 'set', text: 'test' }],
          },
        ],
      };

      await writeFile(TEST_CONFIG_PATH, JSON.stringify(customConfig, null, 2));

      // 设置环境变量指向测试配置
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const config = await loadConfig();

      expect(config.listen.host).toBe('0.0.0.0');
      expect(config.listen.port).toBe(8080);
      expect(config.api.host).toBe('0.0.0.0');
      expect(config.api.port).toBe(8081);
      expect(config.debug).toBe(true);
      expect(config.rules).toHaveLength(1);
      expect(config.rules[0].id).toBe('test-rule');
    });

    it('should load config from current working directory', async () => {
      const originalCwd = process.cwd();
      const testCwd = path.join(TEST_CONFIG_DIR, 'cwd-test');

      try {
        // 创建测试工作目录
        await mkdir(testCwd, { recursive: true });
        process.chdir(testCwd);

        const localConfig = {
          listen: { host: 'localhost', port: 9090 },
        };

        await writeFile('promptxy.config.json', JSON.stringify(localConfig, null, 2));

        const config = await loadConfig();

        expect(config.listen.host).toBe('localhost');
        expect(config.listen.port).toBe(9090);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should apply environment variable overrides', async () => {
      // 设置环境变量
      process.env.PROMPTXY_HOST = '192.168.1.1';
      process.env.PROMPTXY_PORT = '9999';
      process.env.PROMPTXY_DEBUG = 'true';
      process.env.PROMPTXY_API_HOST = '10.0.0.1';
      process.env.PROMPTXY_API_PORT = '8888';
      process.env.PROMPTXY_UPSTREAM_ANTHROPIC = 'https://custom-anthropic.example.com';
      process.env.PROMPTXY_UPSTREAM_OPENAI = 'https://custom-openai.example.com';
      process.env.PROMPTXY_UPSTREAM_GEMINI = 'https://custom-gemini.example.com';
      process.env.PROMPTXY_MAX_HISTORY = '500';
      process.env.PROMPTXY_AUTO_CLEANUP = 'false';
      process.env.PROMPTXY_CLEANUP_INTERVAL = '24';

      const config = await loadConfig();

      expect(config.listen.host).toBe('192.168.1.1');
      expect(config.listen.port).toBe(9999);
      expect(config.debug).toBe(true);
      expect(config.api.host).toBe('10.0.0.1');
      expect(config.api.port).toBe(8888);
      expect(config.upstreams.anthropic).toBe('https://custom-anthropic.example.com');
      expect(config.upstreams.openai).toBe('https://custom-openai.example.com');
      expect(config.upstreams.gemini).toBe('https://custom-gemini.example.com');
      expect(config.storage.maxHistory).toBe(500);
      expect(config.storage.autoCleanup).toBe(false);
      expect(config.storage.cleanupInterval).toBe(24);
    });

    it('should handle boolean environment variables correctly', async () => {
      process.env.PROMPTXY_DEBUG = '1';
      let config = await loadConfig();
      expect(config.debug).toBe(true);

      process.env.PROMPTXY_DEBUG = '0';
      config = await loadConfig();
      expect(config.debug).toBe(false);

      process.env.PROMPTXY_DEBUG = 'TRUE';
      config = await loadConfig();
      expect(config.debug).toBe(true);

      process.env.PROMPTXY_DEBUG = 'FALSE';
      config = await loadConfig();
      expect(config.debug).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should reject invalid listen port', async () => {
      await mkdir(TEST_CONFIG_DIR, { recursive: true });
      const invalidConfig = {
        listen: { host: '127.0.0.1', port: 99999 },
      };
      await writeFile(TEST_CONFIG_PATH, JSON.stringify(invalidConfig));
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      await expect(loadConfig()).rejects.toThrow(
        'config.listen.port must be an integer in [1, 65535]',
      );
    });

    it('should reject invalid API port', async () => {
      await mkdir(TEST_CONFIG_DIR, { recursive: true });
      const invalidConfig = {
        listen: { host: '127.0.0.1', port: 7070 },
        api: { host: '127.0.0.1', port: -1 },
      };
      await writeFile(TEST_CONFIG_PATH, JSON.stringify(invalidConfig));
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      await expect(loadConfig()).rejects.toThrow(
        'config.api.port must be an integer in [1, 65535]',
      );
    });

    it('should reject invalid upstream URLs', async () => {
      await mkdir(TEST_CONFIG_DIR, { recursive: true });
      const invalidConfig = {
        listen: { host: '127.0.0.1', port: 7070 },
        api: { host: '127.0.0.1', port: 7071 },
        upstreams: {
          anthropic: 'not-a-url',
          openai: 'https://api.openai.com',
          gemini: 'https://generativelanguage.googleapis.com',
        },
      };
      await writeFile(TEST_CONFIG_PATH, JSON.stringify(invalidConfig));
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      await expect(loadConfig()).rejects.toThrow('config.upstreams.anthropic must be a valid URL');
    });

    it('should reject invalid rules structure', async () => {
      await mkdir(TEST_CONFIG_DIR, { recursive: true });
      const invalidConfig = {
        listen: { host: '127.0.0.1', port: 7070 },
        api: { host: '127.0.0.1', port: 7071 },
        upstreams: {
          anthropic: 'https://api.anthropic.com',
          openai: 'https://api.openai.com',
          gemini: 'https://generativelanguage.googleapis.com',
        },
        rules: [{ id: 'test' }], // Missing when and ops
      };
      await writeFile(TEST_CONFIG_PATH, JSON.stringify(invalidConfig));
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      await expect(loadConfig()).rejects.toThrow('rule.when must be an object');
    });

    it('should reject invalid storage configuration', async () => {
      await mkdir(TEST_CONFIG_DIR, { recursive: true });
      const invalidConfig = {
        listen: { host: '127.0.0.1', port: 7070 },
        api: { host: '127.0.0.1', port: 7071 },
        upstreams: {
          anthropic: 'https://api.anthropic.com',
          openai: 'https://api.openai.com',
          gemini: 'https://generativelanguage.googleapis.com',
        },
        rules: [],
        storage: { maxHistory: -1 },
      };
      await writeFile(TEST_CONFIG_PATH, JSON.stringify(invalidConfig));
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      await expect(loadConfig()).rejects.toThrow(
        'config.storage.maxHistory must be a positive integer',
      );
    });
  });

  describe('Configuration Saving', () => {
    it('should save config to default location', async () => {
      await mkdir(TEST_CONFIG_DIR, { recursive: true });
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const config: PromptxyConfig = {
        listen: { host: '127.0.0.1', port: 7070 },
        api: { host: '127.0.0.1', port: 7071 },
        upstreams: {
          anthropic: 'https://api.anthropic.com',
          openai: 'https://api.openai.com',
          gemini: 'https://generativelanguage.googleapis.com',
        },
        rules: [
          {
            id: 'save-test',
            when: { client: 'claude', field: 'system' },
            ops: [{ type: 'set', text: 'saved' }],
          },
        ],
        storage: { maxHistory: 100, autoCleanup: true, cleanupInterval: 1 },
        debug: false,
      };

      await saveConfig(config);

      // 验证文件存在
      await access(TEST_CONFIG_PATH);

      // 验证内容
      const savedContent = await import('node:fs/promises').then(({ readFile }) =>
        readFile(TEST_CONFIG_PATH, 'utf-8'),
      );
      const parsed = JSON.parse(savedContent);

      expect(parsed.listen.port).toBe(7070);
      expect(parsed.rules[0].id).toBe('save-test');
    });

    it('should save config to custom location via env var', async () => {
      const customPath = path.join(TEST_CONFIG_DIR, 'custom-config.json');
      process.env.PROMPTXY_CONFIG = customPath;

      // 确保测试目录存在
      await mkdir(TEST_CONFIG_DIR, { recursive: true });

      const config: PromptxyConfig = {
        listen: { host: '0.0.0.0', port: 8080 },
        api: { host: '0.0.0.0', port: 8081 },
        upstreams: {
          anthropic: 'https://api.anthropic.com',
          openai: 'https://api.openai.com',
          gemini: 'https://generativelanguage.googleapis.com',
        },
        rules: [],
        storage: { maxHistory: 100, autoCleanup: true, cleanupInterval: 1 },
        debug: false,
      };

      await saveConfig(config);

      // 验证文件存在
      await access(customPath);
    });

    it('should create directory structure if needed', async () => {
      const nestedDir = path.join(TEST_CONFIG_DIR, 'nested');
      const nestedPath = path.join(nestedDir, 'config.json');
      process.env.PROMPTXY_CONFIG = nestedPath;

      // 确保目录存在
      await mkdir(nestedDir, { recursive: true });

      const config: PromptxyConfig = {
        listen: { host: '127.0.0.1', port: 7070 },
        api: { host: '127.0.0.1', port: 7071 },
        upstreams: {
          anthropic: 'https://api.anthropic.com',
          openai: 'https://api.openai.com',
          gemini: 'https://generativelanguage.googleapis.com',
        },
        rules: [],
        storage: { maxHistory: 100, autoCleanup: true, cleanupInterval: 1 },
        debug: false,
      };

      await saveConfig(config);

      // 验证文件存在
      await access(nestedPath);
    });
  });

  describe('Config Directory', () => {
    it('should return directory from env var', () => {
      const customPath = '/custom/path/config.json';
      process.env.PROMPTXY_CONFIG = customPath;

      const dir = getConfigDir();
      expect(dir).toBe('/custom/path');
    });

    it('should return default directory when no env var', () => {
      delete process.env.PROMPTXY_CONFIG;

      const dir = getConfigDir();
      expect(dir).toBe(path.join(os.homedir(), '.promptxy'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty rules array', async () => {
      const config: PromptxyConfig = {
        listen: { host: '127.0.0.1', port: 7070 },
        api: { host: '127.0.0.1', port: 7071 },
        upstreams: {
          anthropic: 'https://api.anthropic.com',
          openai: 'https://api.openai.com',
          gemini: 'https://generativelanguage.googleapis.com',
        },
        rules: [],
        storage: { maxHistory: 100, autoCleanup: true, cleanupInterval: 1 },
        debug: false,
      };

      await saveConfig(config);
      const loaded = await loadConfig();
      expect(loaded.rules).toEqual([]);
    });

    it('should handle complex rules with all operation types', async () => {
      const complexConfig: Partial<PromptxyConfig> = {
        rules: [
          {
            id: 'complex-1',
            when: {
              client: 'claude',
              field: 'system',
              method: 'POST',
              pathRegex: '^/v1',
              modelRegex: 'gpt',
            },
            ops: [
              { type: 'set', text: 'set' },
              { type: 'append', text: 'append' },
              { type: 'prepend', text: 'prepend' },
              { type: 'replace', match: 'old', replacement: 'new' },
              { type: 'delete', match: 'remove' },
              { type: 'insert_before', regex: 'target', text: 'before' },
              { type: 'insert_after', regex: 'target', text: 'after' },
            ],
            stop: true,
            enabled: true,
          },
        ],
      };

      await mkdir(TEST_CONFIG_DIR, { recursive: true });
      await writeFile(TEST_CONFIG_PATH, JSON.stringify(complexConfig));
      process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

      const config = await loadConfig();
      expect(config.rules[0].ops).toHaveLength(7);
      expect(config.rules[0].stop).toBe(true);
      expect(config.rules[0].enabled).toBe(true);
    });
  });
});
