# Codex → Claude SSE 转换器规格

## Tool Use 事件序列

当 Codex SSE 中出现 `response.output_item.done` (item.type="function_call") 时，转换器必须生成以下 Claude SSE 事件序列：

1. `content_block_start` (index=N, content_block.type="tool_use")
2. `content_block_delta` (index=N, delta.type="input_json_delta")
3. `content_block_stop` (index=N)
4. **`message_delta`** (delta.stop_reason="tool_use") ← 关键！

**关键约束：**
- `message_delta` 必须在 `content_block_stop` 之后**立即发送**
- 不应等到流结束才发送 `message_delta`
- 这确保 Claude Code Router 能及时触发 tool loop

**参考：**
- Claude Code 协议规格：docs/protocols/claude-messages-spec.md §6.2
- Claude Code Router 实现：refence/claude-code-router/src/index.ts:264-312
