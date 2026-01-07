# Codex（OpenAI Responses API /v1/responses，Codex CLI 视角）协议规格（v1）

> 本文档是**规格（spec）**，目标是把 `refence/codex` 中 Codex CLI 对 OpenAI **Responses API**（`POST /v1/responses`）的实际用法沉淀为**可追溯、可维护**的参考基线，服务于 PromptXY 的 `/claude -> /codex` 对齐、审计与回归测试。

**版本**：v1.0  
**更新时间**：2026-01-06  
**参考实现（协议生产者/消费者）**：`refence/codex/codex-rs/*`  
**关联实现（PromptXY 当前代码，仅用于对齐参考）**：`backend/src/promptxy/transformers/*`

---

## 0. 范围与非目标

### 覆盖范围（本 spec 关注点）

- `POST /v1/responses` 的**请求体结构**（`ResponsesApiRequest`）
- `input[]` 的关键项类型（message / function_call / function_call_output 等）
- `tools[]` 的工具定义结构（Responses API tool）
- `stream=true` 的 SSE 事件类型与 data 结构（`response.*`）
- tool call 的关键约束：`call_id` 对称性、`arguments` 是 JSON string 等

### 非目标（暂不覆盖）

- OpenAI 官方全量字段（以 `refence/codex` 的实现为准）
- Chat Completions API（/chat/completions）兼容层细节（本期目标是 codex=/responses）

---

## 1. HTTP 端点与 Headers（Codex CLI 的实际行为）

### 1.1 端点

- **Method**：`POST`
- **Path**：通常为 `/v1/responses`（不同 provider 可能映射到其他路径，但 payload 不变）

**代码定位**

- `/responses` 请求 builder：`refence/codex/codex-rs/codex-api/src/requests/responses.rs:97`～`:143`

### 1.2 关键 Headers（Codex 会主动设置/注入的）

- `originator`：默认 originator（用于服务端识别调用方）
- `User-Agent`：以 originator 为前缀构造

**代码定位**

- 默认 originator header：`refence/codex/codex-rs/core/src/default_client.rs:130`～`:151`

### 1.3 conversation_id / session_id（对“线程/会话”很关键）

当 Codex builder 拿到 conversationId，会同时设置：

- `conversation_id: <id>`
- `session_id: <id>`

**代码定位**

- build_conversation_headers：`refence/codex/codex-rs/codex-api/src/requests/headers.rs:5`～`:12`

> 对 PromptXY 的含义：如果你希望 Claude Code 的 session 语义与 Codex 对齐，可以在内部把 Claude 的 sessionId（可从 metadata.user_id 解析）映射为 Codex 的 conversation_id/session_id（具体策略属于后续转换设计，不属于本协议 spec）。

---

## 2. 请求体：`ResponsesApiRequest`（字段结构与默认值）

Codex 的 `/responses` 请求体由 `ResponsesApiRequest` 序列化得到，字段如下（按实现定义）：

- `model: string`
- `instructions: string`
- `input: ResponseItem[]`
- `tools: any[]`（JSON values 列表）
- `tool_choice: string`（Codex builder 当前固定 `"auto"`）
- `parallel_tool_calls: boolean`
- `reasoning?: { effort?: ..., summary?: ... }`
- `store: boolean`
- `stream: boolean`
- `include: string[]`
- `prompt_cache_key?: string`
- `text?: { verbosity?: "low"|"medium"|"high", format?: { type:"json_schema", strict:true, schema, name } }`

**代码定位**

- `ResponsesApiRequest` struct：`refence/codex/codex-rs/codex-api/src/common.rs:121`～`:137`

**默认值/构造位置（builder）**

- builder 固定 `tool_choice: "auto"` 与 `stream: true`：`refence/codex/codex-rs/codex-api/src/requests/responses.rs:113`～`:126`

---

## 3. `input[]`：ResponseItem（工具闭环的核心载体）

Responses API 的 `input` 不是“messages 数组”，而是一个**多类型 item 数组**。Codex 用 `ResponseItem` enum 表达其形态。

### 3.1 ResponseItem 关键类型（节选）

