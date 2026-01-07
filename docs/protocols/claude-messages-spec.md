# Claude Messages API（Claude Code 视角）协议规格（v1）

> 本文档是**规格（spec）**，目标是把 Claude Code 实际使用的 Anthropic Messages API（`POST /v1/messages`）关键字段与 SSE 事件形态沉淀为**可追溯、可维护**的参考基线，便于 PromptXY 做 `/claude -> /codex` 的字段对齐、转换审计与回归测试。

**版本**：v1.0  
**更新时间**：2026-01-06  
**参考实现（观测 Claude Code 行为）**：`refence/claude-code-router`  
**关联实现（PromptXY 当前代码，仅用于对齐参考）**：`backend/src/promptxy/*`

---

## 0. 范围与非目标

### 覆盖范围（本 spec 关注点）

- `/v1/messages` 请求体中与 PromptXY 转换强相关的字段：
  - `system`（string 或 blocks）
  - `messages[].content`（text/tool_use/tool_result）
  - `tools[]`（name/description/input_schema）
  - `metadata.user_id`（可解析 session）
  - `thinking`（Claude Code 场景可能出现）
  - `stream=true` 的 SSE 事件序列（tool call 闭环必须）

### 非目标（暂不覆盖）

- 全量 Anthropic 官方字段枚举（以 Claude Code 实际使用子集为准）
- 所有响应 JSON（non-stream）字段的完整 schema（后续可补）

---

## 1. HTTP 端点

- **Method**：`POST`
- **Path**：`/v1/messages`
- **Response**：
  - `stream=false`：JSON（非本文重点）
  - `stream=true`：`text/event-stream`（SSE，本文重点）

> Claude Code Router 的服务端也暴露了 `POST /v1/messages/count_tokens` 作为辅助端点，但它不是 Anthropic 标准端点，只是该项目的附加能力（见 `refence/claude-code-router/src/server.ts:13`）。PromptXY 对齐时不必实现它，除非需要兼容某些工具链行为。

---

## 2. 请求体（Request Body）——字段语义（Claude Code 常见形态）

> **重要原则**：Claude Code 的真实请求并不总是“最简 JSON”，尤其 `system`/`messages.content` 经常是结构化 blocks。转换时应优先保留结构与语义，而不是只保留文本。

### 2.1 顶层字段（常见/高频）

- `model: string`
  - Claude Code Router 的路由逻辑会对 `model` 字符串做包含判断（例如 `includes("haiku")`），说明客户端/生态里 `model` 很可能是“可读字符串 + 语义片段”而非纯 ID（见 `refence/claude-code-router/src/utils/router.ts:157`～`:165`）。
- `messages: Array<MessageParam>`
  - `messages[]` 是对话历史与当前用户输入的主载体。
- `system?: string | Array<SystemBlock>`
  - Claude Code 场景下，`system` 很常见为数组，并且可能包含 `<env>` 分隔符（见下文）。
- `tools?: Array<Tool>`
  - 用于 function/tool calling。
- `metadata?: object`
  - Claude Code Router 会从 `metadata.user_id` 解析 `sessionId`（见 `refence/claude-code-router/src/utils/router.ts:184`～`:190`）。
- `thinking?: any`
  - Claude Code Router 在路由选择中直接判断 `req.body.thinking`（truthy 即进入 think 模式）（见 `refence/claude-code-router/src/utils/router.ts:174`～`:179`）。
- `stream?: boolean`
  - 你已确认 Claude Code 会 `stream=true`，并且 tool call 必须可用。

---

## 3. `system` 字段：string 与 blocks 的双形态（含 `<env>`）

### 3.1 system 的 token 计算与文本拼接逻辑（反映真实形态）

Claude Code Router 的 token 计算函数体现了 system 的真实形态：

- `system` 为 string：直接 encode
- `system` 为 array：遍历 `item.type === "text"`：
  - `item.text` 若为 string：直接 encode
  - `item.text` 若为 string[]：逐段 encode

**代码定位**

- `system` 形态与拼接：`refence/claude-code-router/src/utils/router.ts:43`～`:56`

### 3.2 `<env>` 分隔符与 system 重写（Claude Code 的“环境上下文”惯例）

Claude Code Router 在路由过程中做了一个非常关键的行为：当 `system[1].text` 中包含 `<env>` 时，允许替换 `<env>` 之前的提示词内容并保留 `<env>` 之后的内容：

**代码定位**

- `<env>` 检测与重写：`refence/claude-code-router/src/utils/router.ts:192`～`:200`

**对 PromptXY 的含义**

- `<env>` 以及其后的内容应被视为“高价值上下文”，在跨协议转换时：
  - **优先原样保留**（至少以文本形式进入 `instructions = template + system` 的 system 部分）
  - 并在审计报告中能定位“system 在何处被拼接/改写”

### 3.3 `cache_control`（常见但非协议核心字段）

在 Claude Code 场景中，`system` blocks 或 `messages[].content` blocks 里可能出现 `cache_control`（例如 `{"type":"ephemeral"}`）用于缓存/生命周期控制。

**代码定位（PromptXY 已提供剔除能力）**

- 递归剔除 `cache_control` 字段：`backend/src/promptxy/transformers/llms-compat.ts:1028`（`cleanCacheControl`）

**对 PromptXY 的含义**

- `cache_control` 不应被当作“少字段”（缺失不影响核心语义），但它属于“多字段”，应进入审计的 `extra/unmapped` 视角。
- 当目标上游协议不接受该字段时，应通过可配置策略 drop，而不是在转换过程中静默丢失。

