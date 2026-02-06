import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import { cleanupTestData, startTestServer, HttpClient } from './test-utils.js';
import { getSyncStorage } from '../../src/promptxy/sync/sync-storage.js';

describe('API Server - models search', () => {
  let server: any;
  let client: HttpClient;

  beforeEach(async () => {
    const config: PromptxyConfig = {
      listen: { host: '127.0.0.1', port: 0 },
      suppliers: [
        {
          id: 'claude-up',
          name: 'claude-up',
          displayName: 'claude-up',
          baseUrl: 'http://127.0.0.1:12345',
          protocol: 'anthropic',
          enabled: true,
          auth: { type: 'none' },
          supportedModels: [],
          modelPricingMappings: [],
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
              targetSupplierId: 'claude-up',
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

    const syncStorage = getSyncStorage();
    await syncStorage.init();
    await syncStorage.saveLists([
      {
        modelName: 'gpt-5',
        provider: 'openai',
        protocol: 'openai-codex',
        source: 'models.dev',
        syncedAt: Date.now(),
        createdAt: Date.now(),
      },
      {
        modelName: 'gpt-5-mini',
        provider: 'openai',
        protocol: 'openai-codex',
        source: 'models.dev',
        syncedAt: Date.now(),
        createdAt: Date.now(),
      },
      {
        modelName: 'claude-3-5-sonnet',
        provider: 'anthropic',
        protocol: 'anthropic',
        source: 'models.dev',
        syncedAt: Date.now(),
        createdAt: Date.now(),
      },
    ]);
  });

  afterEach(async () => {
    if (server) await server.shutdown();
    await cleanupTestData();
  });

  it('GET /_promptxy/models/search 应按协议和关键词返回模型候选', async () => {
    const res = await client.get('/_promptxy/models/search?protocol=openai-codex&q=gpt&limit=5');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((item: any) => String(item.modelName).includes('gpt'))).toBe(true);
  });
});

