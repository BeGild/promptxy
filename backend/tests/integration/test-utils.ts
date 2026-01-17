/**
 * PromptXY 集成测试工具函数（统一服务器版本）
 *
 * 目标：
 * - 以单端口统一服务器测试 /_promptxy/* 与 /claude|/codex|/gemini 代理路由
 * - 使用 FileSystemStorage（YAML 落盘）并通过 HOME/XDG 隔离测试数据目录
 */

import * as http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { createGateway } from '../../src/promptxy/gateway.js';
import { initializeDatabase, resetDatabaseForTest } from '../../src/promptxy/database.js';
import type { PromptxyConfig, PromptxyRule } from '../../src/promptxy/types.js';

// 测试目录（按 worker/pid 隔离）
const TEST_RUN_ID =
  process.env.VITEST_WORKER_ID !== undefined
    ? `worker-${process.env.VITEST_WORKER_ID}`
    : `pid-${process.pid}`;
const TEST_HOME = path.join(os.tmpdir(), `promptxy-integration-${TEST_RUN_ID}`);

export interface TestServerContainer {
  server: http.Server;
  port: number;
  baseUrl: string;
  shutdown: () => Promise<void>;
}

export async function cleanupTestData(): Promise<void> {
  await resetDatabaseForTest();
  await rm(TEST_HOME, { recursive: true, force: true }).catch(() => {});
}

export async function startTestServer(config: PromptxyConfig): Promise<TestServerContainer> {
  await rm(TEST_HOME, { recursive: true, force: true }).catch(() => {});
  await mkdir(TEST_HOME, { recursive: true });

  // 隔离 storage 落盘路径
  process.env.HOME = TEST_HOME;
  process.env.XDG_DATA_HOME = TEST_HOME;

  await resetDatabaseForTest();
  const db = await initializeDatabase(true);

  const server = createGateway(config, db, config.rules as PromptxyRule[]);

  const port = await new Promise<number>((resolve, reject) => {
    const s = server.listen(0, config.listen.host, () => {
      const addr = s.address();
      if (typeof addr === 'object' && addr !== null) resolve(addr.port);
      else resolve(0);
    });
    server.on('error', reject);
  });

  return {
    server,
    port,
    baseUrl: `http://${config.listen.host}:${port}`,
    shutdown: async () => {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await resetDatabaseForTest();
      await rm(TEST_HOME, { recursive: true, force: true }).catch(() => {});
    },
  };
}

export class HttpClient {
  constructor(private baseUrl: string) {}

  async get(pathname: string): Promise<{ status: number; body: any; headers: Record<string, string> }> {
    return this.request('GET', pathname);
  }

  async post(pathname: string, body?: any, headers?: Record<string, string>): Promise<{ status: number; body: any; headers: Record<string, string> }> {
    return this.request('POST', pathname, body, headers);
  }

  async request(
    method: string,
    pathname: string,
    body?: any,
    headers?: Record<string, string>,
  ): Promise<{ status: number; body: any; headers: Record<string, string> }> {
    const url = new URL(pathname, this.baseUrl);

    const res = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : text;
    } catch {
      parsed = text;
    }

    const outHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => (outHeaders[k.toLowerCase()] = v));

    return { status: res.status, body: parsed, headers: outHeaders };
  }
}

export async function waitForCondition(fn: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Condition not met within timeout');
}

export function createTestRule(
  id: string,
  client: 'claude' | 'codex' | 'gemini',
  field: 'system' | 'instructions',
  ops: any[],
): any {
  return {
    uuid: id,
    name: id,
    when: { client, field },
    ops,
    enabled: true,
  };
}

export function createMockUpstream(): {
  server: http.Server;
  getCaptured: () => { url?: string; method?: string; headers?: any; bodyText?: string };
} {
  let captured: { url?: string; method?: string; headers?: any; bodyText?: string } = {};

  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    captured = {
      url: req.url,
      method: req.method,
      headers: req.headers,
      bodyText: Buffer.concat(chunks).toString('utf-8'),
    };

    // 根据路径返回不同响应：/responses 返回一个 chat.completion 兼容 JSON（便于转换回 Anthropic）
    if (req.url?.startsWith('/responses')) {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          id: 'chatcmpl-test',
          model: 'gpt-test',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'ok' },
              finish_reason: 'stop',
            },
          ],
        }),
      );
      return;
    }

    // /chat/completions 返回标准的 OpenAI Chat Completions 响应
    if (req.url?.startsWith('/chat/completions')) {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-test',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'ok' },
              finish_reason: 'stop',
            },
          ],
        }),
      );
      return;
    }

    // 默认：回显 JSON
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  });

  return {
    server,
    getCaptured: () => captured,
  };
}

