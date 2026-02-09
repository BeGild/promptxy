/**
 * PromptXY 端到端流程测试：Claude Code → /claude → 协议转换器(codex/openai-chat/...) → 上游
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import {
  cleanupTestData,
  startTestServer,
  HttpClient,
  waitForCondition,
  createMockUpstream,
} from './test-utils.js';

describe('E2E Flow', () => {
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
          id: 'codex-up',
          name: 'codex-up',
          displayName: 'codex-up',
          baseUrl: upstreamBaseUrl,
          protocol: 'openai-codex',
          enabled: true,
          auth: { type: 'none' },
          supportedModels: ['gpt-4o-mini'],
        },
        {
          id: 'openai-chat-up',
          name: 'openai-chat-up',
          displayName: 'openai-chat-up',
          baseUrl: upstreamBaseUrl,
          protocol: 'openai-chat',
          enabled: true,
          auth: { type: 'none' },
          supportedModels: ['gpt-4o-mini'],
        },
      ],
      routes: [
        {
          id: 'r-claude-to-codex',
          localService: 'claude',
          modelMappings: [
            {
              id: 'm-sonnet',
              inboundModel: '*-sonnet-*',
              targetSupplierId: 'codex-up',
              outboundModel: 'gpt-4o-mini',
              enabled: true,
            },
            {
              id: 'm-haiku',
              inboundModel: '*-haiku-*',
              targetSupplierId: 'openai-chat-up',
              outboundModel: 'gpt-4o-mini',
              enabled: true,
            },
          ],
          enabled: true,
        },
      ],
      rules: [],
      storage: { maxHistory: 1000 },
      debug: false,
    };

    server = await startTestServer(config);
    client = new HttpClient(server.baseUrl);
  });

  afterEach(async () => {
    if (server) await server.shutdown();
    if (upstreamServer) await new Promise<void>(resolve => upstreamServer.close(() => resolve()));
    await cleanupTestData();
  });

  it('应将 Claude /v1/messages 转为 Codex /responses 并将响应转回 Claude 格式', async () => {
    const res = await client.post('/claude/v1/messages', {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 32,
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('message');
    expect(res.body.role).toBe('assistant');

    const captured = getCaptured();
    expect(captured.url).toBe('/responses');

    const upstreamBody = JSON.parse(captured.bodyText);
    expect(upstreamBody.model).toBe('gpt-4o-mini');
    expect(typeof upstreamBody.instructions).toBe('string');
    expect(Array.isArray(upstreamBody.input)).toBe(true);

    // 等待请求记录落盘并验证 transformerChain
    await waitForCondition(async () => {
      const list = await client.get('/_promptxy/requests?limit=10&client=claude');
      return (list.body?.total || 0) >= 1;
    }, 2000);

    const list = await client.get('/_promptxy/requests?limit=10&client=claude');
    const id = list.body.items[0].id;
    const detail = await client.get(`/_promptxy/requests/${id}`);

    expect(detail.body.routeId).toBe('r-claude-to-codex');
    expect(detail.body.supplierId).toBe('codex-up');
    expect(detail.body.transformerChain).toEqual(['codex']);
    expect(detail.body.transformTrace).toBeTruthy();
    expect(detail.body.routeNameSnapshot).toBe('Claude 路由');
    expect(typeof detail.body.pricingStatus).toBe('string');

    // originalRequestModel 必须来自入站请求体（任何 modelMapping / 协议转换之前）
    expect(detail.body.originalRequestModel).toBe('claude-3-5-sonnet-20241022');
    // requestedModel 代表实际发送给上游的模型（转换后）
    expect(detail.body.requestedModel).toBe('gpt-4o-mini');
  });

  it('应将 Claude /v1/messages 转为 OpenAI Chat /chat/completions 且 supplierClient 为 openai-chat', async () => {
    const res = await client.post('/claude/v1/messages', {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 32,
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('message');

    const captured = getCaptured();
    expect(captured.url).toBe('/chat/completions');

    await waitForCondition(async () => {
      const list = await client.get('/_promptxy/requests?limit=10&client=claude');
      return (list.body?.total || 0) >= 1;
    }, 2000);

    const list = await client.get('/_promptxy/requests?limit=10&client=claude');
    const item = list.body.items[0];

    expect(item.routeNameSnapshot).toBe('Claude 路由');
    expect(item.supplierName).toBe('openai-chat-up');
    expect(item.supplierClient).toBe('openai-chat');
    expect(item.transformerChain).toEqual(['openai-chat']);

    const detail = await client.get(`/_promptxy/requests/${item.id}`);
    expect(detail.body.routeId).toBe('r-claude-to-codex');
    expect(detail.body.supplierId).toBe('openai-chat-up');
    expect(detail.body.transformerChain).toEqual(['openai-chat']);
  });
});
