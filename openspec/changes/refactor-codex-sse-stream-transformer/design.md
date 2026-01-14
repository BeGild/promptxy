# Design

## Context

当前网关流式转换链路在 `backend/src/promptxy/gateway.ts` 中对 SSE body 进行 pipe，并调用 `createSSETransformStream(transformerChain[0])`。`gateway.ts` 导入来源是 `backend/src/promptxy/transformers/index.ts`，因此 Codex SSE→Claude SSE 的线上行为由该文件内的内嵌转换逻辑决定。

同时，项目已有更完整的 Codex SSE→Claude SSE 状态机实现：`backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`，并具备单元测试覆盖。

## Goal

- 单一事实来源：Codex SSE→Claude SSE 只维护一套实现。
- 恢复 Claude 客户端上下文相关字段：`message_delta.usage` 必须包含 `input_tokens`，并支持 `cached_tokens/reasoning_tokens`。
- 兼容旧实现输出：保留 `ping` 与 `message_start.message.usage` 的形状，避免客户端兼容风险。

## Proposed Architecture

### 1) 统一转换入口

- 将 `backend/src/promptxy/transformers/index.ts:createSSETransformStream('codex')` 重写为：
  - 负责稳定地解析 SSE chunk → Codex 事件序列
  - 将事件序列增量喂给 `protocols/codex/sse/to-claude.ts` 的状态机
  - 将输出 Claude 事件序列化为 SSE（`event:` + `data:`）

### 2) message id 策略

- 优先使用 `response.created.id` 作为 `message_start.message.id`
- 若 `response.created` 缺失或乱序（极端情况），降级为生成随机 id（兼容旧实现）

### 3) 兼容字段

旧实现的 `message_start.message` 包含字段：
- `type: 'message'`
- `stop_sequence: null`
- `usage: { input_tokens: 0, output_tokens: 0 }`

协议层 `ClaudeMessageStartEvent` 类型当前未表达这些字段，需在 types 中将其作为可选字段扩展，并由协议转换器输出补齐。

### 4) usage 字段

在 `response.completed` 时，从 Codex usage 映射：
- `input_tokens` ← `usage.input_tokens`
- `output_tokens` ← `usage.output_tokens`
- `cached_tokens` ← `usage.input_tokens_details.cached_tokens`
- `reasoning_tokens` ← `usage.output_tokens_details.reasoning_tokens`

### 5) ping 行为

- 保留旧实现行为：在首次初始化输出（`message_start` + `content_block_start`）后发送一次 `ping`。

## Trade-offs

- 优点：
  - 只维护一套转换逻辑，减少漂移风险
  - 状态机实现更完整、已有测试基础
  - 直接解决 Claude 客户端自动压缩依赖的 usage 字段缺失问题

- 代价：
  - 需要调整类型定义以容纳兼容字段
  - 需要强化 SSE chunk 解析与增量喂入逻辑，避免跨 chunk JSON 不完整导致丢事件

## Rollout / Safety

- 通过新增单测覆盖 `createSSETransformStream('codex')` 的输出形状与 usage 完整性。
- 保持 gemini SSE 路径不受影响。
