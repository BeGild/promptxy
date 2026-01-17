/**
 * PromptXY Gateway 集成测试（路由驱动 + /codex 前缀）
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import {
  cleanupTestData,
  startTestServer,
  HttpClient,
  waitForCondition,
  createTestRule,
  createMockUpstream,
} from './test-utils.js';
import { assertSupplier } from '../../src/promptxy/config.js';

describe('Gateway Integration Tests', () => {
  let upstreamServer: any;
  let upstreamPort: number;
  let getCaptured: () => any;

  let server: any;
  let client: HttpClient;

  beforeEach(async () => {
    const upstream = createMockUpstream();
    upstreamServer = upstream.server;
    getCaptured = upstream.getCaptured;

    upstreamPort = await new Promise<number>(resolve => {
      const s = upstreamServer.listen(0, '127.0.0.1', () => {
        const addr = s.address();
        resolve(typeof addr === 'object' && addr ? addr.port : 0);
      });
    });

    const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}`;

    const config: PromptxyConfig = {
      listen: { host: '127.0.0.1', port: 0 },
      suppliers: [
        {
          id: 'claude-up',
          name: 'claude-up',
          displayName: 'claude-up',
          baseUrl: upstreamBaseUrl,
          protocol: 'anthropic',
          enabled: true,
          auth: { type: 'none' },
          supportedModels: [],
        },
        {
          id: 'codex-up',
          name: 'codex-up',
          displayName: 'codex-up',
          baseUrl: upstreamBaseUrl,
          protocol: 'openai-codex',
          enabled: true,
          auth: { type: 'none' },
          supportedModels: [],
        },
        {
          id: 'gemini-up',
          name: 'gemini-up',
          displayName: 'gemini-up',
          baseUrl: upstreamBaseUrl,
          protocol: 'gemini',
          enabled: true,
          auth: { type: 'none' },
          supportedModels: [],
        },
      ],
      routes: [
        { id: 'r-claude', localService: 'claude', defaultSupplierId: 'claude-up', enabled: true },
        { id: 'r-codex', localService: 'codex', singleSupplierId: 'codex-up', enabled: true },
        { id: 'r-gemini', localService: 'gemini', singleSupplierId: 'gemini-up', enabled: true },
      ],
      rules: [
        createTestRule('rule-claude', 'claude', 'system', [{ type: 'append', text: ' [OK]' }]),
        createTestRule('rule-codex', 'codex', 'instructions', [{ type: 'prepend', text: 'PREFIX: ' }]),
      ],
      storage: { maxHistory: 1000 },
      debug: false,
    };

    server = await startTestServer(config);
    client = new HttpClient(server.baseUrl);
  });

  afterEach(async () => {
    if (server) {
      await server.shutdown();
    }
    if (upstreamServer) {
      await new Promise<void>(resolve => upstreamServer.close(() => resolve()));
    }
    await cleanupTestData();
  });

  it('应通过 routes 将 /codex 请求透明转发到上游，并记录 supplier/route 信息', async () => {
    const response = await client.post('/codex/responses', {
      model: 'gpt-4o-mini',
      instructions: 'hello',
      input: [{ role: 'user', content: 'hi' }],
    });

    expect(response.status).toBe(200);

    const captured = getCaptured();
    expect(captured.url).toBe('/responses');

    const upstreamBody = JSON.parse(captured.bodyText);
    expect(upstreamBody.instructions).toContain('PREFIX: ');

    // 等待请求记录落盘
    await waitForCondition(async () => {
      const list = await client.get('/_promptxy/requests?limit=10&client=codex');
      return (list.body?.total || 0) >= 1;
    }, 2000);

    const list = await client.get('/_promptxy/requests?limit=10&client=codex');
    const firstId = list.body.items[0].id;

    const detail = await client.get(`/_promptxy/requests/${firstId}`);
    expect(detail.body.client).toBe('codex');
    expect(detail.body.path).toBe('/responses');
    expect(detail.body.routeId).toBe('r-codex');
    expect(detail.body.supplierId).toBe('codex-up');
    expect(detail.body.supplierBaseUrl).toContain(`:${upstreamPort}`);
    expect(Array.isArray(detail.body.transformerChain)).toBe(true);
  });

  it('应在 /codex 出站时解析 modelSpec 并注入 reasoning.effort（命中 supplier.reasoningEfforts/默认列表）', async () => {
    const response = await client.post('/codex/responses', {
      model: 'gpt-5.2-codex-high',
      instructions: 'hello',
      input: [{ role: 'user', content: 'hi' }],
    });

    expect(response.status).toBe(200);

    const captured = getCaptured();
    const upstreamBody = JSON.parse(captured.bodyText);
    expect(upstreamBody.model).toBe('gpt-5.2-codex');
    expect(upstreamBody.reasoning?.effort).toBe('high');
  });
});

describe('Supplier Protocol Validation', () => {
  it('应拒绝旧 openai 协议字符串', () => {
    expect(() =>
      assertSupplier('s', {
        id: 's',
        name: 's',
        displayName: 's',
        baseUrl: 'https://api.openai.com/v1',
        protocol: 'openai',
        enabled: true,
        supportedModels: [],
      } as any),
    ).toThrow(/protocol/);
  });
});
