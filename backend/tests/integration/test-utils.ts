/**
 * PromptXY 集成测试工具函数
 * 提供测试服务器启动、数据库清理、HTTP 客户端等通用功能
 */

import * as http from 'node:http';
import type { Database } from 'sql.js';
import { createGateway } from '../../src/promptxy/gateway.js';
import {
  initializeDatabase,
  resetDatabaseForTest,
  cleanupOldRequests,
} from '../../src/promptxy/database.js';
import { loadConfig, saveConfig } from '../../src/promptxy/config.js';
import { PromptxyConfig, PromptxyRule } from '../../src/promptxy/types.js';
import * as path from 'node:path';
import * as os from 'node:os';
import { mkdir, rm, writeFile } from 'node:fs/promises';

// 测试配置目录
// 注意：vitest 会并发执行多个 test file；如果所有套件共用同一个目录会导致 rm/写库 互相打架，产生 SQLITE_IOERR/READONLY
const TEST_RUN_ID =
  process.env.VITEST_WORKER_ID !== undefined
    ? `worker-${process.env.VITEST_WORKER_ID}`
    : `pid-${process.pid}`;
const TEST_CONFIG_DIR = path.join(os.tmpdir(), `promptxy-test-${TEST_RUN_ID}`);
const TEST_DB_PATH = path.join(TEST_CONFIG_DIR, 'promptxy-test.db');
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config-test.json');

/**
 * 测试服务器容器
 */
export interface TestServerContainer {
  server: http.Server;
  port: number;
  shutdown: () => Promise<void>;
}

/**
 * 创建测试配置
 */
export async function createTestConfig(
  overrides: Partial<PromptxyConfig> = {},
): Promise<PromptxyConfig> {
  const defaultConfig: PromptxyConfig = {
    listen: {
      host: '127.0.0.1',
      port: 0, // 使用随机端口
    },
    suppliers: [
      {
        id: 'claude-anthropic',
        name: 'Claude (Anthropic)',
        baseUrl: 'https://api.anthropic.com',
        localPrefix: '/claude',
        pathMappings: [],
        enabled: true,
      },
      {
        id: 'openai-official',
        name: 'OpenAI Official',
        baseUrl: 'https://api.openai.com',
        localPrefix: '/openai',
        pathMappings: [],
        enabled: true,
      },
      {
        id: 'gemini-google',
        name: 'Gemini (Google)',
        baseUrl: 'https://generativelanguage.googleapis.com',
        localPrefix: '/gemini',
        pathMappings: [],
        enabled: true,
      },
    ],
    rules: [],
    storage: {
      maxHistory: 100,
      autoCleanup: false, // 测试时禁用自动清理
      cleanupInterval: 1,
    },
    debug: false,
    ...overrides,
  };

  // 确保测试目录存在
  await mkdir(TEST_CONFIG_DIR, { recursive: true });

  // 设置环境变量以使用测试配置路径
  process.env.PROMPTXY_CONFIG = TEST_CONFIG_PATH;

  // 保存配置文件
  await saveConfig(defaultConfig);

  return defaultConfig;
}

/**
 * 使用测试数据库初始化
 */
