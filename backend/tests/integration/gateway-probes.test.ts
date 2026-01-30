import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import { cleanupTestData, startTestServer, HttpClient, createMockUpstream } from './test-utils.js';

// warmup/count 探测请求在 Claude→Codex 场景下应被网关直接短路，不应触发上游请求。

describe('Gateway Probe Filters (warmup/count)', () => {
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
          supportedModels: [],
        },
      ],
      routes: [
        {
          id: 'r-claude',
          localService: 'claude',
          enabled: true,
          modelMappings: [
            {
              id: 'mm-any-to-codex',
              inboundModel: '*',
              targetSupplierId: 'codex-up',
              enabled: true,
            },
          ],
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
    if (server) {
      await server.shutdown();
    }
    if (upstreamServer) {
      await new Promise<void>(resolve => upstreamServer.close(() => resolve()));
    }
    await cleanupTestData();
  });

  it('warmup body 请求 /claude/v1/messages 应直接返回空结构且不触发上游', async () => {
    const response = await client.post('/claude/v1/messages', {
      model: 'any-model',
      messages: [{ role: 'user', content: '' }],
      max_tokens: 1,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      type: 'result',
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
    });

    const captured = getCaptured();
    expect(captured.url).toBeUndefined();
  });

  it('count probe body 请求 /claude/v1/messages 应直接返回空结构且不触发上游', async () => {
    const response = await client.post('/claude/v1/messages', {
      model: 'any-model',
      messages: [{ role: 'user', content: 'count' }],
      max_tokens: 1,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      type: 'result',
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
    });

    const captured = getCaptured();
    expect(captured.url).toBeUndefined();
  });
});
