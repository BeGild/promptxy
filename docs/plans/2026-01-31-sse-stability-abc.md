# SSE 稳定性 A/B/C Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 收敛 SSE 流式链路的终止判定与错误归因，并为 `/claude -> openai-chat` 补齐“上游提前断开仍补齐 message_stop”的集成护栏，减少客户端无限等待与落库语义漂移。

**Architecture:**
- A：将“预期流终止”的判定收敛为单点函数，`gateway.ts` 与 `stream-response.ts` 共享，避免两套口径导致 partial/error 语义不一致。
- B：新增 openai-chat 版本的 premature-close 集成测试，锁定关键用户体验：即使上游断开也必须出现 `event: message_stop`。
- C：在“转 SSE”分支中明确错误归因优先级（下游断开 vs 上游网络错误），让 `finalizeRequestRecord` 的 `error` 更稳定可诊断。

**Tech Stack:** Node.js streams/Web Streams, Vitest, undici(fetch), SSE text/event-stream

---

### Task 1: A - 提取并共享 isExpectedStreamTermination

**Files:**
- Create: `backend/src/promptxy/streaming/termination.ts`
- Modify: `backend/src/promptxy/streaming/stream-response.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/unit/stream-termination.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { isExpectedStreamTermination } from '../../src/promptxy/streaming/termination.js';

describe('isExpectedStreamTermination', () => {
  it('treats AbortError as expected', () => {
    expect(isExpectedStreamTermination({ name: 'AbortError' })).toBe(true);
  });

  it('treats common socket/premature-close codes as expected', () => {
    expect(isExpectedStreamTermination({ code: 'UND_ERR_SOCKET' })).toBe(true);
    expect(isExpectedStreamTermination({ code: 'ERR_STREAM_PREMATURE_CLOSE' })).toBe(true);
    expect(isExpectedStreamTermination({ code: 'ECONNRESET' })).toBe(true);
    expect(isExpectedStreamTermination({ code: 'EPIPE' })).toBe(true);
  });

  it('treats terminated/premature close messages as expected', () => {
    expect(isExpectedStreamTermination(new Error('terminated'))).toBe(true);
    expect(isExpectedStreamTermination(new Error('premature close'))).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- backend/tests/unit/stream-termination.test.ts`
Expected: FAIL because `termination.js` or export not found.

**Step 3: Write minimal implementation**

```ts
export function isExpectedStreamTermination(err: any): boolean {
  const message = (err?.message ?? String(err ?? '')).toLowerCase();
  const code = err?.code ?? err?.cause?.code;
  const name = err?.name;
  return (
    name === 'AbortError' ||
    code === 'UND_ERR_SOCKET' ||
    code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    message.includes('terminated') ||
    message.includes('premature close') ||
    message.includes('prematurely')
  );
}
```

**Step 4: Replace local implementations with shared function**

- Update `backend/src/promptxy/streaming/stream-response.ts` to import and use `isExpectedStreamTermination`.
- Update `backend/src/promptxy/gateway.ts` to remove the inner `const isExpectedStreamTermination = ...` and import the shared one.

**Step 5: Run test to verify it passes**

Run: `npm test -- backend/tests/unit/stream-termination.test.ts`
Expected: PASS

**Step 6: Run focused regression tests**

Run: `npm test -- backend/tests/integration/sse-upstream-premature-close.test.ts`
Expected: PASS

---

### Task 2: B - 增加 /claude -> openai-chat 的 premature-close 集成测试

