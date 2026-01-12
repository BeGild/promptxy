/**
 * PromptXY API 集成测试：路由管理语义（同 localService 仅允许一个 enabled）
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import { cleanupTestData, startTestServer, HttpClient } from './test-utils.js';

describe('API Server - Routes', () => {
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
        },
        {
          id: 'codex-up',
          name: 'codex-up',
          displayName: 'codex-up',
          baseUrl: 'http://127.0.0.1:12345',
          protocol: 'openai',
          enabled: true,
          auth: { type: 'none' },
          supportedModels: ['gpt-5.2-codex-high'],
        },
        {
          id: 'gemini-up',
          name: 'gemini-up',
          displayName: 'gemini-up',
          baseUrl: 'http://127.0.0.1:12345',
          protocol: 'gemini',
          enabled: true,
          auth: { type: 'none' },
          supportedModels: [],
        },
      ],
      routes: [
        { id: 'r-claude-1', localService: 'claude', defaultSupplierId: 'claude-up', enabled: true },
        { id: 'r-codex-1', localService: 'codex', defaultSupplierId: 'codex-up', enabled: true },
        { id: 'r-gemini-1', localService: 'gemini', defaultSupplierId: 'gemini-up', enabled: true },
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

  it('GET /_promptxy/routes 应返回路由列表', async () => {
    const res = await client.get('/_promptxy/routes');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.routes)).toBe(true);
  });

  it('创建 claude→openai 路由时应保存 modelMappings，并确保同 localService 仅一条 enabled', async () => {
    const createRes = await client.post('/_promptxy/routes', {
      route: {
        localService: 'claude',
        modelMappings: [
          {
            id: 'm-sonnet',
            inboundModel: '*-sonnet-*',
            targetSupplierId: 'codex-up',
            outboundModel: 'gpt-5.2-codex-high',
            enabled: true,
          },
        ],
        enabled: true,
      },
    });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);

    const list = await client.get('/_promptxy/routes');
    const claudeRoutes = list.body.routes.filter((r: any) => r.localService === 'claude');
    expect(claudeRoutes.length).toBeGreaterThanOrEqual(2);
    expect(claudeRoutes.filter((r: any) => r.enabled).length).toBe(1);
  });

  it('不应允许 codex 入口对接 gemini 协议供应商', async () => {
    const createRes = await client.post('/_promptxy/routes', {
      route: {
        localService: 'codex',
        defaultSupplierId: 'gemini-up',
        enabled: true,
      },
    });

    expect(createRes.status).toBe(400);
    expect(createRes.body.success).toBe(false);
  });

  it('POST /_promptxy/routes/:id/toggle 应正确切换路由（不应误命中 suppliers toggle）', async () => {
    const disableRes = await client.post('/_promptxy/routes/r-codex-1/toggle', { enabled: false });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.success).toBe(true);
    expect(disableRes.body.route.enabled).toBe(false);

    const enableRes = await client.post('/_promptxy/routes/r-codex-1/toggle', { enabled: true });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.success).toBe(true);
    expect(enableRes.body.route.enabled).toBe(true);
  });
});
