# Change: Add Codex count_tokens Adapter

## Why

PromptXY 网关当前支持 `/v1/messages` 端点，用于 Claude Messages API 的消息生成。然而，在集成上游 Codex (OpenAI 协议) 供应商时，缺少对 Claude 标准的 `/v1/messages/count_tokens` API 的支持，这限制了 Token 计算功能的完整性和跨协议一致性。

## What Changes

- 新增 Codex 协议的 `count_tokens` 转换器，支持混合策略（上游 API + 本地 fallback）
- 扩展 Claude 适配器，添加 `handleClaudeCountTokens` 函数处理 count_tokens 请求
- 修改网关路由，添加 `/v1/messages/count_tokens` 端点识别和分发逻辑
- 新增上游 API 能力检测工具，用于探测供应商是否支持 count_tokens 端点
- 统一 Token 计算工具，支持字节估算作为统一降级策略

**关键决策点**：
- **Gemini 转换器**：完全复用现有实现（基于 js-tiktoken），无需修改
- **Anthropic 供应商**：原生支持 count_tokens API，网关透明转发即可，无需转换
- **Codex 转换器**：采用混合策略，优先尝试上游 API（如果支持），否则使用本地字节估算
- **统一降级策略**：所有渠道均支持字节估算（字符数 / 3），作为兜底方案

## Impact

- **受影响的规范**：`promptxy-gateway`（新增 count_tokens 端点路由能力）
- **受影响的代码**：
  - 新增：`backend/src/promptxy/utils/upstream-detector.ts`（上游 API 能力检测）
  - 新增：`backend/src/promptxy/utils/token-counter.ts`（统一的 Token 计算工具）
  - 新增：`backend/src/promptxy/transformers/protocols/codex/count-tokens.ts`（Codex count_tokens 转换器）
  - 修改：`backend/src/promptxy/adapters/claude.ts`（添加 count_tokens 处理）
  - 修改：`backend/src/promptxy/gateway.ts`（添加路由集成）
- **向后兼容性**：完全兼容，不破坏现有 `/v1/messages` 端点功能
- **性能影响**：最小，本地字节估算性能优于 tiktoken 编码
- **用户体验**：提供统一的 Token 计算接口，支持跨供应商一致性

## Breaking Changes

无破坏性变更，这是一个纯新增功能。
