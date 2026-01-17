# OpenAI Chat Completions 转换器（Claude → OpenAI /chat/completions）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Promptxy 中新增 Claude `/claude/v1/messages` → OpenAI `/chat/completions` 的协议转换，并将原 `/responses` 供应商协议重命名为 `OpenaiCodex(openai-codex)`，新增 `Openai(openai-chat)` 供应商。

**Architecture:** 以 `/claude` 为唯一“需要跨协议转换”的入口；通过将 `Supplier.protocol` 拆分为 `openai-codex` 与 `openai-chat`，在网关层稳定选择转换链。TransformerEngine 新增 `claude-to-openai-chat` 请求/响应转换与 `openai-chat SSE → claude SSE` 状态机。

**Tech Stack:** Node.js (fetch/undici), TypeScript, Vitest, OpenSpec

---

## 约束与决策（落地到实现）

- **工具调用必须完整支持（A）**：Claude `tools/tool_use/tool_result` ↔ OpenAI Chat `tools/tool_calls` 双向映射，含流式 `tool_calls[*].function.arguments` 增量拼接。
- **tool_choice 映射**：Claude `any → OpenAI auto`。
- **开发阶段允许破坏性变更**：不兼容旧配置；`Supplier.protocol: 'openai'` 不再接受，用户手动更新配置。
- **供应商命名**：
  - `openai-codex`：`OpenaiCodex`
  - `openai-chat`：`Openai`

---

### Task 1: 创建 OpenSpec 变更提案（先过 review 再改代码）

**Files:**
- Create: `openspec/changes/add-openai-chat-completions-support/proposal.md`
- Create: `openspec/changes/add-openai-chat-completions-support/tasks.md`
- Create: `openspec/changes/add-openai-chat-completions-support/specs/claude-openai-chat-transformation/spec.md`
- Modify (delta): `openspec/changes/add-openai-chat-completions-support/specs/promptxy-gateway/spec.md`

**Step 1: 列出现有 specs 和 changes，避免重复**

Run: `openspec list --specs && openspec list`
Expected: 输出包含现有 `claude-codex-transformation`、`promptxy-gateway` 等 specs。

**Step 2: 创建 change 目录结构**

Run: `mkdir -p openspec/changes/add-openai-chat-completions-support/specs/{claude-openai-chat-transformation,promptxy-gateway}`
Expected: 目录创建成功。

**Step 3: 写 proposal.md（Why/What/Impact，明确破坏性变更）**

Create `openspec/changes/add-openai-chat-completions-support/proposal.md`：

