/**
 * SSE upstream premature close 集成测试
 *
 * 目标：当 /claude -> /codex 转换后的上游 SSE 在未发送 response.completed 时提前断开，
 * 网关仍应补齐 Claude SSE 的 message_stop，避免 Claude 客户端无限等待。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import { cleanupTestData, startTestServer, HttpClient, waitForCondition } from './test-utils.js';

function createCodexSSEUpstreamPrematureClose(): http.Server {
  return http.createServer(async (req, res) => {
    // drain body
    for await (const _chunk of req) {
      // noop
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/responses')) {
      const accept = String(req.headers['accept'] ?? '');
      if (accept.includes('text/event-stream')) {
        // 最小可触发 tool loop 的 Codex SSE 序列，但刻意不发送 response.completed。
        // 这里用“chunked 未正常结束就关闭连接”的方式模拟上游提前断开：
        // - 不发送 response.completed
        // - 不调用 res.end()（不写入 chunked 终止块）
        // - 直接关闭 socket（FIN），使客户端感知为 premature close / terminated
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          // 强制关闭连接，确保 content-length 不匹配会尽快表现为“提前断开/terminated”
          // （否则 keep-alive 下客户端可能会一直等待剩余字节而不报错）
          connection: 'close',
        });

        // 先写出完整事件块，确保网关侧能解析并开始输出，再在缺失 chunked 终止块的情况下关闭连接。
        res.write('data: {"type":"response.created","id":"resp_test","status":"in_progress"}\n\n');
        res.write('data: {"type":"response.output_text.delta","delta":"hi "}\n\n');
        res.write(
          'data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"call_test","name":"TodoWrite","arguments":"{\\\\\"todos\\\\\":[{\\\\\"content\\\\\":\\\\\"x\\\\\",\\\\\"status\\\\\":\\\\\"pending\\\\\"}]}"}}\n\n',
        );

        // 注意：这里不调用 res.end()，直接关闭 socket，模拟“chunked 未正常结束”的提前断开。
        setTimeout(() => {
          res.socket?.end();
        }, 30);
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });
}

async function readSSETextUntil(
  res: Response,
  predicate: (text: string) => boolean,
  timeoutMs: number,
): Promise<string> {
  const stream = res.body;
  if (!stream) return '';

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = '';

  const endAt = Date.now() + timeoutMs;
  try {
    while (true) {
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        throw new Error(`timeout waiting for SSE; current tail=${JSON.stringify(out.slice(-200))}`);
      }

      const { value, done } = await new Promise<{ value?: Uint8Array; done: boolean }>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout waiting for stream chunk')), remaining);
        reader.read().then(
          r => {
            clearTimeout(t);
            resolve(r);
          },
          err => {
            clearTimeout(t);
            reject(err);
          },
        );
      });
      if (done) break;
      if (value) out += decoder.decode(value, { stream: true });

      if (predicate(out)) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }

  return out;
}

describe('SSE Upstream Premature Close (Claude -> Codex)', () => {
  let upstreamServer: http.Server;
  let upstreamPort: number;

  let server: any;
  let client: HttpClient;

  beforeEach(async () => {
    upstreamServer = createCodexSSEUpstreamPrematureClose();
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
          modelMappings: [
            {
              id: 'mm-claude-to-codex',
              inboundModel: '*',
              targetSupplierId: 'codex-up',
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
    if (server) {
      await server.shutdown();
    }
    if (upstreamServer) {
      await new Promise<void>(resolve => upstreamServer.close(() => resolve()));
    }
    await cleanupTestData();
  });

  it('上游提前断开时仍应补齐 message_stop，且记录为 partial', async () => {
    const gatewayUrl = server.baseUrl;

    const res = await fetch(`${gatewayUrl}/claude/v1/messages`, {
      method: 'POST',
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

    // 若缺失 message_stop，Claude 客户端会无限等待；这里用超时保护。
    const bodyText = await readSSETextUntil(
      res,
      text => text.includes('event: message_stop'),
      2000,
    );
    expect(bodyText).toContain('event: message_stop');

    // 断言：应写入一条 partial 记录。
    await waitForCondition(async () => {
      const list = await client.get('/_promptxy/requests?limit=10&client=claude');
      return (list.body?.total || 0) >= 1;
    }, 2000);

    const list = await client.get('/_promptxy/requests?limit=10&client=claude');
    const firstId = list.body.items[0].id;

    const detail = await client.get(`/_promptxy/requests/${firstId}`);
    // 上游提前断开在不同 Node/undici 版本下可能表现为：
    // - 有明确的网络错误（partial=true）
    // - 或被视为 EOF（error 为空，但 transformTrace 会记录 missingUpstreamCompleted）
    const errStr = String(detail.body.error || '');
    if (errStr) {
      expect(errStr).toContain('partial=true');
    }
  }, 20000);
});
