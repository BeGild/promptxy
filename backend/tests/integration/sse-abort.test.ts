/**
 * SSE abort 集成测试
 *
 * 目标：当客户端中断 SSE（Abort/断连）时，网关不应崩溃，并应继续提供健康检查。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import { cleanupTestData, startTestServer, HttpClient, waitForCondition } from './test-utils.js';

function createSSEUpstream(): {
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

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/v1/messages') {
      const accept = String(req.headers['accept'] ?? '');
      if (accept.includes('text/event-stream')) {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });

        let idx = 0;
        const send = () => {
          idx += 1;
          const payload = {
            type: idx === 1 ? 'content_block_start' : 'content_block_delta',
            index: 0,
            delta: { type: 'text', text: `Chunk ${idx} ` },
          };
          res.write(`event: content_block_delta\ndata: ${JSON.stringify(payload)}\n\n`);
        };

        // 先写一个 chunk，保证客户端能读到并触发 abort。
        send();

        const timer = setInterval(send, 25);
        res.on('close', () => clearInterval(timer));
        res.on('error', () => clearInterval(timer));
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });

  return {
    server,
    getCaptured: () => captured,
  };
}

describe('SSE Abort Integration', () => {
  let upstreamServer: http.Server;
  let upstreamPort: number;

  let server: any;
  let client: HttpClient;

  beforeEach(async () => {
    const upstream = createSSEUpstream();
    upstreamServer = upstream.server;

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
          protocol: 'openai',
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
        {
          id: 'r-claude',
          localService: 'claude',
          modelMappings: [
            {
              id: 'mm-claude',
              inboundModel: '*',
              targetSupplierId: 'claude-up',
              enabled: true,
            },
          ],
          enabled: true,
        },
        { id: 'r-codex', localService: 'codex', singleSupplierId: 'codex-up', enabled: true },
        { id: 'r-gemini', localService: 'gemini', singleSupplierId: 'gemini-up', enabled: true },
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

  it('客户端中断 SSE 时服务不应崩溃，且应写入 partial 记录', async () => {
    const gatewayUrl = server.baseUrl;

    const ac = new AbortController();

    const res = await fetch(`${gatewayUrl}/claude/v1/messages`, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        stream: true,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') || '').toContain('text/event-stream');

    // 读到首个 chunk 后立刻 abort，模拟客户端主动取消/中间层断开。
    const reader = res.body?.getReader();
    expect(reader).toBeTruthy();

    await reader!.read();
    ac.abort();

    // 给网关一点时间完成 pipeline 的 catch/finalize。
    await new Promise(r => setTimeout(r, 50));

    // 核心断言：网关仍能正常响应 health（未崩溃）。
    const health = await client.get('/_promptxy/health');
    expect(health.status).toBe(200);

    // 断言：应写入一条 partial 记录。
    await waitForCondition(async () => {
      const list = await client.get('/_promptxy/requests?limit=10&client=claude');
      return (list.body?.total || 0) >= 1;
    }, 2000);

    const list = await client.get('/_promptxy/requests?limit=10&client=claude');
    const firstId = list.body.items[0].id;

    const detail = await client.get(`/_promptxy/requests/${firstId}`);
    expect(String(detail.body.error || '')).toContain('partial=true');
  });
});
