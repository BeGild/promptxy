# Gateway RequestPipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在保持外部行为不变的前提下，将 `backend/src/promptxy/gateway.ts` 重构为“可测试、可回滚”的 RequestPipeline（步骤化处理链路），降低单文件复杂度并统一关键边界（路由/规则/转换/上游/流式/记录）。

**Architecture:** 引入显式的 `GatewayContext` 与 `runPipeline()`，把现有逻辑按固定步骤（parse/auth/route/rules/transform/upstream/response/record）迁移到独立模块；每次只迁移一个边界并用单测/集成测试锁定行为。

**Tech Stack:** Node.js + TypeScript（ESM）；测试使用 Vitest（`backend/vitest.config.ts` 与 integration config）；网关与 transformer 逻辑位于 `backend/src/promptxy/*`。

---

## 0. 前置约束（必须遵守）

- **任何代码修改前必须方案 review 通过**：本文件与设计稿 `docs/plans/2026-01-31-gateway-pipeline-design.md` 需先 review 通过，才进入执行阶段。
- **渐进式、小提交粒度**：每个 Task 拆成 2–5 分钟级别步骤；每个 Task 结束必须可回滚。
- **行为不变优先**：默认不改变对外 API、状态码、SSE 事件语义、header 策略、落库字段。
- **转换器范围不扩展**：只保证 `/claude -> 任意供应商` 的转换链路；`/codex` 与 `/gemini` 入口保持透明转发。

---

## 1. 参考与基线

**参考设计稿：**
- `docs/plans/2026-01-31-gateway-pipeline-design.md`

**关键现状文件（执行时频繁对照）：**
- `backend/src/promptxy/gateway.ts`
- `backend/src/promptxy/api-handlers.ts`
- `backend/src/promptxy/streaming/stream-response.ts`
- `backend/src/promptxy/proxying/execute-upstream.ts`
- `backend/src/promptxy/routing/*`（已有 `derive-route-plan` 入口）
- `backend/src/promptxy/transform/*`（已有 `derive-transform-plan` 入口）

**基线验证（执行阶段每个大 Task 后都跑）：**
- Run: `npm test`
- Expected: `308 passed`（以当时基线为准，至少全绿）

---

### Task 1: 固化“行为不变”护栏（新增/补强测试用例）

**Files:**
- Modify: `backend/tests/unit/gateway-routing-compat.test.ts`
- Modify: `backend/tests/integration/*`（仅在缺覆盖时新增）

**Step 1: 盘点已有护栏与覆盖点**
Run: `ls -la backend/tests/unit backend/tests/integration`
Expected: 能看到现有 gateway / probes / sse 相关测试（例如 `gateway-rules-apply-once`、`sse-abort`、`gateway-routing-errors`）。

**Step 2: 将“占位测试”升级为明确断言（先让它 FAIL）**
Modify `backend/tests/unit/gateway-routing-compat.test.ts`：
- 用 table-driven cases 覆盖 3 类：
  1) `/claude` + modelMappings 命中 openai-codex
  2) `/claude` + modelMappings 命中 gemini
  3) `/codex` 或 `/gemini` 入口（应保持 transformer=none 的直通语义）

示例结构（按现有测试风格调整 import 路径）：
```ts
import { describe, it, expect } from 'vitest';

describe('gateway routing compat', () => {
  it('produces stable route decisions for representative cases', () => {
    const cases = [
      { name: 'claude->openai-codex', expectedTransformer: 'codex' },
      { name: 'claude->gemini', expectedTransformer: 'gemini' },
    ];

    for (const c of cases) {
      expect(c.expectedTransformer).toBe('__TODO__');
    }
  });
});
```

**Step 3: 运行测试确认失败**
Run: `npm test -- backend/tests/unit/gateway-routing-compat.test.ts`
Expected: FAIL（明确告诉我们“接下来要实现/抽取什么”）。

**Step 4: Commit（只提交护栏增强，不包含实现）**
```bash
git add backend/tests/unit/gateway-routing-compat.test.ts
git commit -m "测试：增强网关路由兼容性护栏（明确断言）"
```

---

### Task 2: 引入 GatewayContext / GatewayError（只定义契约与最小工具）

**Files:**
- Create: `backend/src/promptxy/gateway-pipeline/context.ts`
- Test: `backend/tests/unit/gateway-pipeline-context.test.ts`

**Step 1: 写 failing test（先确保模块可导入）**
Create `backend/tests/unit/gateway-pipeline-context.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import type { GatewayContext, GatewayError } from '../../src/promptxy/gateway-pipeline/context';

describe('gateway pipeline context', () => {
  it('exports GatewayContext/GatewayError types', () => {
    const x: GatewayContext | GatewayError | null = null;
    expect(x).toBe(null);
  });
});
```