---

## 4. `messages[].content`：文本 + 工具交互（tool_use/tool_result）

### 4.1 message.content 的双形态：string 或 blocks[]

Claude Code Router 的 token 计算中明确支持：

- `message.content` 为 string：直接 encode
- `message.content` 为数组：遍历 contentPart：
  - `type === "text"`：读 `contentPart.text`
  - `type === "tool_use"`：对 `contentPart.input` 做 `JSON.stringify` 后 encode
  - `type === "tool_result"`：读 `contentPart.content`（string 或 object，必要时 stringify）后 encode

**代码定位**

- message.content 的三类 block：`refence/claude-code-router/src/utils/router.ts:22`～`:41`

### 4.2 tool_use/tool_result 的最小字段集合（对“少字段 error”很关键）

从 Claude Code Router 的 tool loop 实现可以确认：

- `tool_use` 至少需要：`{ id, name, input }`
- `tool_result` 至少需要：`{ tool_use_id, type:"tool_result", content }`

**代码定位**

- tool_use 写回：`refence/claude-code-router/src/index.ts:238`～`:243`
- tool_result 写回：`refence/claude-code-router/src/index.ts:248`～`:252`

> 结论：当 PromptXY 把上游协议（Codex Responses）转换回 Claude SSE 或 Claude messages 时，若缺失上述关键字段，应视为“少字段”，必须 error（符合你们当前规则）。

---

## 5. `tools[]`：函数工具定义（name/description/input_schema）

Claude Code Router 在 token 计算中使用了：

- `tool.name`
- `tool.description`
- `tool.input_schema`

**代码定位**

- tools token 计算：`refence/claude-code-router/src/utils/router.ts:57`～`:65`

---

## 6. Streaming 响应（SSE）：Claude Code 侧 tool call 的真实消费方式（硬契约）

### 6.1 SSE 基本帧格式（event/data）

Claude Code Router 的 SSE 解析器体现了“消费侧假设”：

- `event:` 行设置事件名
- `data:` 行必须是 JSON（或特殊 `[DONE]`）
- 空行表示一个事件结束

**代码定位**

- SSE 解析：`refence/claude-code-router/src/utils/SSEParser.transform.ts:39`～`:72`
- SSE 序列化：`refence/claude-code-router/src/utils/SSESerializer.transform.ts:1`～`:29`

### 6.2 工具调用在 stream=true 下的事件序列（Claude Code Router 强依赖）

Claude Code Router 在流式处理里依赖下面序列来识别并执行工具：

1. `event === "content_block_start"`，且 `data.content_block.name` 存在  
   - 记录 `index/name/id`，判定进入 tool call 收集态
2. `data.delta.type === "input_json_delta"`（同 index）  
   - 拼接 `partial_json` 作为 tool args（最终用 JSON5.parse）
3. `event === "content_block_stop"`（同 index）  
   - 解析 accumulated JSON，生成 `tool_use` 与 `tool_result`，等待下一步触发
4. `event === "message_delta"` 且 `toolMessages.length > 0`  
   - 把 tool_use/tool_result 写回 `req.body.messages` 并发起下一轮 `/v1/messages`

**代码定位（关键行为）**

- tool call start（取 name/id/index）：`refence/claude-code-router/src/index.ts:216`～`:226`
- args 拼接（input_json_delta.partial_json）：`refence/claude-code-router/src/index.ts:228`～`:232`
- stop + JSON5.parse：`refence/claude-code-router/src/index.ts:234`～`:262`
- message_delta 触发 tool loop：`refence/claude-code-router/src/index.ts:264`～`:312`

**对 PromptXY 的硬要求**

- 当 PromptXY 把 Codex Responses SSE 转回 Anthropic SSE 时，必须能产出上述事件序列等价物（至少在 tool call 场景下）。
- 否则：Claude Code 无法稳定识别 tool_use，工具链闭环不可用。

---

## 7. 可观测字段：metadata.user_id → sessionId

Claude Code Router 会从 `metadata.user_id` 中以 `"_session_"` 分隔提取 `sessionId`：

**代码定位**

- sessionId 解析：`refence/claude-code-router/src/utils/router.ts:184`～`:190`

**建议（供 PromptXY 未来对齐）**

- 在 request record 中单独落一个 `sessionId` 字段（解析得到就写），用于追踪多轮 tool loop 与 SSE 问题复现。

---

## 8. PromptXY 现状对齐定位（用于后续实现对齐，不是协议本身）

### 8.1 PromptXY 当前 Claude body 处理

- 仅对 `system` 做 rules mutate，支持 string 与 text blocks：`backend/src/promptxy/adapters/claude.ts:22`～`:70`

### 8.2 PromptXY 当前 SSE 转换框架入口

- SSE parse/serialize：`backend/src/promptxy/transformers/sse.ts:29`～`:105`
- codex SSE → anthropic SSE（当前仅覆盖 text delta 与 stop）：`backend/src/promptxy/transformers/sse.ts:359`～`:449`

> 差距提示：PromptXY 目前尚未在 codex→anthropic SSE 中生成 Claude Code 所需的 tool_use 事件序列（见第 6 章）。这会是你们后续 `/claude -> /codex` 真正“工具可用”的关键补齐点。

---

## 9. 变更记录

- 2026-01-06：v1.0 初稿，基于 `refence/claude-code-router` 进行“协议消费者视角”沉淀。
