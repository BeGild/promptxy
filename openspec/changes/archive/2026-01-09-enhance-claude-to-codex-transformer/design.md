# Design: Claude → Codex 转换器增强

## 架构概述

本次增强在现有的转换器架构上进行扩展，不改变整体设计。增强点主要集中在：

1. **SSE 事件转换器** (`sse/to-claude.ts`) - 新增事件类型处理
2. **请求渲染器** (`render.ts`) - 新增 image block 支持
3. **Stop Reason 映射** - 新增映射函数
4. **Usage 信息增强** - 扩展 usage 字段映射

## 增强点详解

### 1. Reasoning 支持

**Codex SSE 事件：**
```typescript
// response.reasoning_text.delta
{
  type: 'response.reasoning_text.delta',
  delta: string,
  content_index: number
}

// response.reasoning_summary_text.delta
{
  type: 'response.reasoning_summary_text.delta',
  delta: string,
  summary_index: number
}
```

**Claude SSE 事件映射：**
```typescript
// content_block_start (thinking)
{
  type: 'content_block_start',
  index: number,
  content_block: {
    type: 'thinking',
    thinking: ''
  }
}

// content_block_delta (thinking_delta)
{
  type: 'content_block_delta',
  index: number,
  delta: {
    type: 'thinking_delta',
    thinking: string
  }
}
```

**状态机扩展：**
```typescript
type State = {
  // ... 现有状态
  reasoningBlockStarted: boolean;
  currentReasoningIndex: number;
  reasoningSummaryIndex: number;
};
```

**📚 参考出处：**
- **Codex SSE 事件定义**: `refence/codex/codex-rs/codex-api/src/sse/responses.rs:220-241`
  - `response.reasoning_text.delta` 事件处理
  - `response.reasoning_summary_text.delta` 事件处理
- **Claude Thinking Block 映射**: `refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:147-175`
  - 处理 `choice.delta.reasoning` 字段
  - 创建 `content_block_start` with type `thinking`
  - 创建 `content_block_delta` with `thinking_delta`

### 2. Image 支持

**Claude Image Block：**
```typescript
{
  type: 'image',
  source: {
    type: 'url',
    url: string  // 或 base64 data URL
  }
}
```

**Codex Input Image Item：**
```typescript
{
  type: 'input_image',
  source: {
    type: 'url',
    url: string
  }
}
```

**转换逻辑：**
在 `renderInput()` 函数中添加：
```typescript
else if (block.type === 'image') {
  const imageItem: CodexInputImageItem = {
    type: 'input_image',
    source: block.source,
  };
  input.push(imageItem);
  itemIndex++;
}
```

**📚 参考出处：**
- **Claude Image 类型定义**: `backend/src/promptxy/transformers/protocols/claude/types.ts:32-40`
  - `ClaudeImageBlock` 类型定义
- **Codex Image 类型定义**: `backend/src/promptxy/transformers/protocols/codex/types.ts:46-54`
  - `CodexInputImageItem` 类型定义
- **Base64 处理参考**: `refence/claude-relay-service/src/services/openaiToClaude.js:238-290`
  - `_convertMultimodalContent` 函数
  - 处理 base64 和 URL 格式图片

### 3. Stop Reason 映射

**Codex finish_reason → Claude stop_reason：**
```typescript
function mapStopReason(codexFinishReason: string | null): string {
  const mapping = {
    'tool_calls': 'tool_use',
    'stop': 'end_turn',
    'length': 'max_tokens',
    'content_filter': 'end_turn',
    null: 'end_turn'
  };
  return mapping[codexFinishReason] || 'end_turn';
}
```

**应用位置：**
- `message_delta` 事件生成时
- 非流式响应转换时

**📚 参考出处：**
- **Stop Reason 映射函数**: `refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:327-338`
  ```rust
  fn map_stop_reason(finish_reason: Option<&str>) -> Option<String> {
      finish_reason.map(|r| match r {
          "tool_calls" => "tool_use",
          "stop" => "end_turn",
          "length" => "max_tokens",
          _ => "end_turn",
      })
  }
  ```