**Step 2: 运行测试确认失败（module not found）**
Run: `npm test -- backend/tests/unit/gateway-pipeline-context.test.ts`
Expected: FAIL

**Step 3: 写最小实现（类型 + 枚举/构造器，不改业务行为）**
Create `backend/src/promptxy/gateway-pipeline/context.ts`（示意，执行时按实际需要微调）：
```ts
export type GatewayErrorCategory =
  | 'parse'
  | 'auth'
  | 'routing'
  | 'rules'
  | 'transform'
  | 'proxying'
  | 'streaming'
  | 'recording';

export class GatewayError extends Error {
  category: GatewayErrorCategory;
  status: number;
  code: string;
  meta?: Record<string, unknown>;

  constructor(input: { category: GatewayErrorCategory; status: number; code: string; message: string; meta?: Record<string, unknown> }) {
    super(input.message);
    this.category = input.category;
    this.status = input.status;
    this.code = input.code;
    this.meta = input.meta;
  }
}

export type GatewayContext = {
  req: any;
  res: any;
  startTime: number;
  url?: URL;
  method?: string;

  // parsed/request
  originalBodyBuffer?: Buffer;
  bodyBuffer?: Buffer;
  jsonBody?: any;

  // routing/transform
  routeMatch?: any;
  routePlan?: any;
  transformerChain?: string[];
  transformTrace?: any;

  // rules
  matches?: any[];
  warnings?: string[];

  // upstream/response
  upstreamUrl?: string;
  upstreamResponse?: Response;
};
```

**Step 4: 运行测试确认通过**
Run: `npm test -- backend/tests/unit/gateway-pipeline-context.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/promptxy/gateway-pipeline/context.ts backend/tests/unit/gateway-pipeline-context.test.ts
git commit -m "重构：引入 GatewayContext/GatewayError 作为 pipeline 契约"
```

---

### Task 3: 引入 runPipeline 框架（空跑，不迁移业务）

**Files:**
- Create: `backend/src/promptxy/gateway-pipeline/pipeline.ts`
- Test: `backend/tests/unit/gateway-pipeline-pipeline.test.ts`

**Step 1: 写 failing test（pipeline 可调用且按顺序执行 steps）**
Create `backend/tests/unit/gateway-pipeline-pipeline.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import { runPipeline } from '../../src/promptxy/gateway-pipeline/pipeline';

describe('gateway pipeline', () => {
  it('runs steps in order', async () => {
    const calls: string[] = [];
    const ctx: any = { startTime: Date.now() };

    await runPipeline(ctx, [
      async c => { calls.push('a'); return c; },
      async c => { calls.push('b'); return c; },
    ]);

    expect(calls).toEqual(['a', 'b']);
  });
});
```

**Step 2: 运行测试确认失败（module not found）**
Run: `npm test -- backend/tests/unit/gateway-pipeline-pipeline.test.ts`
Expected: FAIL

**Step 3: 写最小实现**
Create `backend/src/promptxy/gateway-pipeline/pipeline.ts`：
```ts
import type { GatewayContext } from './context';

export type PipelineStep = (ctx: GatewayContext) => Promise<GatewayContext>;

export async function runPipeline(ctx: GatewayContext, steps: PipelineStep[]): Promise<GatewayContext> {
  let current = ctx;
  for (const step of steps) {
    current = await step(current);
  }
  return current;
}
```

**Step 4: 运行测试确认通过**
Run: `npm test -- backend/tests/unit/gateway-pipeline-pipeline.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/promptxy/gateway-pipeline/pipeline.ts backend/tests/unit/gateway-pipeline-pipeline.test.ts
git commit -m "重构：新增 runPipeline 框架（不改变网关行为）"
```

---

### Task 4: 迁移 Step: parseRequest（只搬读 body / JSON 判断）

**Files:**
- Create: `backend/src/promptxy/gateway-pipeline/steps/parse-request.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/unit/gateway-pipeline-parse-request.test.ts`

**Step 1: 写 failing test（parseRequest 能把 body/jsonBody 写入 ctx）**
Create `backend/tests/unit/gateway-pipeline-parse-request.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import { parseRequest } from '../../src/promptxy/gateway-pipeline/steps/parse-request';

describe('parseRequest', () => {
  it('parses JSON body when content-type is json', async () => {
    const ctx: any = {
      req: { method: 'POST', headers: { 'content-type': 'application/json' } },
      startTime: Date.now(),
    };

    // 执行时用最小 mock：让 parseRequest 可注入 readRequestBody
    expect(typeof parseRequest).toBe('function');
    await parseRequest(ctx as any);
  });
});
```

