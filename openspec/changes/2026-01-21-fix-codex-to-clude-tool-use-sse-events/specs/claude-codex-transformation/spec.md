# Spec: Codex→Claude Tool Use SSE 事件序列

## 1. 事件类型定义

### 1.1 Codex SSE 事件类型

```typescript
export type CodexSSEEventType =
  | 'response.created'
  | 'response.output_text.delta'
  | 'response.output_item.added'
  | 'response.output_item.done'
  | 'response.function_call_arguments.delta'  // Tool use 参数增量
  | 'response.reasoning_text.delta'
  | 'response.reasoning_summary_text.delta'
  | 'response.failed'
  | 'response.completed';
```

### 1.2 新增事件类型

```typescript
export type CodexFunctionCallArgumentsDeltaEvent = {
  type: 'response.function_call_arguments.delta';
  delta: string;  // JSON 字符串增量
  output_index?: number;
};
```

## 2. Tool Use 事件序列规范

### 2.1 完整事件序列

```
1. response.created
   ↓
2. response.output_item.added (function_call)
   ├─ hasToolCall = true
   ├─ (关闭 text block，如果存在)
   ├─ content_block_start (index, type="tool_use", id, name)
   └─ content_block_delta (index, type="input_json_delta", partial_json="")
   ↓
3. response.function_call_arguments.delta (0-N 次)
   └─ content_block_delta (index, type="input_json_delta", partial_json=delta)
   ↓
4. response.output_item.done (function_call)
   └─ content_block_stop (index)
   ↓
5. response.completed
   ├─ message_delta (stop_reason="tool_use" | "end_turn", usage={...})
   └─ message_stop
```

### 2.2 事件转换规则

| Codex 事件 | Claude 事件 | 说明 |
|-----------|------------|------|
| `response.output_item.added` (function_call) | `content_block_start` + `content_block_delta(partial_json="")` | 立即发送空 delta |
| `response.function_call_arguments.delta` | `content_block_delta(partial_json=delta)` | 逐个发送参数增量 |
| `response.output_item.done` (function_call) | `content_block_stop` | 仅发送 stop |
| `response.completed` | `message_delta` + `message_stop` | 根据 `hasToolCall` 决定 stop_reason |

### 2.3 状态管理

| 状态 | 类型 | 设置时机 | 用途 |
|------|------|----------|------|
| `hasToolCall` | `boolean` | `output_item.added` (function_call) | 决定最终 stop_reason |
| `currentActiveToolIndex` | `number \| undefined` | `output_item.added` 时设置，`output_item.done` 时清除 | 关联 delta 到正确的 tool |
| `currentToolCallStarted` | `boolean` | `output_item.added` 时设置，`output_item.done` 时清除 | 跟踪当前 tool 状态 |

## 3. 约束条件

### 3.1 必须满足

- `output_item.added` 必须先于 `function_call_arguments.delta`
- `function_call_arguments.delta` 仅在 `output_item.done` 前有效
- `currentActiveToolIndex` 在 `output_item.done` 后必须清除

### 3.2 协议假设

- 上游 Codex 实现必须发送完整的 `output_item.added` → `delta` → `done` 序列
- 不假设上游会缺失事件（严格对齐协议）

## 4. 参考

- Go 实现：`refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go`
  - `output_item.added`：`:117-144`
  - `function_call_arguments.delta`：`:155-162`
  - `output_item.done`：`:145-154`
- Claude 协议规范：`docs/protocols/claude-messages-spec.md` §6.2
