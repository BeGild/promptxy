# Codex→Claude Tool Use SSE 事件修复设计

## 1. 问题分析

### 1.1 当前实现的问题

通过对比 Go 参考实现 (`refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go`)，发现 TypeScript 实现存在以下问题：

| 问题 | Go 实现 | TS 当前实现 | 影响 |
|------|---------|------------|------|
| `output_item.added` 处理 | ✅ 发送 start + 空 delta | ❌ 完全未处理 | 事件序列错乱 |
| `function_call_arguments.delta` 处理 | ✅ 逐个发送 delta | ❌ 完全未处理 | 参数传输错误 |
| `hasToolCall` 设置时机 | `added` 时设置 | `done` 时设置 | stop_reason 判断错误 |
| `content_block_start` 时机 | `added` 时发送 | `done` 时发送 | 客户端无法识别 |

### 1.2 事件流对比

**Go 参考实现的完整事件流：**
```
[response.created]
  → message_start
  → content_block_start (index=0, type=text)

[response.output_item.added] (function_call)
  → content_block_stop (index=0, type=text)  // 关闭 text block
  → content_block_start (index=1, type=tool_use, id, name)
  → content_block_delta (index=1, partial_json="")  // 空字符串！

[response.function_call_arguments.delta] (多次)
  → content_block_delta (index=1, partial_json={...})

[response.output_item.done] (function_call)
  → content_block_stop (index=1)

[response.completed]
  → message_delta (stop_reason="tool_use", usage={...})
  → message_stop
```

**TypeScript 当前实现的事件流（错误）：**
```
[response.created]
  → message_start
  → content_block_start (index=0, type=text)

[response.output_item.done] (function_call)  // ← 错误：没有 added 处理
  → content_block_stop (index=0, type=text)
  → content_block_start (index=1, type=tool_use, id, name)
  → content_block_delta (index=1, partial_json={完整参数})  // ← 错误：一次性发送
  → content_block_stop (index=1)

[response.completed]
  → message_delta (stop_reason="tool_use", usage={...})
  → message_stop
```

## 2. 设计方案

### 2.1 状态机扩展

```typescript
type State = {
  // ... 现有状态 ...

  /** 当前正在处理的 tool call 的 index（用于 function_call_arguments.delta） */
  currentActiveToolIndex?: number;
  /** 当前 tool call 是否已发送 content_block_start（用于防守） */
  currentToolCallStarted: boolean;
};
```

### 2.2 事件处理逻辑

#### 2.2.1 `response.output_item.added` (新增)

```typescript
case 'response.output_item.added': {
  const item = (event as any).item;

  if (item.type === 'function_call' || item.type === 'custom_tool_call') {
    // 标记 tool call 状态
    state.hasToolCall = true;
    state.currentActiveToolIndex = state.currentToolIndex;
    state.currentToolCallStarted = true;

    // 关闭 text block（如果存在）
    if (state.textBlockStarted) {
      claudeEvents.push(createContentBlockStopEvent(0));
      state.textBlockStarted = false;
    }

    // content_block_start
    claudeEvents.push(createContentBlockStartEvent(state.currentToolIndex, 'tool_use', {
      id: item.call_id,
      name: item.name,
    }));

    // content_block_delta (空字符串)
    claudeEvents.push(createContentBlockDeltaEvent(state.currentToolIndex, 'input_json_delta', {
      partial_json: '',
    }));
  }
  break;
}
```

#### 2.2.2 `response.function_call_arguments.delta` (新增)

```typescript
case 'response.function_call_arguments.delta': {
  // 确保有活跃的 tool call
  if (state.currentActiveToolIndex === undefined) {
    audit.setMetadata('unexpectedFunctionCallDelta', true);
    break;
  }

  const delta = (event as any).delta || '';
  state.outputCharCount += delta.length;

  claudeEvents.push(createContentBlockDeltaEvent(
    state.currentActiveToolIndex,
    'input_json_delta',
    { partial_json: delta }
  ));
  break;
}
```