- **当前实现位置**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:267-271`
  - 当前使用硬编码 `config.stopReasonStrategy`

### 4. Usage 信息增强

**Codex ResponseCompleted Usage：**
```typescript
{
  input_tokens: number,
  input_tokens_details: {
    cached_tokens: number
  },
  output_tokens: number,
  output_tokens_details: {
    reasoning_tokens: number
  },
  total_tokens: number
}
```

**Claude Usage 扩展：**
```typescript
{
  input_tokens: number,
  output_tokens: number,
  cached_tokens?: number,      // 新增
  reasoning_tokens?: number     // 新增
}
```

**📚 参考出处：**
- **Codex Usage 结构**: `refence/codex/codex-rs/codex-api/src/sse/responses.rs:85-116`
  - `ResponseCompletedUsage` 结构定义
  - 包含 `cached_tokens` 和 `reasoning_tokens`
- **Usage 映射逻辑**: `refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:285-289`
  ```rust
  let usage_json = chunk.usage.as_ref().map(|u| json!({
      "input_tokens": u.prompt_tokens,
      "output_tokens": u.completion_tokens
  }));
  ```

## 实现策略

### 阶段 1：Stop Reason 映射（P0）

**修改文件**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`

**实现步骤**:
1. 添加 `mapStopReason` 函数（参考 cc-switch:327-338）
2. 修改 `createMessageDeltaEvent` 调用（第267-271行）
3. 更新 `transformCodexResponseToClaude` 函数（`response.ts:43-87`）

**📚 参考**:
- `refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:327-338`
- 当前实现: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:267-271`

### 阶段 2：Image 支持（P0）

**修改文件**: `backend/src/promptxy/transformers/protocols/codex/render.ts`

**实现步骤**:
1. 在 `renderInput` 函数中添加 image block 处理（第158-206行）
2. 确保类型定义正确导入

**📚 参考**:
- Claude 类型: `backend/src/promptxy/transformers/protocols/claude/types.ts:32-40`
- Codex 类型: `backend/src/promptxy/transformers/protocols/codex/types.ts:46-54`
- Base64 处理: `refence/claude-relay-service/src/services/openaiToClaude.js:238-290`

### 阶段 3：Reasoning 支持（P0）

**修改文件**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`

**实现步骤**:
1. 扩展 `State` 类型（第26-37行）
2. 在 `transformSingleEvent` 中添加 reasoning 事件处理
3. 创建 `createThinkingBlockStartEvent` 和 `createThinkingDeltaEvent` 工具函数

**📚 参考**:
- Codex SSE 事件: `refence/codex/codex-rs/codex-api/src/sse/responses.rs:220-241`
- Thinking 映射: `refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:147-175`
- 当前状态机: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:26-37`

### 阶段 4：Usage 增强（P1）

**修改文件**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`

**实现步骤**:
1. 扩展 `ClaudeMessageDeltaEvent` 类型定义
2. 从 `response.completed` 提取详细信息
3. 在 `createMessageDeltaEvent` 中包含扩展 usage 字段

**📚 参考**:
- Codex Usage: `refence/codex/codex-rs/codex-api/src/sse/responses.rs:85-116`
- Claude Usage: `backend/src/promptxy/transformers/protocols/claude/types.ts:182-192`
- 当前实现: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:345-352`

## 测试策略

### 单元测试
- `mapStopReason` 函数的所有映射情况
- Image block 转换的正确性
- Reasoning 事件的状态机转换

### 集成测试
- 完整的请求-响应循环
- SSE 流式转换的全链路测试
- 与参考项目的输出对比

### 测试 Fixture

**📚 Fixture 来源**:
- `refence/codex/codex-rs/codex-api/src/sse/responses.rs:415-472`
  - `parses_items_and_completed` 测试用例
  - 包含完整的 SSE 事件样本
- `refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:82-324`
  - OpenAI SSE 事件处理流程
  - 可用于对比验证

## 向后兼容性

所有增强都是新增功能，不影响现有的转换逻辑：
- 现有测试无需修改
- 不影响其他协议转换器
- 配置文件无需变更