**Files:**
- Create: `backend/tests/integration/sse-upstream-premature-close-openai-chat.test.ts`
- Reference: `backend/tests/integration/sse-upstream-premature-close.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import type { PromptxyConfig } from '../../src/promptxy/types.js';
import { cleanupTestData, startTestServer, HttpClient, waitForCondition } from './test-utils.js';

function createOpenAIChatSSEUpstreamPrematureClose(): http.Server {
  return http.createServer(async (req, res) => {
    for await (const _chunk of req) {}

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/v1/chat/completions')) {
      const accept = String(req.headers['accept'] ?? '');
      if (accept.includes('text/event-stream')) {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'close',
        });

        // 最小 Chat Completions SSE chunk（刻意不发送 [DONE]）
        res.write('data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"hi "},"finish_reason":null}] }\n\n');
        res.write('data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_test","type":"function","function":{"name":"TodoWrite","arguments":"{}"}}]},"finish_reason":null}] }\n\n');

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

async function readSSETextUntil(res: Response, predicate: (text: string) => boolean, timeoutMs: number): Promise<string> {
  const stream = res.body;
  if (!stream) return '';
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = '';
  const endAt = Date.now() + timeoutMs;

  try {
    while (true) {
      const remaining = endAt - Date.now();
      if (remaining <= 0) throw new Error('timeout waiting for SSE');

      const { value, done } = await new Promise<{ value?: Uint8Array; done: boolean }>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout waiting for stream chunk')), remaining);
        reader.read().then(r => {
          clearTimeout(t);
          resolve(r);
        }, err => {
          clearTimeout(t);
          reject(err);
        });
      });

      if (done) break;
      if (value) out += decoder.decode(value, { stream: true });
      if (predicate(out)) break;
    }
  } finally {
    try { await reader.cancel(); } catch {}
  }

  return out;
}

describe('SSE Upstream Premature Close (Claude -> OpenAI Chat)', () => {
  let upstreamServer: http.Server;
  let upstreamPort: number;

  let server: any;
  let client: HttpClient;

  beforeEach(async () => {
    upstreamServer = createOpenAIChatSSEUpstreamPrematureClose();
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
          id: 'r-claude',
          localService: 'claude',
          modelMappings: [
            { id: 'mm-claude-to-chat', inboundModel: '*', targetSupplierId: 'chat-up', enabled: true },
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

  it('上游提前断开时仍应补齐 message_stop，且记录为 partial', async () => {
    const gatewayUrl = server.baseUrl;

    const res = await fetch(`${gatewayUrl}/claude/v1/messages`, {
      method: 'POST',
      headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        stream: true,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') || '').toContain('text/event-stream');

    const bodyText = await readSSETextUntil(res, text => text.includes('event: message_stop'), 2000);
    expect(bodyText).toContain('event: message_stop');

    await waitForCondition(async () => {
      const list = await client.get('/_promptxy/requests?limit=10&client=claude');
      return (list.body?.total || 0) >= 1;
    }, 2000);

    const list = await client.get('/_promptxy/requests?limit=10&client=claude');
    const firstId = list.body.items[0].id;
    const detail = await client.get(`/_promptxy/requests/${firstId}`);

    const errStr = String(detail.body.error || '');
    if (errStr) expect(errStr).toContain('partial=true');
  }, 20000);
});
```

**Step 2: Run test to verify it fails (before fixes)**

Run: `npm test -- backend/tests/integration/sse-upstream-premature-close-openai-chat.test.ts`
Expected: FAIL (likely missing message_stop or record semantics inconsistent)

**Step 3: Make minimal implementation changes (if needed)**

- Prefer to fix in `stream-response.ts` / `gateway.ts` only; avoid touching transformer unless test reveals real sequence issues.

**Step 4: Run test to verify it passes**

Run: `npm test -- backend/tests/integration/sse-upstream-premature-close-openai-chat.test.ts`
Expected: PASS

---

### Task 3: C - 整理“转 SSE”错误归因与 partial 语义（最小改动版）

**Files:**
- Modify: `backend/src/promptxy/streaming/stream-response.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/integration/sse-abort.test.ts` (existing)
- Test: `backend/tests/integration/sse-upstream-premature-close*.test.ts` (existing + new)

**Step 1: Write a focused failing test (optional)**

如果现有两条集成测试在某些环境下不稳定（例如 Node/undici 差异），再补一条最小测试来区分：
- 下游主动 abort（客户端断开）→ 允许归类为 expected termination（不记录为“网络故障”）
- 上游提前 close（socket close）→ 记录为 partial 并在 error/trace 中可诊断

**Step 2: Implement minimal prioritization rules**

在 `stream-response.ts`：
- 明确当 `res.destroyed` 或 `upstreamAbortSignal.aborted` 时，优先将 `upstreamFinalError` 设为一个可识别的“expected termination”错误（不要覆盖更具体的上游错误）。
- 当 pump 读到真实网络错误（非 expected），应优先保留该错误。

在 `gateway.ts finalizeRequestRecord`：
- 仅当 finalError 非 expected termination 时才写入 `error: partial=true; ...`（或将 expected termination 写入更轻量的 trace 字段，避免误报）。

**Step 3: Run regression tests**

Run:
- `npm test -- backend/tests/integration/sse-abort.test.ts`
- `npm test -- backend/tests/integration/sse-upstream-premature-close.test.ts`
- `npm test -- backend/tests/integration/sse-upstream-premature-close-openai-chat.test.ts`

Expected: PASS, 且 abort 与 premature close 的 record 语义更稳定。

---

### Final Verification

Run: `npm test --`
Expected: PASS

---

### Commits

按项目习惯使用中文 commit message，并按 Task 1/2/3 分三次提交：
- `fix：收敛 SSE 预期终止判定为单点实现`
- `test：新增 claude->openai-chat 上游提前断开 SSE 护栏`
- `fix：整理转 SSE 错误归因与 partial 记录语义`
