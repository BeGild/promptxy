import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import { cleanupTestData, startTestServer, HttpClient, createMockUpstream } from './test-utils.js';

describe('Gateway Routing Error Diagnostics', () => {
  let upstreamServer: any;
  let upstreamPort: number;
  let getCaptured: () => any;

  let server: any;
  let client: HttpClient;

  async function startWithConfig(config: PromptxyConfig) {
    server = await startTestServer(config);
    client = new HttpClient(server.baseUrl);
  }

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

  it('returns model_missing (400) when claude request lacks model', async () => {
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
      rules: [],
      storage: { maxHistory: 1000 },
      debug: false,
    };

    await startWithConfig(config);

    const res = await client.post('/claude/v1/messages', {
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 1,
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('model_missing');

    const captured = getCaptured();
    expect(captured.url).toBeUndefined();
  });

  it('returns model_mapping_no_match (400) when no mapping matches inbound model', async () => {
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
            { id: 'mm-only', inboundModel: 'only-this', targetSupplierId: 'codex-up', enabled: true },
          ],
        },
      ],
      rules: [],
      storage: { maxHistory: 1000 },
      debug: false,
    };

    await startWithConfig(config);

    const res = await client.post('/claude/v1/messages', {
      model: 'other-model',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 1,
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('model_mapping_no_match');

    const captured = getCaptured();
    expect(captured.url).toBeUndefined();
  });

  it('returns supplier_not_found (503) when mapping points to missing supplier', async () => {
    const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}`;

    const config: PromptxyConfig = {
      listen: { host: '127.0.0.1', port: 0 },
      suppliers: [],
      routes: [
        {
          id: 'r-claude',
          localService: 'claude',
          enabled: true,
          modelMappings: [
            { id: 'mm-any', inboundModel: '*', targetSupplierId: 'no-such-supplier', enabled: true },
          ],
        },
      ],
      rules: [],
      storage: { maxHistory: 1000 },
      debug: false,
    };

    await startWithConfig(config);

    const res = await client.post('/claude/v1/messages', {
      model: 'any-model',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 1,
    });

    expect(res.status).toBe(503);
    expect(res.body?.error).toBe('supplier_not_found');

    const captured = getCaptured();
    expect(captured.url).toBeUndefined();
  });

  it('returns supplier_disabled (503) when mapped supplier is disabled', async () => {
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
          enabled: false,
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
      rules: [],
      storage: { maxHistory: 1000 },
      debug: false,
    };

    await startWithConfig(config);

    const res = await client.post('/claude/v1/messages', {
      model: 'any-model',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 1,
    });

    expect(res.status).toBe(503);
    expect(res.body?.error).toBe('supplier_disabled');

    const captured = getCaptured();
    expect(captured.url).toBeUndefined();
  });

  it('returns route_constraint_violation (400) when /codex is wired to non-openai-codex supplier', async () => {
    const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}`;

    const config: PromptxyConfig = {
      listen: { host: '127.0.0.1', port: 0 },
      suppliers: [
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
        {
          id: 'r-codex',
          localService: 'codex',
          enabled: true,
          singleSupplierId: 'gemini-up',
        },
      ],
      rules: [],
      storage: { maxHistory: 1000 },
      debug: false,
    };

    await startWithConfig(config);

    const res = await client.post('/codex/responses', {
      model: 'gpt-4o-mini',
      instructions: 'hello',
      input: [{ role: 'user', content: 'hi' }],
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('route_constraint_violation');

    const captured = getCaptured();
    expect(captured.url).toBeUndefined();
  });
});