> 这里列出对 PromptXY `/claude -> /codex` 对齐最关键的项类型；完整列表以源码为准。

- `type:"message"`：包含 `role` 与 `content[]`（content item type 如 input_text / input_image / output_text）
- `type:"function_call"`：包含 `call_id/name/arguments`
  - **注意**：`arguments` 在 Responses API 中是一个**string**，其内容是 JSON 文本（而不是已经 parse 成 object）
- `type:"function_call_output"`：包含 `call_id/output`
- `type:"custom_tool_call"`：包含 `call_id/name/input`
- `type:"custom_tool_call_output"`：包含 `call_id/output`
- `type:"local_shell_call"` / `type:"web_search_call"`：Codex 内置工具/能力项（对 Claude Code 的“工具”语义对齐很有参考价值）

**代码定位**

- `ResponseItem` enum：`refence/codex/codex-rs/protocol/src/models.rs:65`～`:159`
- `arguments 是 JSON string` 的注释与字段：`refence/codex/codex-rs/protocol/src/models.rs:95`～`:106`

### 3.2 tool output 的 output 形态（兼容性点）

Codex 在 `function_call_output.output` 上存在多种历史/兼容形态。为避免“只按一种形态实现导致 tool 结果丢失”，对接侧应至少兼容下面三类：

1) `output` 为 **string**
2) `output` 为 **结构化 items 列表**（例如 `[{type:"input_text",...},{type:"input_image",...}]`）
3) `output` 为 **object**（形如 `{content: string, success?: boolean}`，常用于“失败”或兼容路径）

**代码定位**

- `FunctionCallOutputPayload` 定义：`refence/codex/codex-rs/protocol/src/models.rs:395`～`:402`
- serialize 规则（items vs string）：`refence/codex/codex-rs/protocol/src/models.rs:411`～`:425`（说明：Codex CLI 发往 `/v1/responses` 时主要走这两种形态）
- deserialize 规则（string 或 items）：`refence/codex/codex-rs/protocol/src/models.rs:427`～`:447`
- “object 形态”的兼容读取（测试 helper 会解析 `{content, success}`）：`refence/codex/codex-rs/core/tests/common/responses.rs:154`～`:173`
- 备注：`models.rs` 内的注释提到失败时可能需要 `{content, success:false}` 的形态，但与当前 serialize 实现存在不一致，属于**需谨慎对待的兼容点**（证据：`refence/codex/codex-rs/protocol/src/models.rs:107`～`:114` 与 `:411`～`:425`）

> 对 PromptXY 的含义：当你把 Codex tool call 结果转换回 Claude tool_result 时，不能假设 output 永远是纯字符串；需要兼容 items（例如 image/text 混合）。

---

## 4. `tools[]`：Responses API 的工具定义形态（Codex 内部 ToolSpec）

Codex 内部把 tools 表达为 `ToolSpec`，序列化后即为 Responses API 可接受的工具定义 JSON（至少支持 function/local_shell/web_search/custom）。

**代码定位**

- `ToolSpec` enum（`type=function|local_shell|web_search|custom`）：`refence/codex/codex-rs/core/src/client_common.rs:182`～`:203`
- `ResponsesApiTool`（function tool 的 `name/description/strict/parameters`）：`refence/codex/codex-rs/core/src/client_common.rs:229`～`:238`

---

## 5. Streaming 响应（SSE）：`response.*` 事件类型与解析约束

Codex 的 Responses API stream 解析器从 SSE `data` JSON 中读取 `type` 字段，作为事件类型分发。

### 5.1 SSE data JSON 的字段形态（解析器视角）

**代码定位**

- SSE event 结构（kind/response/item/delta/...）：`refence/codex/codex-rs/codex-api/src/sse/responses.rs:128`～`:137`
- 事件分发主循环：`refence/codex/codex-rs/codex-api/src/sse/responses.rs:199`～`:305`

**实现侧注意点（对 PromptXY 很关键）**

