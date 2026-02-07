import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import { cleanupTestData, startTestServer, HttpClient } from './test-utils.js';

describe('API Server - Suppliers modelPricingMappings', () => {
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
  });

  afterEach(async () => {
    if (server) await server.shutdown();
    await cleanupTestData();
  });

  it('POST/PUT suppliers 应保存并返回 modelPricingMappings', async () => {
    const createRes = await client.post('/_promptxy/suppliers', {
      supplier: {
        name: 'new-supplier',
        displayName: 'New Supplier',
        baseUrl: 'https://api.example.com',
        protocol: 'openai-codex',
        enabled: true,
        auth: { type: 'none' },
        supportedModels: [],
        modelPricingMappings: [
          {
            modelName: 'private-a',
            billingModel: 'gpt-5-mini',
            priceMode: 'inherit',
          },
        ],
      },
    });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    expect(Array.isArray(createRes.body.supplier.modelPricingMappings)).toBe(true);
    expect(createRes.body.supplier.modelPricingMappings).toHaveLength(1);
    expect(createRes.body.supplier.modelPricingMappings[0].updatedAt).toBeTypeOf('number');

    const supplierId = createRes.body.supplier.id;
    const updateRes = await client.request('PUT', `/_promptxy/suppliers/${supplierId}`, {
      supplier: {
        ...createRes.body.supplier,
        modelPricingMappings: [
          {
            modelName: 'private-a',
            billingModel: 'private-a',
            priceMode: 'custom',
            customPrice: {
              inputPrice: 0.002,
              outputPrice: 0.006,
              cacheReadPrice: 0.0002,
              cacheWritePrice: 0.0004,
            },
          },
        ],
      },
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.supplier.modelPricingMappings).toHaveLength(1);
    expect(updateRes.body.supplier.modelPricingMappings[0].priceMode).toBe('custom');
    expect(updateRes.body.supplier.modelPricingMappings[0].customPrice.inputPrice).toBe(0.002);
    expect(updateRes.body.supplier.modelPricingMappings[0].customPrice.cacheReadPrice).toBe(0.0002);
    expect(updateRes.body.supplier.modelPricingMappings[0].customPrice.cacheWritePrice).toBe(0.0004);
  });
});
