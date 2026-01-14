# Change: 统一 Codex SSE→Claude SSE 转换链路并移除旧实现

## Why

当前 `/claude/v1/messages`（stream）路径的 SSE 转换实际走 `backend/src/promptxy/transformers/index.ts` 内嵌的 Codex SSE 适配逻辑，导致 `message_delta.usage` 缺失 `input_tokens/cached_tokens/reasoning_tokens`，Claude 客户端无法基于上下文 token 触发自动压缩。

同时代码库中存在两套 Codex SSE→Claude SSE 转换实现：

- 旧实现：`backend/src/promptxy/transformers/index.ts`（在 gateway 流式 pipe 中使用）
- 新实现：`backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`（有单测、状态机更完整）

双实现长期会漂移，形成“修了一处，线上还走另一处”的维护陷阱。

## What Changes

- 将 `createSSETransformStream('codex')` 的流式转换逻辑迁移为复用 `protocols/codex/sse/to-claude.ts` 的状态机实现，确保统一输出。
- 补齐旧实现中 Claude 客户端依赖/兼容的事件形状与行为：
  - `message_start.message.id` 以 `response.created.id` 为主（稳定可追踪）
  - `message_start.message.usage` 输出 `{ input_tokens: 0, output_tokens: 0 }`
  - 仍发送一次 `ping`（与旧实现保持一致）
  - `message_delta.usage` 在 `response.completed` 时包含：`input_tokens/output_tokens/cached_tokens/reasoning_tokens`
- 删除 `backend/src/promptxy/transformers/index.ts` 内现有 Codex SSE 内嵌转换实现（避免重复维护）。

## Impact

- Affected specs:
  - `claude-codex-transformation`（SSE usage 字段与 message_start 行为）
  - `promptxy-gateway`（streaming response transform pipeline 的实现约束）
- Affected code:
  - `backend/src/promptxy/gateway.ts`
  - `backend/src/promptxy/transformers/index.ts`
  - `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`
  - `backend/src/promptxy/transformers/protocols/claude/types.ts`

## Non-goals

- 不引入新的协议能力（仅统一实现并恢复既有/期望行为）。
- 不改变非流式 JSON 响应转换逻辑。
