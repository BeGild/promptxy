# Tasks: 增强 Claude → Codex 转换器以支持完整 Claude Code 特性

## 0. 提案准备与基线确认

- [x] 0.1 确认 v1 边界：仅增强现有转换器，不改变架构
- [x] 0.2 审查当前转换器实现，确认增强点位置
- [x] 0.3 收集参考项目（cc-switch、claude-relay-service）的相关代码片段作为测试 fixture

## 1. Stop Reason 映射（P0）

**📚 参考**: `refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:327-338`

- [x] 1.1 添加 `mapStopReason` 工具函数到 `sse/to-claude.ts`
  - **参考**: cc-switch `map_stop_reason` 函数实现
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:64-77`

- [x] 1.2 更新 `createMessageDeltaEvent` 调用，传入映射后的 stop_reason
  - **参考**: cc-switch 第 284-300 行 usage 映射逻辑
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:293-296`

- [x] 1.3 更新 `transformCodexResponseToClaude` 非流式转换使用映射函数
  - **参考**: cc-switch stop_reason 处理
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/response.ts:15-28, 53, 100`

- [x] 1.4 添加 Stop Reason 映射单元测试（覆盖所有映射情况）
  - **测试用例**: tool_calls → tool_use, stop → end_turn, length → max_tokens, null/default → end_turn
  - **测试文件**: `backend/tests/transformers/protocols/codex/sse.test.ts:19-36, response.test.ts:11-75`

## 2. Image 内容支持（P0）

**📚 参考**:
- Claude 类型: `backend/src/promptxy/transformers/protocols/claude/types.ts:32-40`
- Codex 类型: `backend/src/promptxy/transformers/protocols/codex/types.ts:46-54`
- Base64 处理: `refence/claude-relay-service/src/services/openaiToClaude.js:238-290`

- [x] 2.1 在 `render.ts` 的 `renderInput` 函数中添加 image block 处理逻辑
  - **参考**: claude-relay-service `_convertMultimodalContent` 函数（第 238-290 行）
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/render.ts:204-219`

- [x] 2.2 更新类型定义确保 image block 正确识别和处理
  - **参考**: `CodexInputImageItem` 类型定义
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/render.ts:14, types.ts:47-54`

- [x] 2.3 添加 Image 转换单元测试（URL 和 base64 格式）
  - **测试场景**: data URL 格式图片、HTTP URL 格式图片
  - **测试文件**: `backend/tests/transformers/protocols/codex/render.test.ts:24-96`

- [ ] 2.4 验证 Codex 上游正确接收 input_image item
  - **验证方法**: 发送包含图片的请求，检查上游请求体

## 3. Reasoning 推理内容支持（P0）

**📚 参考**:
- Codex SSE 事件: `refence/codex/codex-rs/codex-api/src/sse/responses.rs:220-241`
- Thinking 映射: `refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:147-175`

- [x] 3.1 扩展 State 类型，添加 reasoning 相关状态字段
  - **参考**: cc-switch 第 73-76 行 current_block_type 状态跟踪
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:26-43, 48-58`

- [x] 3.2 在 `transformSingleEvent` 中添加 `response.reasoning_text.delta` 事件处理
  - **参考**: cc-switch 第 147-175 行 reasoning 处理逻辑
  - **参考**: codex-rs 第 231-241 行 reasoning_text.delta 事件定义
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:228-246`

- [x] 3.3 在 `transformSingleEvent` 中添加 `response.reasoning_summary_text.delta` 事件处理
  - **参考**: codex-rs 第 220-230 行 reasoning_summary_text.delta 事件定义
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:248-264`

