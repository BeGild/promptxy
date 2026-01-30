# Gateway & Transformers Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复网关路由解析/探测过滤/SSE 转换的关键缺陷，并提升错误可诊断性与文档一致性。

**Architecture:** 在不引入新抽象的前提下，针对已识别的高风险点做“最小可验证改动”：先用 Vitest 写可复现的失败用例，再最小改动实现让测试通过；同时补齐 API 错误码/响应字段以便前端与用户定位问题。

**Tech Stack:** Node.js (fetch/undici), TypeScript, Vitest, 自研协议转换器（Claude/Codex/Gemini/OpenAI Chat）。

---

## Scope & Success Criteria

### Must Fix
1) warmup / count 探测请求过滤逻辑实际生效（不再无条件转发）。
2) 路由/模型映射/供应商不可用错误可区分（至少：model 缺失、规则未命中、supplier disabled/not found、route 约束不满足）。
3) OpenAI Chat SSE → Claude SSE 事件序列修正为 Claude 可消费的 start/delta/stop 流。
4) 文档与实现字段一致（规则示例不再使用 legacy `id`）。

### Non-goals
- 不做新协议支持，不引入新的配置格式。
- 不做大规模重构（仅做局部、可测试的改动）。

---

## Task 1: 修复 warmup/count 探测过滤永远不生效

**Files:**
- Modify: `backend/src/promptxy/gateway.ts`（warmup/count 判断与 transformerChain 初始化顺序）
- Test: `backend/tests/**/gateway-*.test.ts`（新增或扩展现有测试文件）

**Step 1: 写失败测试（warmup 请求不应转发上游）**

- 目标：当请求为 Claude 入口、命中 codex transformer 且 body 是 warmup 时，网关直接返回 200 空内容，不调用 fetch。

测试草案（示意，最终以现有测试工具为准）：
```ts
import { describe, it, expect, vi } from 'vitest';

it('skips warmup probe for claude->codex', async () => {
  // mock global fetch and assert not called
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- --root backend`
Expected: FAIL（fetch 被调用，或返回不是预期结构）

**Step 3: 最小实现修复**

- 在进入 warmup/count 判断前，确保 `transformerChain` 已根据 modelMapping 或 deriveTransformer 得到 `codex`。
- 或者直接用 `derivedTransformer` 变量替代 `transformerChain[0]`。

**Step 4: 运行测试确认通过**

Run: `npm test -- --root backend`
Expected: PASS

**Step 5:（可选）补测试（count 探测同理）**

- 新增 `isCountProbeRequest` 分支的测试。

**Step 6: Commit**

```bash
git add backend/src/promptxy/gateway.ts backend/tests

git commit -m "fix：修复 warmup/count 探测过滤不生效"
```

---

## Task 2: 错误可诊断性：区分 route/model/supplier/constraint 失败原因

**Files:**
- Modify: `backend/src/promptxy/gateway.ts`（resolveSupplierByModel/resolveEffectiveModelMapping 相关分支）
- Modify: `backend/src/promptxy/types.ts`（如需扩展错误响应结构的类型，仅在已存在类型体系下补字段）
- Test: `backend/tests/**/gateway-routing-*.test.ts`

**Step 1: 写失败测试（缺 model 时返回明确错误）**

- 目标：Claude 入口 + 启用路由 + 请求 JSON 无 `model` 时，返回 `error: 'model_missing'`（或你认可的命名），而不是笼统 `supplier_unavailable`。

**Step 2: 运行测试确认失败**

Run: `npm test -- --root backend`
Expected: FAIL（当前会变成 supplier_unavailable/route_resolution_failed 等）

**Step 3: 最小实现（结构化错误原因）**

建议策略（实现时保持最小改动）：
- `resolveEffectiveModelMapping` 返回更丰富结果（例如 `{ ok:false, reason:'model_missing'|'no_match'|'supplier_disabled'|'supplier_not_found' }`）
- `resolveSupplierByModel` 把 `constraintError` 与上述 reason 透传到调用方
- 网关对不同 reason 映射不同 error code + message（保留现有 503/500 结构，但增加 error 字段细分）

**Step 4: 运行测试确认通过**

Run: `npm test -- --root backend`
Expected: PASS

**Step 5: 写/补失败测试（route 约束不满足应返回 route_constraint_violation）**

- 目标：例如 `/codex` 入口配置了非 `openai-codex` 供应商时，返回明确错误而不是 supplier_unavailable。

**Step 6: Commit**

```bash
git add backend/src/promptxy/gateway.ts backend/src/promptxy/types.ts backend/tests

git commit -m "fix：细分路由解析失败原因并提升可诊断性"
```

---

## Task 3: 防止规则被应用两次（或保证幂等/可解释）

**Files:**
- Modify: `backend/src/promptxy/gateway.ts:794`（第一次 mutate）
- Modify: `backend/src/promptxy/gateway.ts:922`（第二次 mutate）
- Test: `backend/tests/**/gateway-rules-*.test.ts`