#### 2.2.3 `response.output_item.done` (修改)

```typescript
case 'response.output_item.done': {
  const item = (event as any).item;

  if (item.type === 'function_call' || item.type === 'custom_tool_call') {
    // content_block_stop
    claudeEvents.push(createContentBlockStopEvent(state.currentToolIndex));

    // 重置状态
    state.currentActiveToolIndex = undefined;
    state.currentToolCallStarted = false;
    state.currentToolIndex++;
  } else if (item.type === 'message') {
    // message 类型的 done，关闭 text block
    if (state.textBlockStarted) {
      claudeEvents.push(createContentBlockStopEvent(0));
      state.textBlockStarted = false;
    }
  }
  break;
}
```

### 2.3 类型定义更新

```typescript
// 在 CodexSSEEventType 中添加：
export type CodexSSEEventType =
  | 'response.created'
  | 'response.output_text.delta'
  | 'response.output_item.added'
  | 'response.output_item.done'
  | 'response.function_call_arguments.delta'  // 新增
  | 'response.reasoning_text.delta'
  | 'response.reasoning_summary_text.delta'
  | 'response.failed'
  | 'response.completed';

// 新增事件类型：
export type CodexFunctionCallArgumentsDeltaEvent = {
  type: 'response.function_call_arguments.delta';
  delta: string;
  output_index?: number;
};

// 在 CodexSSEEvent 联合类型中添加：
export type CodexSSEEvent =
  | CodexResponseCreatedEvent
  | CodexOutputTextDeltaEvent
  | CodexReasoningTextDeltaEvent
  | CodexReasoningSummaryTextDeltaEvent
  | CodexOutputItemAddedEvent
  | CodexOutputItemDoneEvent
  | CodexFunctionCallArgumentsDeltaEvent  // 新增
  | CodexResponseFailedEvent
  | CodexResponseCompletedEvent;
```

## 3. 实现细节

### 3.1 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 是否对不规范上游兜底 | 不兜底 | 严格对齐协议，简化逻辑 |
| `hasToolCall` 设置时机 | `output_item.added` | 与 Go 参考一致 |
| 空字符串 delta | 立即发送 | 与 Go 参考一致 |
| text block 关闭时机 | `output_item.added` 时 | 与 Go 参考一致 |

### 3.2 与 Go 参考实现的对应关系

| Go 代码位置 | Go 行为 | TS 实现 |
|------------|---------|---------|
| `:117-144` | `output_item.added` → start + 空 delta | 新增 case |
| `:155-162` | `function_call_arguments.delta` → delta | 新增 case |
| `:145-154` | `output_item.done` → stop | 修改现有 case |
| `:101-116` | `response.completed` → delta + stop | 已实现，无需修改 |

### 3.3 边界情况

1. **多个 tool call 顺序**：通过 `currentToolIndex` 正确递增
2. **text block 关闭**：在 `output_item.added` 时关闭（如果存在）
3. **无 delta 的 tool call**：空字符串 delta 仍发送

## 4. 测试策略

### 4.1 单元测试

```typescript
describe('Codex→Claude Tool Use SSE Events', () => {
  it('应在 output_item.added 时发送 content_block_start 和空 delta');
  it('应在 function_call_arguments.delta 时发送增量 delta');
  it('应在 output_item.done 时发送 content_block_stop');
  it('应在 response.completed 时发送 message_delta(stop_reason=tool_use)');
  it('应正确处理多个 tool call 的 index 递增');
  it('应在 tool call 前关闭 text block');
});
```

### 4.2 集成测试

- 使用真实 Codex 上游测试 tool use 完整流程
- 验证 Claude 客户端正确触发 tool loop

## 5. 验收标准

- [ ] 事件序列与 Go 参考实现完全一致
- [ ] 单元测试覆盖所有新增 case
- [ ] 真实环境 tool use 可用
- [ ] 无 regressions（text/reasoning 场景正常）
