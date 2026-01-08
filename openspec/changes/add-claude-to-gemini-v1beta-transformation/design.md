# Design: Claude Code → Gemini(v1beta) 协议转换（请求/响应/流式工具调用）

本文档把 `docs/protocol-transformation-gemini-v1.md` 的“可落地草案”收敛为可实施的工程设计与验收边界，并尽量对齐现有 PromptXY transformers 组织方式（参见 `openspec/changes/refactor-transformer-pipeline/design.md` 的目录建议）。

## Goals（v1）

1. **工具调用闭环可用（含流式）**：Claude Code 侧能稳定完成 tool loop（tool_use → tool_result → 继续生成）。
2. **SSE 语义对齐**：下游看到的是 Anthropic SSE 事件序列，而非 Gemini SSE 原文。
3. **稳定、可观测、可调试**：每个关键映射与丢弃行为都有 trace/FieldAudit 证据，且默认不泄漏 secret。
4. **可渐进增强**：v1 先覆盖 P0/P1（文本 + tools + streaming + count_tokens），图片/代码执行等扩展按 part 类型逐步补齐。

## Non-Goals（v1）

- Vertex/OAuth、Router、多候选（candidateCount>1）的语义合并。
- 把 Gemini “thought” 等内部字段暴露给 Claude；v1 只做过滤与审计。

## High-level Flow

```
Claude Request (/v1/messages or /v1/messages/count_tokens)
  |
  | 1) Parse + Normalize (Claude blocks preserved)
  v
Claude → Gemini(v1beta) Transform
  - model mapping (route.claudeModelMap)
  - systemInstruction(role="user")
  - contents(role user/model, parts text/tool)
  - tools(functionDeclarations + schema sanitize)
  - generationConfig mapping
  - headers mapping (strip anthropic/x-stainless, add x-goog-api-key optional)
  - URL action selection (+ alt=sse)
  v
Upstream Gemini API (generateContent / streamGenerateContent?alt=sse / countTokens)
  |
  | 2a) Non-stream JSON → Claude JSON
  | 2b) Stream SSE → parse events → state machine → Claude SSE
  v
Claude Response (JSON or SSE)
```

## Key Decisions

### Decision 1: 选择标准 Gemini API v1beta（API Key 模式）

- 非流式：`POST /v1beta/models/{model}:generateContent`
- 流式：`POST /v1beta/models/{model}:streamGenerateContent?alt=sse`
- countTokens：`POST /v1beta/models/{model}:countTokens`
- 鉴权优先：query `?key=...`，header `x-goog-api-key` 兜底

### Decision 2: `systemInstruction.role` 固定为 `"user"`

为了避免 `role: "model"` 带来的不可预期行为，v1 统一固定为 `"user"`，并在 trace 中标注原因。

### Decision 3: tool_use_id 生成与关联策略（Claude Code 兼容）

Gemini v1beta 的 `functionCall` 通常不提供可复用的 `id` 字段；而 Claude Code 依赖 `tool_use.id` 与 `tool_result.tool_use_id` 对齐。

因此 v1 使用“本地生成 + 内部映射表”：

- 生成格式：`toolu_${timestamp}_${index}`（必须 `toolu_` 前缀）
- 生成时机：第一次观察到一个新的 functionCall（流式 chunk 或非流式 part）
- 关联方式：
  - `tool_use_id -> { toolName, argsDigest }`
  - 发送给 Gemini 的 `functionResponse.id` 使用 **Claude tool_use_id**（客户端控制字段）

### Decision 4: SSE 转换采用状态机，最小状态但覆盖分片 args

Gemini SSE 中 `functionCall.args` 可能分片到达；v1 引入 `pendingToolCall` 累积合并，并以“遇到下一个 text part 或 finishReason”作为工具调用完成边界（同时在 trace 记录边界判定原因）。

## URL 构造与 baseUrl 兼容规则

为了兼容不同 supplier 的 `baseUrl` 配置，v1 采用以下规则（并将最终结果写入 trace）：

- `baseUrl` 允许：
  - `https://generativelanguage.googleapis.com`
  - `https://generativelanguage.googleapis.com/v1beta/models`
- 生成规则：
  - 若 `baseUrl` 以 `/v1beta/models` 结尾：拼接 `/{model}:{action}`
  - 否则：拼接 `/v1beta/models/{model}:{action}`
- 流式时必须附加：`alt=sse`
- 鉴权优先：query `key=<API_KEY>`

## 请求侧映射（Claude → Gemini）

### 1) contents 角色映射

- `user` → `user`
- `assistant` → `model`

### 2) text parts

- Claude `content`（string 或 blocks）中的 text → Gemini `parts: [{ text }]`
- 规范化后合并相邻 text block（避免产生大量碎片）

