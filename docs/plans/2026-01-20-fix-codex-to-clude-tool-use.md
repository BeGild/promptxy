# 修复 Codex → Claude 转换器 Tool Use 问题实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task.

**目标：** 修复 `/claude -> /codex` 转换器在 tool use 场景下无法正确触发 Claude Code tool loop 的问题。

**架构：** 恢复在 tool call 完成时立即发送 `message_delta(stop_reason=tool_use)` 的行为，以对齐 Claude Code 协议规格和参考实现（refence/claude-code-router/src/index.ts:264-312）。

**技术栈：** TypeScript, Node.js Stream Transform, Vitest

---

## 问题背景

在 commit a9f3378 中，移除了 `transformToolCall` 函数中即时发送 `message_delta` 的逻辑，导致：
1. Claude Code Router 无法在 tool call 完成后收到 `message_delta` 事件
2. Tool loop 无法被触发（参考：docs/protocols/claude-messages-spec.md 第 6.2 节）
3. 工具调用场景下出现超时或 AbortError

**工作版本：** commit 8a28353 - tool call 完成后立即发送 `message_delta(tool_use)`

**问题版本：** commit a9f3378 - 只在流结束时统一发送 `message_delta`

---

## Task 1: 添加即时 message_delta 发送逻辑

**文件：**
- 修改: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:483-537`

**背景：** `transformToolCall` 函数当前在 tool call 完成后只发送 `content_block_stop`，需要恢复立即发送 `message_delta` 的行为。

**Step 1: 阅读当前代码确认状态**

```bash
cat backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts | grep -A 60 "function transformToolCall"
```

预期：看到函数在 `content_block_stop` 后直接 return，没有发送 `message_delta`

**Step 2: 恢复 message_delta 发送**

在 `transformToolCall` 函数中，`content_block_stop` 事件之后、`return events` 之前添加：

```typescript
  // content_block_stop
  events.push(createContentBlockStopEvent(toolIndex));

  // message_delta (触发 tool loop)
  // 工具调用场景下，stop_reason 固定为 tool_use
  events.push(
    createMessageDeltaEvent({
      stop_reason: 'tool_use',
    }),
  );

  return events;
```

**Step 3: 运行现有测试验证基础行为**

```bash
cd backend && npm test -- backend/tests/transformers/protocols/codex/sse.test.ts
```

预期：测试通过（恢复此逻辑应使行为更接近工作版本）

**Step 4: Git commit**

```bash
git add backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts
git commit -m "修复：恢复 Codex→Claude 转换器 tool call 完成后即时发送 message_delta

- 在 transformToolCall 中恢复立即发送 message_delta(stop_reason=tool_use)
- 对齐 Claude Code 协议规格 (docs/protocols/claude-messages-spec.md §6.2)
- 修复 tool loop 触发时机问题

参考：refence/claude-code-router/src/index.ts:264-312
"
```

---

## Task 2: 防止重复发送 message_delta

**文件：**
- 修改: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:220-231`

**背景：** `maybeEmitFinalUsageDelta` 函数在流结束时会发送 `message_delta`。现在 tool call 会提前发送一次，需要防止流结束时重复发送导致的事件冲突。

**Step 1: 分析当前 closeStreamEvents 逻辑**

```bash
cat backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts | grep -A 20 "function closeStreamEvents"
```

预期：看到 `closeStreamEvents` 调用 `maybeEmitFinalUsageDelta`，后者使用 `finalUsageEmitted` 标志防止重复

**Step 2: 验证标志位机制是否正确**

检查 `State` 类型和 `maybeEmitFinalUsageDelta` 实现：

```bash
grep -A 5 "finalUsageEmitted" backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts | head -20
```

预期：`finalUsageEmitted` 标志在 `maybeEmitFinalUsageDelta` 中设置为 true 后，后续调用会跳过发送

**Step 3: 确认 tool call 的 message_delta 不会影响 finalUsageEmitted**

当前设计中，tool call 发送的 `message_delta` 不带 usage，因此不会设置 `finalUsageEmitted` 标志。流结束时的 `message_delta` 会包含完整的 usage 信息，两者可以共存。

验证逻辑正确性：
- Tool call 的 `message_delta`: 只有 `stop_reason: 'tool_use'`，无 usage
- 流结束的 `message_delta`: 包含 `stop_reason` 和完整 `usage`

**Step 4: 运行测试确认无回归**

```bash
cd backend && npm test -- backend/tests/integration/sse-upstream-premature-close.test.ts
```

预期：测试通过（验证 premature close 场景下仍能正确补齐 message_stop）

---

## Task 3: 更新单元测试覆盖即时 message_delta 行为

**文件：**
- 修改: `backend/tests/transformers/protocols/codex/sse.test.ts`

**背景：** 需要验证 tool call 完成后立即发送 `message_delta(stop_reason=tool_use)` 的行为。

**Step 1: 查看现有测试结构**

```bash
grep -A 30 "tool.*call\|function_call" backend/tests/transformers/protocols/codex/sse.test.ts | head -60
```

预期：找到现有的 tool call 相关测试

**Step 2: 添加测试验证即时 message_delta**

在适当位置添加测试（如果不存在）：