**Step 2: 运行测试确认失败**
Run: `npm test -- backend/tests/unit/gateway-pipeline-parse-request.test.ts`
Expected: FAIL

**Step 3: 实现 parseRequest（建议通过依赖注入便于测试）**
Create `backend/src/promptxy/gateway-pipeline/steps/parse-request.ts`：
```ts
import { readRequestBody, shouldParseJson } from '../../http.js';
import type { GatewayContext } from '../context';

export async function parseRequest(ctx: GatewayContext): Promise<GatewayContext> {
  const method = (ctx.req?.method || 'unknown') as string;
  ctx.method = method;

  const expectsBody = method !== 'GET' && method !== 'HEAD';
  if (!expectsBody) return ctx;

  const bodyBuffer = await readRequestBody(ctx.req, { maxBytes: 20 * 1024 * 1024 });
  ctx.bodyBuffer = bodyBuffer;
  ctx.originalBodyBuffer = ctx.originalBodyBuffer ?? bodyBuffer;

  const contentType = ctx.req?.headers?.['content-type'];
  const ct = Array.isArray(contentType) ? contentType[0] : contentType;
  if (shouldParseJson(ct)) {
    try {
      ctx.jsonBody = JSON.parse(bodyBuffer.toString('utf-8'));
    } catch {
      ctx.jsonBody = undefined;
    }
  }

  return ctx;
}
```

**Step 4: 调整测试：用最小 http req mock 或者改为注入 readRequestBody（推荐）**
- 若选择注入：把 `parseRequest` 改成 `createParseRequest({ readRequestBody, shouldParseJson })`。

**Step 5: 接入 gateway.ts（只替换对应片段，不动其他逻辑）**
Modify `backend/src/promptxy/gateway.ts`：
- 在现有读 body 的位置，调用 `parseRequest(ctx)` 并从 ctx 取 `jsonBody/bodyBuffer`。

**Step 6: 运行相关单测与全量单测**
Run: `npm test -- backend/tests/unit/gateway-pipeline-parse-request.test.ts`
Expected: PASS
Run: `npm test`
Expected: PASS

**Step 7: Commit**
```bash
git add backend/src/promptxy/gateway-pipeline/steps/parse-request.ts backend/src/promptxy/gateway.ts backend/tests/unit/gateway-pipeline-parse-request.test.ts
git commit -m "重构：抽出 parseRequest 步骤并接入网关"
```

---

### Task 5: 迁移 Step: authInbound（网关入站鉴权与清理头）

**Files:**
- Create: `backend/src/promptxy/gateway-pipeline/steps/auth-inbound.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/unit/gateway-pipeline-auth-inbound.test.ts`

**Step 1: 写 failing test：鉴权失败返回 401（或抛出 GatewayError）**
Create `backend/tests/unit/gateway-pipeline-auth-inbound.test.ts`：
- 覆盖 enabled/disabled 两种 config
- 失败时断言 `GatewayError{status:401}`

**Step 2: 运行测试确认失败**
Run: `npm test -- backend/tests/unit/gateway-pipeline-auth-inbound.test.ts`
Expected: FAIL

**Step 3: 写最小实现（复用现有 authenticateRequest/clearAuthHeaders）**
- 用 `GatewayError` 统一失败模型

**Step 4: gateway.ts 接入（只替换鉴权块）**

**Step 5: 运行单测 + 全量**
Run: `npm test -- backend/tests/unit/gateway-pipeline-auth-inbound.test.ts`
Expected: PASS
Run: `npm test`
Expected: PASS

**Step 6: Commit**
```bash
git add backend/src/promptxy/gateway-pipeline/steps/auth-inbound.ts backend/src/promptxy/gateway.ts backend/tests/unit/gateway-pipeline-auth-inbound.test.ts
git commit -m "重构：抽出 authInbound 步骤并统一错误模型"
```

---

### Task 6: 统一路由来源：resolveRoutePlan（先“并行对照”，后“替换旧逻辑”）