### 3) tools（functionDeclarations）

- Claude `tools[].input_schema` → Gemini `functionDeclarations[].parameters`
- v1 必须做 schema sanitize（目标：提高注册成功率 + 可观测）
  - 白名单字段保留
  - `format` 做白名单过滤（不支持的 format 删除）
  - `anyOf/oneOf/allOf`：按评审结论落地固定策略
  - 检测循环引用/过深嵌套：直接 error，避免上游/本地崩溃
  - 审计：记录 removed field paths + warnings

### 4) tool_use/tool_result

- `tool_use`：在 Gemini contents 中以 `functionCall` part 表达（如果需要注入“历史工具调用”）
- `tool_result`：以 `functionResponse` part 表达
  - `functionResponse.id = tool_use_id`（关键）
  - `functionResponse.name = toolName`
  - `functionResponse.response`：对 Claude `tool_result.content` 做约束性序列化（string → `{result: ...}`；错误 → `{error: ..., is_error: true}`；object → 直通）

### 5) generationConfig

按映射表写入（不支持字段忽略 + trace warning）：

- `max_tokens` → `maxOutputTokens`
- `temperature` → `temperature`
- `top_p` → `topP`
- `stop_sequences` → `stopSequences`

## 响应侧映射（Gemini → Claude，非流式）

- 默认取 `candidates[0]`
- 对 `content.parts` 先做 consolidate（合并相邻纯 text parts；过滤 thought）
- parts 映射：
  - `{text}` → Claude `text`
  - `{functionCall}` → Claude `tool_use`（生成 toolu_ id）
  - 其他 part（inlineData/fileData/codeExecutionResult 等）：
    - v1 策略：保守过滤并 trace warning；待后续分阶段补齐映射
- `usageMetadata` → Claude `usage`
  - `promptTokenCount` → `input_tokens`
  - `candidatesTokenCount` → `output_tokens`

## Streaming：Gemini SSE → Claude SSE

### 1) SSE 解析

使用通用 SSE parser 将 `data:` 的 JSON 行解析为 `GenerateContentResponse` chunk；再交由 Gemini-specific 状态机消费。

### 2) Claude SSE 输出事件序列（约束）

典型文本流：

1. `message_start`
2. `content_block_start`（index=0, type=text）
3. 多个 `content_block_delta`（text_delta）
4. （可选）`message_delta`（usage/stop_reason）
5. `message_stop`

典型 tool call 流：

1. message/text 事件（同上，可能为空文本）
2. `content_block_start`（type=tool_use, id=toolu_..., name=...）
3. 一个或多个 `content_block_delta`（input_json_delta，保证最终拼接为合法 JSON）
4. `content_block_stop`
5. `message_delta`（用于触发 Claude Code 下一轮 tool loop）
6. `message_stop`（最终结束）

### 3) 状态机（最小但可用）

建议状态：

- `messageStarted`
- `textBlockStarted`
- `messageStopped`
- `pendingToolCall`（累积 args）
- `toolIndex`（递增）
- `usageMetadata`（累积合并，可能分散在多个 chunk）
- `finishReason`（最终停止原因）

关键边界：

- tool call 完成：遇到 “新的 text part” 或 “finishReason 出现” 或 “流结束”
- usageMetadata：多 chunk 合并，以最后一次出现为准（merge）

### 4) finishReason 映射

将 Gemini finishReason 映射到 Claude `stop_reason`（未知 → `end_turn`），并按严重性写入 trace。

### 5) Invalid stream 检测与重试

对齐 gemini-cli 的判定：若无 tool call 且

- 无 finishReason，或
- finishReason 为 `MALFORMED_FUNCTION_CALL`，或
- responseText 为空

则视为 invalid stream：

- 下游必须收到 Claude SSE `event: error` + `event: done`
- 是否进行内部重试（最多 1 次）由评审结论决定，并写入 trace

## count_tokens（兼容策略）

当下游调用 `/v1/messages/count_tokens` 时：

- 方案 A（推荐）：转换到 Gemini `:countTokens` 并返回 `{ input_tokens }`
- 方案 B（兜底）：本地估算并标记 `count_tokens_fallback=true`

## Test Strategy（v1 验收）

以脱敏 fixtures 覆盖至少：

1. 纯文本：stream=false / stream=true
2. tools 但不触发：stream=false / stream=true
3. tools 且触发（含 args 分片模拟）：stream=false / stream=true
4. count_tokens：成功 + fallback

每个用例验证：

- 上游 URL 是否符合规范（action + alt=sse + key）
- tools schema 是否可被上游接受（至少通过本地 sanitize/validate）
- 下游 SSE 事件序列是否满足 Claude Code 解析预期（message_start → … → message_stop；tool_use 序列正确）

