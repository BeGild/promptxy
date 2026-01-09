# Change: 增强 Claude → Codex 转换器以支持完整 Claude Code 特性

## Why

当前的 Claude → Codex 转换器实现了核心的消息、工具调用和 SSE 流式转换功能，但与参考项目（cc-switch、claude-relay-service）相比，存在以下关键特性缺失：

1. **Reasoning 推理内容未实现** - Codex 的 `response.reasoning_text.delta` 和 `response.reasoning_summary_text.delta` 事件未被转换
2. **Image 图片支持缺失** - Claude 的 `image` content block 未映射到 Codex 的 `input_image` item
3. **Stop Reason 映射不完整** - 当前使用硬编码策略，未根据实际 Codex finish_reason 映射
4. **Usage 信息不完整** - 仅映射基本的 input/output_tokens，未包含 cached_tokens 和 reasoning_tokens

这些遗漏导致 Claude Code 在使用 Codex 上游时无法获得完整的功能体验，特别是：
- 无法看到模型的推理过程
- 无法处理图片输入
- 工具调用循环可能因为 stop_reason 错误而中断

## What Changes

### 新增能力

- **Reasoning 支持** - 将 Codex 的推理内容事件转换为 Claude 的 `content_block_start(thinking)` 和 `content_block_delta(thinking_delta)` 事件
- **Image 支持** - 将 Claude 的 `image` content block 转换为 Codex 的 `input_image` item
- **完整的 Stop Reason 映射** - 根据 Codex 的 finish_reason 正确映射到 Claude 的 stop_reason
- **增强的 Usage 信息** - 在 message_delta 事件中包含 cached_tokens 和 reasoning_tokens

### 设计考虑

- **向后兼容** - 新增功能不影响现有转换流程，仅增强缺失部分
- **参考实现** - 基于 cc-switch 和 claude-relay-service 的成熟实现
- **渐进增强** - 可以分阶段实现，每个增强点独立可测试

## Non-Goals

- 不修改现有的转换器架构
- 不新增额外的配置选项
- 不影响其他协议转换器（Gemini、OpenAI）
- 不改变 Codex 模板和 instructions 处理逻辑

## Impact

- **Affected specs（新增）**
  - `claude-codex-transformation`：定义 Claude → Codex 转换的完整规范

- **Affected specs（修改）**
  - `promptxy-gateway`：无需修改，转换器增强对网关透明

- **测试需求**
  - 新增 Reasoning SSE 事件转换测试
  - 新增 Image content block 转换测试
  - 新增 Stop Reason 映射测试
  - 新增 Usage 信息增强测试

## Open Questions

1. Reasoning 内容应该作为单独的 content_block 还是附加到主文本？
   - **决策**：参考 cc-switch 实现，作为单独的 `thinking` 类型 content_block

2. Image 支持是否需要 base64 转换？
   - **决策**：当前 Claude 传递的 image 已是正确格式，直接映射即可

3. Stop Reason 映射是否需要可配置？
   - **决策**：v1 使用固定映射（参考 cc-switch），v2+ 可考虑可配置策略