```typescript
it('应在 tool call 完成后立即发送 message_delta(stop_reason=tool_use)', () => {
  const codexEvents: CodexSSEEvent[] = [
    { type: 'response.created', id: 'test-123', status: 'in_progress' },
    {
      type: 'response.output_item.done',
      item: {
        type: 'function_call',
        call_id: 'call_123',
        name: 'TestTool',
        arguments: '{"arg":"value"}',
      },
    },
  ];

  const result = transformCodexSSEToClaude(
    codexEvents,
    { customToolCallStrategy: 'wrap_object' },
    new FieldAuditCollector(),
  );

  // 验证 content_block_stop 存在
  const blockStopEvent = result.events.find(e => e.type === 'content_block_stop');
  expect(blockStopEvent).toBeDefined();

  // 验证在 content_block_stop 之后立即发送了 message_delta
  const blockStopIndex = result.events.findIndex(e => e.type === 'content_block_stop');
  const nextEvent = result.events[blockStopIndex + 1];
  expect(nextEvent?.type).toBe('message_delta');
  expect((nextEvent as any).delta?.stop_reason).toBe('tool_use');
});
```

**Step 3: 运行新测试**

```bash
cd backend && npm test -- backend/tests/transformers/protocols/codex/sse.test.ts -t "tool call.*message_delta"
```

预期：测试通过

**Step 4: Git commit**

```bash
git add backend/tests/transformers/protocols/codex/sse.test.ts
git commit -m "测试：验证 tool call 完成后即时发送 message_delta"
```

---

## Task 4: 验证集成场景下的 tool loop 触发

**文件：**
- 创建临时测试文件用于验证（可选）

**背景：** 需要验证完整场景下 Claude Code Router 能正确收到 `message_delta` 并触发 tool loop。

**Step 1: 使用现有的 SSE upstream premature close 测试**

```bash
cd backend && npm test -- backend/tests/integration/sse-upstream-premature-close.test.ts
```

预期：测试通过（验证 upstream 提前断开时仍能补齐 message_stop）

**Step 2: 手动测试（可选，需要实际环境）**

如果需要手动验证完整 tool loop：

1. 启动 PromptXY 服务
2. 使用 Claude Code 发送带 tool 的请求
3. 观察 SSE 事件序列中 `message_delta` 的出现时机

**Step 3: 对比工作版本的输出**

```bash
git show 8a28353:backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts | grep -A 10 "transformToolCall" | grep -A 5 "content_block_stop"
```

预期：工作版本在 `content_block_stop` 后立即发送 `message_delta`

---

## Task 5: 更新文档说明 tool use 事件序列

**文件：**
- 创建/修改: `docs/protocols/codex-to-claude-transformation.md`（如不存在则创建）

**背景：** 记录 Codex → Claude 转换中 tool use 的事件序列要求，便于未来维护。

**Step 1: 创建转换器文档**

创建文件 `docs/protocols/codex-to-claude-transformation.md`：

```markdown
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
```

**Step 2: Git commit**

```bash
git add docs/protocols/codex-to-claude-transformation.md
git commit -m "文档：记录 Codex→Claude tool use 事件序列要求"
```

---

## Task 6: 完整回归测试

**文件：**
- 全量测试套件

**背景：** 确保修改没有破坏其他场景。

**Step 1: 运行完整测试套件**

```bash
cd backend && npm test
```

预期：所有测试通过

**Step 2: 运行特定的转换器测试**

```bash
cd backend && npm test -- backend/tests/transformers/
```

预期：所有转换器测试通过

**Step 3: 运行集成测试**

```bash
cd backend && npm test -- backend/tests/integration/
```

预期：所有集成测试通过

---

## Task 7: 代码审查和清理

**文件：**
- 所有修改的文件

**背景：** 确保代码质量和一致性。

**Step 1: 检查代码风格**

```bash
npm run lint:backend
```

预期：无 lint 错误

**Step 2: 检查类型**

```bash
cd backend && npx tsc --noEmit
```

预期：无类型错误

**Step 3: 最终 Git commit**

```bash
git add -A
git commit -m "完成：Codex→Claude 转换器 tool use 修复

主要变更：
- 恢复 tool call 完成后即时发送 message_delta(stop_reason=tool_use)
- 添加单元测试验证即时 message_delta 行为
- 创建转换器文档记录事件序列要求
- 完整回归测试通过

对齐参考：
- docs/protocols/claude-messages-spec.md §6.2
- refence/claude-code-router/src/index.ts:264-312

修复问题：commit a9f3378 移除即时 message_delta 导致 tool loop 无法触发
"
```

---

## 验收标准

完成所有任务后，应满足：

1. ✅ Tool call 完成后立即发送 `message_delta(stop_reason=tool_use)`
2. ✅ 所有现有测试通过
3. ✅ 新增测试覆盖即时 message_delta 行为
4. ✅ 文档记录 tool use 事件序列要求
5. ✅ 无 lint 或类型错误
6. ✅ 对齐 Claude Code 协议规格和参考实现

---

## 相关参考

- **协议规格：** `docs/protocols/claude-messages-spec.md`
- **协议规格：** `docs/protocols/codex-responses-spec.md`
- **参考实现：** `refence/claude-code-router/src/index.ts:264-312`
- **工作版本：** commit 8a28353
- **问题版本：** commit a9f3378
