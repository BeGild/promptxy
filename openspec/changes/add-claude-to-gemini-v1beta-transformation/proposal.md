# Change: Claude Code → Gemini(v1beta) 协议转换（含工具调用与 SSE 流式闭环）

## Why

PromptXY 目前已具备 Claude Code（Anthropic Messages）作为统一下游入口，并在 `/claude` 路径上支持“跨协议转发”的路由框架；但 **Claude → Gemini 上游（标准 Gemini API v1beta，API Key 模式）** 仍缺少一套可验证、可维护、与 Claude Code 语义一致的端到端转换实现，尤其在以下关键路径：

- **工具调用闭环**：Claude `tool_use/tool_result` ↔ Gemini `functionCall/functionResponse`
- **流式语义对齐**：Gemini SSE（`alt=sse`）→ Claude SSE（Anthropic SSE 事件序列）
- **Claude Code 生态兼容**：`/v1/messages/count_tokens`（可选但强烈建议 v1 支持）

没有该能力时，用户即使能“转发成功”，也会在工具调用/流式等场景出现隐性退化，且缺乏足够可观测证据定位问题。

## What Changes

### 新增能力（v1 必须交付）

- 新增 `claude → gemini(v1beta)` 协议转换实现（请求侧 + 响应侧）
  - 支持 `stream=false` 的 JSON 响应转换
  - 支持 `stream=true` 的 SSE 解析 → 状态机转换 → Claude SSE 序列化
- 工具调用闭环（含流式工具调用）
  - Gemini `functionCall` 触发 Claude `tool_use` SSE 序列
  - Claude `tool_result` 映射回 Gemini `functionResponse`
  - 明确并落地 **tool_use_id 生成与关联策略**（兼容 Claude Code 的 `toolu_` 前缀格式）
- 上游请求构造规范化（可观测、可验证）
  - `generateContent` / `streamGenerateContent?alt=sse` 的路径与 query 组合规则
  - 鉴权优先级：`?key=` 优先，`x-goog-api-key` 作为备选
  - Header 清洗：移除 `anthropic-*`、`x-stainless-*` 等 Claude SDK 特定头
- finishReason / stop_reason 完整映射与可观测告警分级（info/warn/error）

### v1 强烈建议纳入（避免 Claude Code 功能退化）

- `/v1/messages/count_tokens` 兼容：
  - 优先：转换到 Gemini `:countTokens`
  - 失败兜底：本地估算（并在 trace 中标注 fallback）

### 可验证性（必须）

- Trace/FieldAudit 增强：至少可回答
  - URL 构造（baseUrl 兼容、最终 action、是否附加 `alt=sse`、鉴权注入方式）
  - tools schema sanitize 的移除/降级证据（字段路径）
  - streaming 状态机关键节点（message_start/stop、tool call 的开始/结束、finishReason）

## Non-Goals（v1 明确不做）

- 不实现 `gemini <-> openai/codex` 双向互转
- 不实现 Vertex AI / OAuth 鉴权（仅 API Key 模式）
- 不引入 Router/多上游智能路由（沿用现有 route → supplier 选择）
- 不强制把 Gemini “thought” 等内部字段暴露给 Claude（只做安全过滤与 trace 记录）

## Impact

- Affected specs
  - `promptxy-protocol-transformation`：新增 Gemini v1beta 转换规范（请求/响应/stream/tools/errors/count_tokens）
- Affected code areas（实现阶段）
  - `backend/src/promptxy/transformers/protocols/gemini/*`（新增）
  - `backend/src/promptxy/transformers/sse/*`（复用通用 SSE 解析；新增 Gemini SSE→Claude SSE 状态机）
  - `backend/src/promptxy/gateway.ts`（仅接入点；不改变既有安全约束）
  - fixtures/回归用例（脱敏后的 Claude Code 真实样例）

## Open Questions（评审时必须确认）

1. **上游 URL 构造职责**：Gemini action 路径（`models/{model}:generateContent` / `:streamGenerateContent` / `:countTokens`）由转换器负责生成，还是由 pathMapping 层负责？（当前建议：由 Gemin Transformer 生成，以避免 pathMapping 无法表达 `model` 动态段与 action 分叉。）
2. **`anyOf/oneOf/allOf` 降级策略**：tools schema sanitize 在遇到组合关键字时，v1 选择“保留并 warning”还是“降级第一分支”还是“拒绝并报错”？（该选择会直接影响工具注册成功率与可预测性。）
3. **Invalid stream 的重试策略**：是否按 gemini-cli 的保守策略：`maxAttempts=2`（1 次重试）？重试是否需要向客户端显式暴露，还是仅写入 trace？

