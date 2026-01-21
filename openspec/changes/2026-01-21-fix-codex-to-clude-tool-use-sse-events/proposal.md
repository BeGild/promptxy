# Change: 修复 Codex→Claude Tool Use SSE 事件序列

## Why

当前 Codex→Claude SSE 转换器在处理 tool call 时存在严重缺陷：

1. **完全缺失关键事件处理**：`response.output_item.added` 和 `response.function_call_arguments.delta` 事件未被处理
2. **事件顺序错乱**：`content_block_start` �迟到 `response.output_item.done` 时才发送
3. **与 Go 参考实现不一致**：未对齐 `refence/CLIProxyAPI` 的协议转换行为

这些缺陷导致 Claude 客户端在 tool use 场景下表现异常：
- 客户端无法正确触发 tool loop
- 请求体不断累积增大
- 流程卡住无法完成

### 问题历史

- Commit 8a28353 时 tool use 基本可用（有即时 `message_delta`）
- Commit a9f3378 尝试对齐 Go 参考，移除了即时 `message_delta`，但未补充 `output_item.added` 处理
- 导致当前 tool use 不可用

## What Changes

对齐 Go 参考实现 (`refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go`)，修复 tool use SSE 事件序列：

### 事件序列修复

**修复前（当前错误实现）：**
```
response.output_item.done
  ├─ content_block_start (错误时机)
  ├─ content_block_delta (一次性发送完整参数)
  └─ content_block_stop
```

**修复后（对齐 Go 参考）：**
```
response.output_item.added (function_call)
  ├─ content_block_start (index, id, name)
  └─ content_block_delta (partial_json = "")  ← 空字符串！

response.function_call_arguments.delta (0-N 次)
  └─ content_block_delta (partial_json = delta)

response.output_item.done (function_call)
  └─ content_block_stop (index)

response.completed
  ├─ message_delta (stop_reason = "tool_use" | "end_turn")
  └─ message_stop
```

### 代码变更

1. **类型定义** (`backend/src/promptxy/transformers/protocols/codex/types.ts`)
   - 添加 `CodexFunctionCallArgumentsDeltaEvent` 类型

2. **状态机扩展** (`backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`)
   - 添加 `currentActiveToolIndex` 跟踪当前 tool
   - 添加 `currentToolCallStarted` 标记

3. **事件处理**
   - 添加 `response.output_item.added` 处理
   - 添加 `response.function_call_arguments.delta` 处理
   - 修改 `response.output_item.done` 处理逻辑
   - 提取 `transformToolCallStart` 函数

### 设计原则

- **严格对齐协议**：不假设上游会缺失事件，严格按照 Codex SSE 协议规范实现
- **对齐 Go 参考**：事件序列与 `refence/CLIProxyAPI` 完全一致

## Impact

- Affected specs:
  - `claude-codex-transformation`（tool use SSE 事件序列）
- Affected code:
  - `backend/src/promptxy/transformers/protocols/codex/types.ts`
  - `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`
  - `backend/tests/transformers/protocols/codex/sse.test.ts`

## Non-goals

- 不添加对不规范上游的兼容（严格对齐协议）
- 不修改 `message_delta` 的发送时机（保持在 `response.completed` 时统一发送）
- 不影响非 tool use 场景的现有行为