**Files:**
- Create: `backend/src/promptxy/gateway-pipeline/steps/resolve-route.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Modify: `backend/tests/unit/gateway-routing-compat.test.ts`

**Step 1: 让 Task1 的路由护栏以 `deriveRoutePlan` 为主断言**
- 将断言从占位改为调用 routing 模块（`backend/src/promptxy/routing/derive-route-plan.ts`）

**Step 2: 运行测试确认失败（如果 deriveRoutePlan 还未满足这些 case）**
Run: `npm test -- backend/tests/unit/gateway-routing-compat.test.ts`
Expected: FAIL

**Step 3: 实现/补齐 routing 决策（最小实现让测试通过）**
- 只做纯决策，不引入 fetch/IO

**Step 4: 新增 resolve-route step（把 ctx.jsonBody 摘要喂给 routing，回填 ctx.routePlan 与 routeInfo）**

**Step 5: gateway.ts 引入“对照模式”（仅 debug 日志，不影响对外）**
- 保留旧路径产物，但输出新旧 plan 的差异到 debug（不要改变响应）。

**Step 6: 跑全量测试**
Run: `npm test`
Expected: PASS

**Step 7: Commit**
```bash
git add backend/src/promptxy/gateway-pipeline/steps/resolve-route.ts backend/src/promptxy/gateway.ts backend/tests/unit/gateway-routing-compat.test.ts
git commit -m "重构：引入 resolveRoutePlan 步骤并以测试锁定路由行为"
```

---

### Task 7: 抽出规则应用策略：applyRules（把“避免重复应用”收敛成单点）

**Files:**
- Create: `backend/src/promptxy/gateway-pipeline/steps/apply-rules.ts`
- Test: `backend/tests/unit/gateway-pipeline-apply-rules.test.ts`
- Modify: `backend/src/promptxy/gateway.ts`

**Step 1: 写 failing test：Claude 跨协议仅应用一次（复用现有集成护栏语义）**
- 单测只验证“是否调用 mutateXxxBody”与 matches 计数（通过依赖注入/spy）

**Step 2: 实现 applyRules（明确策略函数 shouldApplyRules(ctx)）**
- 策略建议只基于：localService、transformer 是否为 none、当前 client

**Step 3: gateway.ts 接入（替换散落的 mutate 分支）**

**Step 4: 跑全量测试（重点关注现有 integration：rules apply once / probes）**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/promptxy/gateway-pipeline/steps/apply-rules.ts backend/src/promptxy/gateway.ts backend/tests/unit/gateway-pipeline-apply-rules.test.ts
git commit -m "重构：抽出 applyRules 单点策略并避免重复应用"
```

---

### Task 8: 迁移 transformRequest / executeUpstream / handleResponse（按边界逐个搬）

> 这三个步骤风险最高（流式/终止/落库），必须严格小步迁移，并依赖现有 integration tests（`sse-abort`、`sse-upstream-premature-close`、`e2e-flow`）。

**Files:**
- Create: `backend/src/promptxy/gateway-pipeline/steps/transform-request.ts`
- Create: `backend/src/promptxy/gateway-pipeline/steps/execute-upstream.ts`
- Create: `backend/src/promptxy/gateway-pipeline/steps/handle-response.ts`
- Modify: `backend/src/promptxy/gateway.ts`

**Step 1: 先迁移 transformRequest（仅 Claude 跨协议分支）并跑 e2e-flow**
Run: `npm test -- backend/tests/integration/e2e-flow.test.ts`
Expected: PASS

**Step 2: 再迁移 executeUpstream（薄封装现有 `proxying/execute-upstream.ts`）并跑 proxying-smoke**
Run: `npm test -- backend/tests/integration/gateway-proxying-smoke.test.ts`
Expected: PASS

**Step 3: 最后迁移 handleResponse（SSE 透传/转换写回）并跑 sse-abort 与 premature-close**
Run: `npm test -- backend/tests/integration/sse-abort.test.ts`
Run: `npm test -- backend/tests/integration/sse-upstream-premature-close.test.ts`
Expected: PASS

**Step 4: 每迁移一个步骤都提交一次**
示例：
```bash
git add backend/src/promptxy/gateway-pipeline/steps/transform-request.ts backend/src/promptxy/gateway.ts
git commit -m "重构：抽出 transformRequest 步骤并保持跨协议行为一致"
```

---

### Task 9: 收尾：gateway.ts 退化为“HTTP 适配 + pipeline 编排”

**Files:**
- Modify: `backend/src/promptxy/gateway.ts`
- Modify: `docs/architecture.md`（可选：补充 pipeline 边界说明）

**Step 1: 删除过渡期对照代码与重复函数（保持行为不变）**

**Step 2: 全量测试**
Run: `npm test`
Expected: PASS

**Step 3: Commit**
```bash
git add backend/src/promptxy/gateway.ts docs/architecture.md
git commit -m "重构：网关切换为 RequestPipeline 并清理过渡代码"
```

---

## 执行后交付物

- 新目录：`backend/src/promptxy/gateway-pipeline/*`（context/pipeline/steps）
- `backend/src/promptxy/gateway.ts` 显著瘦身（只剩 HTTP 适配与 pipeline steps 组装）
- 单测与既有 integration 测试全绿，确保对外行为不变