**Step 1: 写失败测试（规则只应用一次）**

- 构造一个非幂等规则（例如 append），验证最终只 append 一次。

**Step 2: 运行测试确认失败**

Run: `npm test -- --root backend`
Expected: FAIL（如果目前确实应用两次）

**Step 3: 最小实现选择其一**

方案 A（推荐，改动更小）：
- Claude 入口跨协议转换阶段不再重复 mutate（只保留第一次 mutate）。

方案 B：
- 引入标记位（例如 request-local flag），确保第二次 mutate 跳过。

**Step 4: 运行测试确认通过**

Run: `npm test -- --root backend`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/promptxy/gateway.ts backend/tests

git commit -m "fix：避免规则重复应用导致请求二次改写"
```

---

## Task 4: 修复 OpenAI Chat SSE → Claude SSE 事件序列

**Files:**
- Modify: `backend/src/promptxy/transformers/protocols/openai-chat/sse/to-claude.ts`
- (Maybe) Modify: `backend/src/promptxy/transformers/sse/sse.ts`（仅当需要统一创建 text block 的 helper，优先不改）
- Test: `backend/tests/**/openai-chat-sse-to-claude.test.ts`

**Step 1: 写失败测试（start/delta/stop 顺序与 index 合法）**

- 输入：模拟 OpenAI chat SSE：
  - delta.content: "hi"
  - finish_reason: "stop"
- 期望输出：
  - 先 `message_start`
  - 再 `content_block_start(index=0,type=text)`
  - 再 `content_block_delta(index=0,text_delta)`
  - 再 `content_block_stop(index=0)`
  - 再 `message_delta(stop_reason='end_turn')`
  - 再 `message_stop`
- 明确断言：不得出现 `content_block_stop index=-1`。

**Step 2: 运行测试确认失败**

Run: `npm test -- --root backend`
Expected: FAIL（当前不会发 text start，且会发 index=-1）

**Step 3: 最小实现修复**

- 引入 `blockIndex` 状态（至少支持一个 text block + N 个 tool blocks 的单调 index）。
- `init` 时发 `message_start` + `content_block_start(text, index=0)`（不要先发 message_delta 空包）
- 内容 delta 只发 `content_block_delta`。
- finalize:
  - 若 text block 打开则 stop 它
  - 若 tool blocks 打开则 stop 它们
  - 发 `message_delta(stop_reason=mapFinishReason(choice.finish_reason))`
  - 发 `message_stop`

**Step 4: 运行测试确认通过**

Run: `npm test -- --root backend`
Expected: PASS

**Step 5:（可选）补充工具调用测试**

- 输入：delta.tool_calls 分片 arguments
- 期望：tool_use block start/delta/stop 与 message_delta(tool_use) 的配合符合 Claude Code tool loop。

**Step 6: Commit**

```bash
git add backend/src/promptxy/transformers/protocols/openai-chat/sse/to-claude.ts backend/tests

git commit -m "fix：修正 OpenAI Chat SSE 到 Claude SSE 的事件序列"
```

---

## Task 5: 文档一致性：规则示例字段与易踩坑说明

**Files:**
- Modify: `docs/usage.md`
- Modify: `docs/configuration.md`

**Step 1: 写文档变更（不改实现）**

- 把规则示例从 legacy `id` 改为 `uuid` + `name`（对齐 `backend/src/promptxy/types.ts` 与 `api-handlers.ts:289` 校验）。
- 增加“regex flags”说明：
  - `when.pathRegex/modelRegex` 不支持 flags
  - `op.regex` 不带 `g` 只匹配一次
- 明确 `pathRegex` 匹配的是 stripPrefix 后路径（例如 `/v1/messages`）
- 提醒 `insert_before/insert_after` 的字符串 match 分支会在开头/结尾额外插入，推荐用 regex 分支。

**Step 2:（可选）文档校验/预览**

- 如项目有 docs lint 就跑；没有则跳过。

**Step 3: Commit**

```bash
git add docs/usage.md docs/configuration.md

git commit -m "docs：统一规则字段并补充规则引擎易踩坑说明"
```

---

## Task 6: 验证与回归

**Files:**
- None (commands only)

**Step 1: 运行后端测试**

Run: `npm test -- --root backend`
Expected: PASS

**Step 2: 运行前端测试（如受影响）**

Run: `npm run test:frontend`
Expected: PASS

**Step 3: Build 验证**

Run: `npm run build`
Expected: PASS

**Step 4: 本地启动验证（按项目约定）**

Run: `./scripts/dev.sh &`
- 手动验证：
  - warmup/count 请求不会触发上游
  - 错误响应包含细分 error code
  - OpenAI Chat 流式在 Claude 侧不再卡住/不再出现非法事件

**Step 5: 停止后台 dev**

- 找到进程并关闭（按你们现有习惯/脚本输出）。

---

## Execution Notes

- 每个 Task 都遵循 TDD：先写失败测试，再修复实现。
- 每个 Task 单独提交（中文 commit message，且 message 描述改动目的）。