- Codex 的 SSE 解析器按 `data` JSON 的 `type` 分发，不依赖 SSE 的 `event:` 行；因此做转换时应以 `data.type` 为准（证据：`refence/codex/codex-rs/codex-api/src/sse/responses.rs:191`～`:205`）。

### 5.2 常见事件（节选）

- `response.created`
- `response.output_text.delta`（文本增量）
- `response.output_item.added` / `response.output_item.done`（**message/tool call 等都在 item 里**）
- `response.reasoning_text.delta` / `response.reasoning_summary_text.delta`（推理增量）
- `response.failed`
- `response.completed`（**强约束：stream 结束前必须出现，否则认为错误**）

**强约束（非常重要）**

- 若 stream 关闭但未见 `response.completed`，解析器会报错：`"stream closed before response.completed"`

**代码定位**

- stream 结束时检查 completed：`refence/codex/codex-rs/codex-api/src/sse/responses.rs:162`～`:178`

---

## 6. tool call 在 SSE 中的表现（如何从 codex SSE 还原“工具调用”）

Codex 的测试 helper 构造了典型 tool call 的 SSE payload（可作为“最小可用形态”的参考样本）：

- tool call 事件为 `type:"response.output_item.done"`
- `item.type:"function_call"`，包含：
  - `call_id`
  - `name`
  - `arguments`（JSON string）

或

- `item.type:"custom_tool_call"`，包含：
  - `call_id`
  - `name`
  - `input`（string）

**代码定位**

- function_call SSE item 构造：`refence/codex/codex-rs/core/tests/common/responses.rs:416`～`:426`
- custom_tool_call SSE item 构造：`refence/codex/codex-rs/core/tests/common/responses.rs:428`～`:438`

> 对 PromptXY 的含义：当你把 codex SSE 转成 Claude SSE（让 Claude Code 能消费）时，需要把这些 `function_call/custom_tool_call` item 转换成 Claude 侧 tool_use 的 `content_block_* + input_json_delta` 序列（见 Claude spec 文档）。

---

## 7. `call_id` 对称性与 invariants（把“少字段 error”落到协议级）

Codex 的测试对 `/v1/responses` 请求体 `input[]` 有严格 invariants（这类 invariants 对 PromptXY 很重要，因为你们也要求“少字段必须 error”）：

- 不允许 `function_call_output/custom_tool_call_output` 缺失/空 `call_id`
- 每个 output 必须能匹配同一 input 中此前出现过的 call（function_call/local_shell_call/custom_tool_call）
- 并且反过来：每个 call 在 input 中都必须有对应 output（对称性）

**代码定位**

- `validate_request_body_invariants`：`refence/codex/codex-rs/core/tests/common/responses.rs:802`～`:891`

> 结论：如果 Claude messages 中出现 tool_use/tool_result，而你转换到 codex input 时没有形成对称的 call/output 配对（或 call_id 缺失），那么在 Codex 的语义里属于“缺关键字段/缺配对”，应直接视为错误。

---

## 8. PromptXY 现状对齐定位（用于后续实现对齐，不是协议本身）

### 8.1 PromptXY 当前 Claude -> Codex 请求体转换入口

- `transformToCodex`（构造 model/instructions/input/tools 等）：`backend/src/promptxy/transformers/llms-compat.ts:1069`～`:1211`

### 8.2 PromptXY 的 instructions 模板（上游严格校验背景）

- instructions 模板提取逻辑：`backend/src/promptxy/transformers/codex-instructions.ts:1`～`:68`

### 8.3 PromptXY 当前 codex SSE → anthropic SSE

- codex SSE 转换（目前主要覆盖 text delta + stop）：`backend/src/promptxy/transformers/sse.ts:302`～`:520`

> 差距提示：codex SSE 里的 `response.output_item.done`（function_call/custom_tool_call）目前没有映射为 Claude Code 侧必需的 tool_use SSE 序列；这会直接导致“工具不可用”。该点应作为后续对齐实现的首要任务。

---

## 9. 变更记录

- 2026-01-06：v1.0 初稿，基于 `refence/codex/codex-rs/*` 的实现与测试 helper 沉淀 Responses API 关键字段与事件。
