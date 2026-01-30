import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import {
  cleanupTestData,
  startTestServer,
  HttpClient,
  createMockUpstream,
  createTestRule,
} from './test-utils.js';

describe('Gateway Rules Apply Once', () => {
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
            { id: 'mm-any', inboundModel: '*', targetSupplierId: 'codex-up', enabled: true },
          ],
        },
      ],
      rules: [
        createTestRule('rule-once', 'claude', 'system', [{ type: 'append', text: ' [ONCE]' }]),
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
      server = undefined;
    }
    if (upstreamServer) {
      await new Promise<void>(resolve => upstreamServer.close(() => resolve()));
      upstreamServer = undefined;
    }
    await cleanupTestData();
  });

  it('applies prompt rules only once for /claude when transformer is codex', async () => {
    const res = await client.post('/claude/v1/messages', {
      model: 'any-model',
      system: 'SYS',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 1,
    });

    expect(res.status).toBe(200);

    const captured = getCaptured();
    expect(captured.url).toBe('/responses');

    const upstreamBody = JSON.parse(captured.bodyText);

    const input = upstreamBody.input as any[];
    expect(Array.isArray(input)).toBe(true);

    const developerMsg = input.find(
      item => item && item.type === 'message' && item.role === 'developer',
    );
    expect(developerMsg).toBeTruthy();

    const developerText = developerMsg.content?.[0]?.text as string;
    expect(developerText).toContain('SYS');

    const onceCount = (developerText.match(/\[ONCE\]/g) || []).length;
    expect(onceCount).toBe(1);
  });
});