- [x] 3.4 创建 `createThinkingBlockStartEvent` 和 `createThinkingDeltaEvent` 工具函数
  - **参考**: cc-switch 第 150-174 行 thinking 事件创建
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:364-411`

- [x] 3.5 更新 Claude SSE 类型定义，支持 `thinking` block 类型
  - **参考**: cc-switch 第 151-156 行 thinking content_block 结构
  - **修改位置**: `backend/src/promptxy/transformers/protocols/claude/types.ts:124, 129, 148-172`

- [x] 3.6 添加 Reasoning 转换单元测试（状态机转换）
  - **测试场景**: reasoning_text.delta → thinking_delta, reasoning_summary_text.delta → thinking_delta
  - **测试文件**: `backend/tests/transformers/protocols/codex/sse.test.ts:64-118`

- [ ] 3.7 添加 Reasoning 集成测试（完整 SSE 流）
  - **Fixture 来源**: `refence/codex/codex-rs/codex-api/src/sse/responses.rs:415-472`

## 4. Usage 信息增强（P1）

**📚 参考**:
- Codex Usage: `refence/codex/codex-rs/codex-api/src/sse/responses.rs:85-116`
- Usage 映射: `refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:285-289`

- [x] 4.1 扩展 `message_delta` 事件的 usage 类型定义
  - **参考**: codex-rs 第 92-99 行 ResponseCompletedUsage 结构
  - **修改位置**: `backend/src/promptxy/transformers/protocols/claude/types.ts:191-195`

- [x] 4.2 在 `transformSingleEvent` 中从 `response.completed` 提取详细 usage
  - **参考**: codex-rs 第 269-283 行 response.completed 处理
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:270-291, types.ts:294-314`

- [x] 4.3 更新 `createMessageDeltaEvent` 支持扩展 usage 字段
  - **参考**: cc-switch 第 286-289 行 usage_json 构建
  - **修改位置**: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts:454-463`

- [x] 4.4 添加 Usage 增强测试（cached_tokens、reasoning_tokens）
  - **测试场景**: 包含 cached_tokens 的响应、包含 reasoning_tokens 的响应
  - **测试文件**: `backend/tests/transformers/protocols/codex/sse.test.ts:120-155`

## 5. 测试与验证

- [x] 5.1 创建 SSE event 测试 fixture（基于参考项目样本）
  - **Fixture 来源**: `refence/codex/codex-rs/codex-api/src/sse/responses.rs:415-472`
  - **测试用例**: `parses_items_and_completed` 包含完整 SSE 事件
  - **测试文件**: `backend/tests/transformers/protocols/codex/sse.test.ts`

- [x] 5.2 创建完整请求-响应循环集成测试
  - **参考**: cc-switch 第 82-324 行完整流式处理流程
  - **测试文件**: `backend/tests/transformers/protocols/codex/render.test.ts, response.test.ts`

- [ ] 5.3 与 cc-switch 项目输出对比验证
  - **验证方法**: 相同输入，对比输出 SSE 事件序列

- [x] 5.4 回归测试确保现有功能不受影响
  - **测试范围**: 现有消息转换、工具调用、基本 SSE 流
  - **结果**: 所有 265 个测试通过

## 6. 文档更新

- [ ] 6.1 更新转换器功能清单文档
- [ ] 6.2 添加 Reasoning 支持说明
- [ ] 6.3 添加 Image 支持说明
- [ ] 6.4 添加 Stop Reason 映射表
- [ ] 6.5 更新已知限制文档

---

## 实现总结

### ✅ 已完成的核心功能

1. **Stop Reason 映射** - 正确映射 Codex finish_reason 到 Claude stop_reason
2. **Image 支持** - 转换 Claude image block 到 Codex input_image item
3. **Reasoning 支持** - 转换推理内容到 Claude thinking block
4. **Usage 增强** - 包含 cached_tokens 和 reasoning_tokens

### 📝 修改的文件

**核心实现：**
- `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts` - SSE 转换器
- `backend/src/promptxy/transformers/protocols/codex/response.ts` - 响应转换器
- `backend/src/promptxy/transformers/protocols/codex/render.ts` - 请求渲染器

**类型定义：**
- `backend/src/promptxy/transformers/protocols/codex/types.ts` - Codex 类型
- `backend/src/promptxy/transformers/protocols/claude/types.ts` - Claude 类型

**测试文件：**
- `backend/tests/transformers/protocols/codex/sse.test.ts` - SSE 转换测试（15 个测试用例）
- `backend/tests/transformers/protocols/codex/render.test.ts` - 渲染器测试（15 个测试用例）
- `backend/tests/transformers/protocols/codex/response.test.ts` - 响应转换测试（18 个测试用例）

### 🧪 测试结果

- **新增测试**: 48 个测试用例
- **回归测试**: 所有 265 个测试通过
- **测试覆盖率**: 核心转换逻辑已全面覆盖

### 🎯 下一步

1. 与实际 Codex 上游集成验证
2. 与 cc-switch 项目输出对比
3. 完善文档说明