```md
# Change: 增加 OpenAI Chat Completions 协议转换支持

## Why

项目演进需要对接 OpenAI `/chat/completions` 协议，以便 Claude Code 通过 `/claude` 使用支持该协议的供应商。

## What Changes

- 新增 Claude Messages → OpenAI Chat Completions 的转换（请求/非流式响应/流式 SSE）
- 将 OpenAI 供应商协议拆分为：`openai-codex`（/responses）与 `openai-chat`（/chat/completions）
- 更新默认供应商命名：OpenaiCodex / Openai
- **BREAKING**：不再接受旧 `Supplier.protocol: openai`（开发阶段不兼容旧配置）

## Impact

- Affected specs: `claude-openai-chat-transformation`, `promptxy-gateway`
- Affected code (planned): `backend/src/promptxy/types.ts`, `backend/src/promptxy/config.ts`, `backend/src/promptxy/gateway.ts`, `backend/src/promptxy/transformers/**`, `frontend/src/**`
```

**Step 4: 写 spec delta（claude-openai-chat-transformation）**

Create `openspec/changes/add-openai-chat-completions-support/specs/claude-openai-chat-transformation/spec.md`：

```md
## ADDED Requirements

### Requirement: Claude → OpenAI Chat Request Transformation

The system SHALL transform Claude Messages API requests into OpenAI Chat Completions request format.

#### Scenario: Map system to OpenAI system message
- **WHEN** Claude request contains `system`
- **THEN** OpenAI request includes a `role=system` message with equivalent text

#### Scenario: Map tools to OpenAI tools
- **WHEN** Claude request includes `tools` with `input_schema`
- **THEN** OpenAI request includes `tools[].type=function` and `function.parameters` derived from `input_schema`

#### Scenario: Map tool_choice any to auto
- **WHEN** Claude tool_choice is `any`
- **THEN** OpenAI tool_choice is `auto`

### Requirement: OpenAI Chat → Claude Response Transformation

The system SHALL transform OpenAI Chat Completions responses into Claude Messages API responses.

#### Scenario: Map assistant content to Claude text block
- **WHEN** OpenAI response contains `choices[0].message.content`
- **THEN** Claude response contains `content[0].type=text` with same text

#### Scenario: Map tool_calls to tool_use blocks
- **WHEN** OpenAI response contains `choices[0].message.tool_calls`
- **THEN** Claude response contains `tool_use` blocks preserving `id` and `name`

### Requirement: SSE Event Transformation

The system SHALL transform OpenAI Chat streaming events into Claude SSE events.

#### Scenario: Emit message_start and content_block_start
- **WHEN** the first OpenAI SSE delta is received
- **THEN** the system emits Claude `message_start` and `content_block_start`

#### Scenario: Incrementally append tool_calls arguments
- **WHEN** OpenAI SSE emits incremental `delta.tool_calls[*].function.arguments`
- **THEN** the system emits Claude `input_json_delta` with `partial_json` segments in order

#### Scenario: Map finish_reason
- **WHEN** OpenAI finish_reason is `tool_calls`
- **THEN** Claude stop_reason is `tool_use`
- **WHEN** OpenAI finish_reason is `stop`
- **THEN** Claude stop_reason is `end_turn`
- **WHEN** OpenAI finish_reason is `length`
- **THEN** Claude stop_reason is `max_tokens`
```

**Step 5: 写 promptxy-gateway delta（协议拆分可配置/可观测）**

Create `openspec/changes/add-openai-chat-completions-support/specs/promptxy-gateway/spec.md`：

```md
## MODIFIED Requirements

### Requirement: Provider Route Mapping

The system SHALL expose distinct route prefixes for each supported provider so clients can configure base URLs without protocol-level MITM.

#### Scenario: Provider prefixes are available
- **WHEN** a client is configured to use the gateway for a provider
- **THEN** it can target a stable local prefix for that provider (e.g., `/codex`, `/gemini`)

#### Scenario: Claude route can target OpenAI Chat suppliers
- **WHEN** the `/claude` route selects a supplier with protocol `openai-chat`
- **THEN** the gateway uses `/chat/completions` upstream path via protocol transformation
```

**Step 6: 写 tasks.md（以 checklist 形式）**

Create `openspec/changes/add-openai-chat-completions-support/tasks.md`：

```md
## 1. Spec & Proposal
- [ ] 1.1 写 proposal.md（含 BREAKING 说明）
- [ ] 1.2 写 claude-openai-chat-transformation spec delta
- [ ] 1.3 写 promptxy-gateway spec delta
- [ ] 1.4 openspec validate 严格校验

## 2. Implementation
- [ ] 2.1 拆分 Supplier.protocol：openai-codex/openai-chat
- [ ] 2.2 更新默认配置与校验（config.ts）
- [ ] 2.3 新增 Claude→OpenAI Chat 请求转换
- [ ] 2.4 新增 OpenAI Chat→Claude 响应转换（非流式）
- [ ] 2.5 新增 OpenAI Chat SSE→Claude SSE 转换流
- [ ] 2.6 网关路由选择与图标映射更新
- [ ] 2.7 前端供应商协议下拉/展示更新
- [ ] 2.8 补齐集成测试与 fixtures

## 3. Verification
- [ ] 3.1 运行后端测试
- [ ] 3.2 运行 build
```

**Step 7: 严格校验 OpenSpec**

Run: `openspec validate add-openai-chat-completions-support --strict`
Expected: PASS（若失败，按报错修正 spec 格式/Scenario）。

**Step 8: 方案 review**

- 产出变更目录后，提交 PR/讨论让团队 review。
- **通过 review ��不要开始 Task 2+ 的代码修改**。

---

### Task 2: 拆分 Supplier.protocol（破坏性变更，不兼容旧配置）

**Files:**
- Modify: `backend/src/promptxy/types.ts`
- Modify: `backend/src/promptxy/config.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Modify (frontend types): `frontend/src/types/api.ts`

**Step 1: 写一个会失败的类型/校验测试（最小化）**

Modify `backend/tests/integration/gateway.test.ts`（或新建）添加：

```ts
import { describe, it, expect } from 'vitest';
import { assertSupplier } from '../../src/promptxy/config.js';

it('应拒绝旧 openai 协议字符串', () => {
  expect(() =>
    assertSupplier('s', {
      id: 's',
      name: 's',
      displayName: 's',
      baseUrl: 'https://api.openai.com/v1',
      protocol: 'openai',
      enabled: true,
      supportedModels: [],
    } as any),
  ).toThrow(/protocol/);
});
```

**Step 2: 运行测试确认失败**

Run: `npm test --silent -- --root backend -t "应拒绝旧 openai 协议字符串"`
Expected: FAIL（当前实现仍接受 `openai`）。

**Step 3: 修改 types.ts 协议枚举**

Update `backend/src/promptxy/types.ts`：

```ts
export interface Supplier {
  // ...
  protocol: 'anthropic' | 'openai-codex' | 'openai-chat' | 'gemini';
}
```

**Step 4: 修改 config.ts 校验与默认配置**

Update `backend/src/promptxy/config.ts`：

- `validProtocols` 改为 `['anthropic','openai-codex','openai-chat','gemini']`
- 默认 suppliers：
  - `openai-codex-official`：`displayName: 'OpenaiCodex'`，`baseUrl: 'https://api.openai.com/v1'`，`protocol: 'openai-codex'`
  - `openai-chat-official`：`displayName: 'Openai'`，`baseUrl: 'https://api.openai.com/v1'`，`protocol: 'openai-chat'`
- 默认 routes：
  - `/codex` route 的 `singleSupplierId` 指向 `openai-codex-official`

**Step 5: 修改 gateway.ts 的协议推导与图标映射**

Update `backend/src/promptxy/gateway.ts`：

- `deriveTransformer()`：
  - `openai-codex` → `codex`
  - `openai-chat` → `openai-chat`（新增 transformerName）
- `getSupplierClient()`：
  - `openai-codex` → `codex`
  - `openai-chat` → `codex`（如果 UI 只支持 3 类 client icon，可先复用 codex 图标；后续可加新图标）
- `/codex` 入口约束：只允许 `openai-codex`。

**Step 6: 运行测试确认通过**

Run: `npm test --silent -- --root backend -t "应拒绝旧 openai 协议字符串"`
Expected: PASS。

**Step 7: Commit（实现阶段执行）**

```bash
git add backend/src/promptxy/types.ts backend/src/promptxy/config.ts backend/src/promptxy/gateway.ts backend/tests/integration/gateway.test.ts
git commit -m "重构：拆分 OpenAI 供应商协议为 openai-codex/openai-chat"
```

---

### Task 3: 新增 OpenAI Chat 请求/响应转换（非流式）

**Files:**
- Create: `backend/src/promptxy/transformers/protocols/openai-chat/types.ts`
- Create: `backend/src/promptxy/transformers/protocols/openai-chat/request.ts`
- Create: `backend/src/promptxy/transformers/protocols/openai-chat/response.ts`
- Modify: `backend/src/promptxy/transformers/engine/engine.ts`

**Step 1: 写失败的 E2E 测试（/chat/completions 目标路径）**

Modify `backend/tests/integration/e2e-flow.test.ts`，新增用例：

```ts
it('应将 Claude /v1/messages 转为 OpenAI /chat/completions 并将响应转回 Claude 格式', async () => {
  // config.supplier.protocol = 'openai-chat'
  const res = await client.post('/claude/v1/messages', {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 32,
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'hi' }],
    tools: [
      {
        name: 'ping',
        description: 'ping tool',
        input_schema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'], additionalProperties: false },
      },
    ],
    tool_choice: { type: 'any' },
  });

  expect(res.status).toBe(200);
  expect(res.body.type).toBe('message');
  const captured = getCaptured();
  expect(captured.url).toBe('/chat/completions');
});
```

并在 `createMockUpstream()` 增加 `/chat/completions` 分支返回一个最小 OpenAI Chat completion JSON。

**Step 2: 跑测试确认失败**

Run: `npm test --silent -- --root backend -t "应将 Claude /v1/messages 转为 OpenAI /chat/completions"`
Expected: FAIL（当前没有 openai-chat transformer/pipeline）。

**Step 3: 实现最小 request transform（含 tools / tool_choice any→auto）**

Create `backend/src/promptxy/transformers/protocols/openai-chat/request.ts`：

```ts
export function transformClaudeToOpenAIChatRequest(body: any) {
  return {
    model: body.model,
    stream: Boolean(body.stream),
    messages: [
      ...(body.system ? [{ role: 'system', content: typeof body.system === 'string' ? body.system : JSON.stringify(body.system) }] : []),
      ...(body.messages || []).map((m: any) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
    ],
    tools: Array.isArray(body.tools)
      ? body.tools.map((t: any) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.input_schema },
        }))
      : undefined,
    tool_choice: body.tool_choice?.type === 'any' ? 'auto' : undefined,
  };
}
```

（后续在 Task 4/5 再把 tool_use/tool_result 的 message-level 映射补齐到 full fidelity。）

**Step 4: 在 TransformerEngine 接入新的 protocolPair**

Update `backend/src/promptxy/transformers/engine/engine.ts`：

- 扩展 `ProtocolPair`：增加 `'claude-to-openai-chat'`
- 在 `transform()` 中识别 `transformerName === 'openai-chat'`，走 `transformClaudeToOpenAIChat()`
- 返回 `path: '/chat/completions'`，并 `needsResponseTransform: true`

**Step 5: 实现最小 response transform（非流式 content）**

Create `backend/src/promptxy/transformers/protocols/openai-chat/response.ts`：

```ts
export function transformOpenAIChatResponseToClaude(parsed: any) {
  const msg = parsed?.choices?.[0]?.message;
  return {
    type: 'message',
    role: 'assistant',
    content: msg?.content ? [{ type: 'text', text: msg.content }] : [{ type: 'text', text: '' }],
  };
}
```

并在 engine 的 `transformResponse()` 中新增 `openai-chat` 分支调用。

**Step 6: 跑测试确认通过**

Run: `npm test --silent -- --root backend -t "应将 Claude /v1/messages 转为 OpenAI /chat/completions"`
Expected: PASS。

**Step 7: Commit（实现阶段执行）**

```bash
git add backend/src/promptxy/transformers/protocols/openai-chat backend/src/promptxy/transformers/engine/engine.ts backend/tests/integration/e2e-flow.test.ts backend/tests/integration/test-utils.ts
git commit -m "功能：新增 Claude→OpenAI Chat (/chat/completions) 非流式转换"
```

---

### Task 4: 完整 tools 双向映射（tool_use/tool_result ↔ tool_calls/tool messages）

**Files:**
- Modify: `backend/src/promptxy/transformers/protocols/openai-chat/request.ts`
- Modify: `backend/src/promptxy/transformers/protocols/openai-chat/response.ts`
- Test: `backend/tests/transformers/**`（新建或沿用 integration）

**Step 1: 写失败测试（tool_calls 返回应生成 tool_use）**

在 `backend/tests/integration/test-utils.ts` 的 `/chat/completions` mock 返回中加一个 tool_calls 示例，并在 E2E 测试断言 Claude 响应包含 `tool_use`。

**Step 2: 跑测试确认失败**

Run: `npm test --silent -- --root backend -t "tool_use"`
Expected: FAIL。

**Step 3: response.ts 实现 tool_calls → tool_use**

```ts
const toolCalls = msg?.tool_calls;
if (Array.isArray(toolCalls) && toolCalls.length) {
  return {
    type: 'message',
    role: 'assistant',
    content: toolCalls.map((tc: any) => ({
      type: 'tool_use',
      id: tc.id,
      name: tc.function?.name,
      input: JSON.parse(tc.function?.arguments || '{}'),
    })),
  };
}
```

**Step 4: request.ts 支持 tool_use/tool_result 的 message-level 映射**

- Claude assistant `tool_use` → OpenAI assistant message `tool_calls`（arguments = JSON.stringify(input)）
- Claude user/tool_result → OpenAI `role=tool` message（tool_call_id = tool_use_id）

**Step 5: 跑测试确认通过**

Run: `npm test --silent -- --root backend -t "tool_use"`
Expected: PASS。

**Step 6: Commit（实现阶段执行）**

```bash
git add backend/src/promptxy/transformers/protocols/openai-chat backend/tests/integration
git commit -m "功能：补齐 OpenAI Chat tools 映射（tool_calls/tool messages）"
```

---

### Task 5: OpenAI Chat SSE → Claude SSE 转换流（增量 tool_calls 拼接）

**Files:**
- Create: `backend/src/promptxy/transformers/protocols/openai-chat/sse/to-claude.ts`
- Modify: `backend/src/promptxy/transformers/index.ts`
- Test: `backend/tests/integration/sse-*.test.ts`（新增一个 openai-chat 流式测试）

**Step 1: 写失败的 SSE 集成测试**

新增 `backend/tests/integration/openai-chat-sse.test.ts`：
- mock upstream `/chat/completions` 返回 SSE：
  - `data: {"choices":[{"delta":{"content":"hi"}}]}`
  - `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"ping","arguments":"{\"q\":""}}]}}]}`
  - `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]}}],"finish_reason":"tool_calls"}`
  - `data: [DONE]`
- 断言下游返回的 Claude SSE 事件序列包含 `input_json_delta` 且 partial_json 顺序正确。

**Step 2: 跑测试确认失败**

Run: `npm test --silent -- --root backend -t "OpenAI Chat SSE"`
Expected: FAIL。

**Step 3: 实现 openai-chat SSE 状态机**

Create `backend/src/promptxy/transformers/protocols/openai-chat/sse/to-claude.ts`：
- 维护：
  - `started: boolean`
  - `textIndex: number`（默认 0）
  - `toolCallBuffers: Map<number, {id,name,argsText}>`
- 输入：解析后的 OpenAI SSE event（JSON）
- 输出：Claude SSE events（复用 `ClaudeSSEEvent` 类型结构）

**Step 4: 在 createSSETransformStream 接入 openai-chat**

Update `backend/src/promptxy/transformers/index.ts`：
- `if (transformerName === 'openai-chat') { ... }`
- 复用 `parseSSEChunk` 与 `serializeSSEEvent`
- 类似 codex 分支：逐个 SSE data JSON → pushEvent → emit Claude SSE

**Step 5: 跑测试确认通过**

Run: `npm test --silent -- --root backend -t "OpenAI Chat SSE"`
Expected: PASS。

**Step 6: Commit（实现阶段执行）**

```bash
git add backend/src/promptxy/transformers/index.ts backend/src/promptxy/transformers/protocols/openai-chat/sse backend/tests/integration/openai-chat-sse.test.ts
git commit -m "功能：新增 OpenAI Chat SSE→Claude SSE 转换流（含 tool_calls 增量）"
```

---

### Task 6: 前端供应商协议下拉/展示更新（破坏性变更同步）

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/pages/SupplierManagementPage.tsx`
- Modify: `frontend/src/pages/RouteConfigPage.tsx`

**Step 1: 写失败的类型检查（tsc）**

Run: `npm run build:frontend`
Expected: FAIL（若前端仍使用旧 'openai' 枚举）。

**Step 2: 更新 Supplier 协议枚举**

Update `frontend/src/types/api.ts`：
- `protocol` union 增加 `openai-codex`/`openai-chat` 并移除 `openai`。

**Step 3: 更新 UI 下拉选项与默认展示名**

- 协议下拉显示：
  - OpenaiCodex（openai-codex）
  - Openai（openai-chat）

**Step 4: 运行 build 确认通过**

Run: `npm run build:frontend`
Expected: PASS。

**Step 5: Commit（实现阶段执行）**

```bash
git add frontend/src/types/api.ts frontend/src/pages/SupplierManagementPage.tsx frontend/src/pages/RouteConfigPage.tsx
git commit -m "更新：前端支持 openai-codex/openai-chat 供应商协议"
```

---

### Task 7: 全量验证（测试 + 构建 + 本地手工回归）

**Files:**
- None (verification)

**Step 1: 后端测试**

Run: `npm test --silent -- --root backend`
Expected: PASS。

**Step 2: 构建全项目**

Run: `npm run build`
Expected: PASS。

**Step 3: 本地手工回归（可选）**

Run: `./scripts/dev.sh &`
Expected: 后台启动成功；用 Claude Code 指向 `http://127.0.0.1:<port>/claude`，选择一个 `openai-chat` 供应商路由，验证：
- 纯文本对话
- tools 调用（AskUserQuestion/tool_result 往返）
- 流式输出（含 tool_calls 增量）

停止：找到进程并结束（避免占用端口）。

**Step 4: Commit（实现阶段执行）**

- 若验证阶段有小修复，按功能点拆分小提交。

---

## 执行方式

计划完成后，两种执行选项：

1. **Subagent-Driven（当前会话）**：使用 `superpowers:subagent-driven-development`，按 Task/Step 逐条执行并在关键节点 review。
2. **Parallel Session（新会话）**：新会话使用 `superpowers:executing-plans`，批量执行并在阶段点校验。