export async function initializeTestDatabase(): Promise<Database> {
  // 先清理测试目录和数据库文件
  try {
    await rm(TEST_CONFIG_DIR, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }

  // 重置现有数据库实例
  await resetDatabaseForTest();

  // 确保测试目录存在
  await mkdir(TEST_CONFIG_DIR, { recursive: true });

  // 设置测试数据库路径的环境变量
  const originalHome = process.env.HOME;
  const originalXDG = process.env.XDG_DATA_HOME;

  // 临时修改环境变量，使数据库使用测试路径
  process.env.HOME = TEST_CONFIG_DIR;
  process.env.XDG_DATA_HOME = TEST_CONFIG_DIR;

  // 重新初始化数据库
  const db = await initializeDatabase();

  // 恢复环境变量
  if (originalHome) process.env.HOME = originalHome;
  if (originalXDG) process.env.XDG_DATA_HOME = originalXDG;

  return db;
}

/**
 * 启动测试服务器
 */
export async function startTestServers(
  config: PromptxyConfig,
  db: Database,
): Promise<TestServerContainer> {
  // 创建统一服务器（Gateway + API）
  const server = createGateway(config, db, config.rules);

  // 启动服务器并获取实际端口
  const port = await new Promise<number>((resolve, reject) => {
    try {
      const s = server.listen(0, config.listen.host, () => {
        const addr = s.address();
        if (typeof addr === 'object' && addr !== null) {
          resolve(addr.port);
        } else {
          resolve(config.listen.port);
        }
      });
      // Add error handling
      server.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });

  // 更新配置中的实际端口
  config.listen.port = port;

  return {
    server,
    port,
    shutdown: async () => {
      // 优雅关闭服务器
      await new Promise<void>(resolve => {
        if (server.listening) {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });

      // 额外等待一小段时间确保端口释放
      await new Promise(resolve => setTimeout(resolve, 100));
    },
  };
}

/**
 * 清理测试数据
 */
export async function cleanupTestData(): Promise<void> {
  try {
    // 重置数据库
    await resetDatabaseForTest();

    // 清理测试配置目录
    await rm(TEST_CONFIG_DIR, { recursive: true, force: true });

    // 清理环境变量
    delete process.env.PROMPTXY_CONFIG;
    delete process.env.HOME;
    delete process.env.XDG_DATA_HOME;
  } catch {
    // 忽略清理错误
  }
}

/**
 * HTTP 请求工具
 */
export class HttpClient {
  constructor(private baseUrl: string) {}

  async get(
    path: string,
    headers?: Record<string, string>,
  ): Promise<{
    status: number;
    body: string;
    headers: Record<string, string>;
  }> {
    return this.request('GET', path, undefined, headers);
  }

  async post(
    path: string,
    body?: any,
    headers?: Record<string, string>,
  ): Promise<{
    status: number;
    body: string;
    headers: Record<string, string>;
  }> {
    return this.request('POST', path, body, headers);
  }

  async put(
    path: string,
    body?: any,
    headers?: Record<string, string>,
  ): Promise<{
    status: number;
    body: string;
    headers: Record<string, string>;
  }> {
    return this.request('PUT', path, body, headers);
  }

  async delete(
    path: string,
    headers?: Record<string, string>,
  ): Promise<{
    status: number;
    body: string;
    headers: Record<string, string>;
  }> {
    return this.request('DELETE', path, undefined, headers);
  }

  async request(
    method: string,
    path: string,
    body?: any,
    headers?: Record<string, string>,
  ): Promise<{
    status: number;
    body: string;
    headers: Record<string, string>;
  }> {
    const url = new URL(path, this.baseUrl);

    const options: http.RequestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body !== undefined) {
      options.headers = {
        ...options.headers,
        'Content-Length': Buffer.byteLength(JSON.stringify(body)).toString(),
      };
    }

    return new Promise((resolve, reject) => {
      const req = http.request(url, options, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const responseHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (value) {
              responseHeaders[key] = Array.isArray(value) ? value.join(', ') : (value as string);
            }
          }

          resolve({
            status: res.statusCode || 0,
            body: data,
            headers: responseHeaders,
          });
        });
      });

      req.on('error', reject);

      if (body !== undefined) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * SSE 连接测试
   */
  async connectSSE(
    path: string,
    onEvent: (event: string, data: any) => void,
  ): Promise<{
    close: () => void;
    events: Array<{ event: string; data: any }>;
  }> {
    const url = new URL(path, this.baseUrl);
    const events: Array<{ event: string; data: any }> = [];
    let buffer = '';
    let resolved = false;

    return new Promise((resolve, reject) => {
      const req = http.request(url, { method: 'GET' }, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`SSE connection failed: ${res.statusCode}`));
          return;
        }

        // Set up data handler
        res.on('data', chunk => {
          buffer += chunk.toString();

          // Process complete SSE messages
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n\n')) !== -1) {
            const message = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 2);

            // Parse message
            const lines = message.split('\n');
            let event = '';
            let data = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                event = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                data = line.slice(5).trim();
              }
            }

            if (event && data) {
              try {
                const parsed = JSON.parse(data);
                events.push({ event, data: parsed });
                onEvent(event, parsed);
              } catch {
                // If parsing fails, store raw data
                events.push({ event, data });
                onEvent(event, data);
              }

              // Resolve on first event (connection confirmation)
              if (!resolved) {
                resolved = true;
                resolve({
                  close: () => {
                    req.destroy();
                    res.destroy();
                  },
                  events,
                });
              }
            }
          }
        });

        res.on('end', () => {
          if (!resolved) {
            resolved = true;
            resolve({
              close: () => req.destroy(),
              events,
            });
          }
        });

        res.on('error', err => {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });
      });

      req.on('error', err => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      req.end();
    });
  }
}

/**
 * 等待条件满足
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * 创建测试用的规则
 */
export function createTestRule(
  id: string,
  client: 'claude' | 'codex' | 'gemini',
  field: 'system' | 'instructions',
  ops: PromptxyRule['ops'],
): PromptxyRule {
  return {
    uuid: id,
    name: id,
    description: `Test rule ${id}`,
    when: {
      client,
      field,
    },
    ops,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 模拟上游服务器
 */
export function createMockUpstream(): http.Server {
  return http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'mock-response',
        content: [{ type: 'text', text: 'Mock upstream response' }],
      }),
    );
  });
}
