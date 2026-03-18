import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import {
  cleanupTestData,
  startTestServer,
  HttpClient,
  createMockUpstream,
  waitForCondition,
} from './test-utils.js';

describe('Gateway Proxying Smoke', () => {
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
        {
          id: 'chat-up',
          name: 'chat-up',
          displayName: 'chat-up',
          baseUrl: upstreamBaseUrl,
          protocol: 'openai-chat',
          enabled: true,
          auth: { type: 'none' },
          supportedModels: [],
        },
      ],
      routes: [
        {
          id: 'r-codex',
          localService: 'codex',
          enabled: true,
          singleSupplierId: 'codex-up',
        },
        {
          id: 'r-chat',
          localService: 'chat',
          enabled: true,
          singleSupplierId: 'chat-up',
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

  it('should proxy /codex/responses to upstream /responses', async () => {
    const response = await client.post('/codex/responses', {
      model: 'gpt-4o-mini',
      input: [{ role: 'user', content: 'hi' }],
      instructions: 'hello',
    });

    expect(response.status).toBe(200);

    const captured = getCaptured();
    expect(captured.url).toBe('/responses');
  });

  it('should proxy /chat/v1/chat/completions to upstream /v1/chat/completions and persist request detail', async () => {
    const response = await client.post('/chat/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hello chat' }],
      stream: false,
    });

    expect(response.status).toBe(200);

    const captured = getCaptured();
    expect(captured.url).toBe('/v1/chat/completions');

    await waitForCondition(async () => {
      const list = await client.get('/_promptxy/requests?limit=10&client=chat');
      return Array.isArray(list.body?.items) && list.body.items.length > 0;
    }, 3000);

    const list = await client.get('/_promptxy/requests?limit=10&client=chat');
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items[0].path).toBe('/v1/chat/completions');

    const detail = await client.get(`/_promptxy/requests/${list.body.items[0].id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.client).toBe('chat');
    expect(detail.body.path).toBe('/v1/chat/completions');
    expect(detail.body.originalBody).toMatchObject({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hello chat' }],
    });
    expect(detail.body.modifiedBody).toMatchObject({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hello chat' }],
    });
  });
});
