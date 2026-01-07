# PromptXY 转换器重构技术设计（v1：/claude → /codex Responses）

**文档目的**：将本次“转换器重构”的设计决策、边界、字段/事件对齐规则、审计与回归工作流沉淀为可追溯的技术文档，为后续实现与新供应商扩展提供统一参考。  
**文档类型**：技术设计（面向实现）  
**版本**：v1.0  
**更新时间**：2026-01-06  

相关规格（已落盘）：
- Claude（Anthropic Messages /v1/messages，Claude Code 视角）：`docs/protocols/claude-messages-spec.md`
- Codex（OpenAI Responses /v1/responses，Codex CLI 视角）：`docs/protocols/codex-responses-spec.md`

---

## 1. 背景与问题（为什么要重构）

当前 PromptXY 已支持通过转换器把 `/claude` 的请求导向不同供应商，但存在以下系统性问题：

1) **不可审计**：无法稳定观测转换前后字段差异（缺字段/多字段/类型变化/语义降级），导致上游拒绝或工具不可用时难以定位根因。  
2) **对接无标准**：新增供应商（或新增协议对）缺乏“复用的流程 + 样本驱动验证 + 覆盖增量策略”，调试周期长。  
3) **隔离不足**：转换逻辑缺少按协议/供应商/字段域的隔离层，导致 debug 成本高。

PromptXY 当前与转换相关的主要入口（用于对齐/重构定位）：

- 变换链与 Claude→Codex 的请求转换：`backend/src/promptxy/transformers/llms-compat.ts:1069`（`transformToCodex`）  
- Codex instructions 模板提取：`backend/src/promptxy/transformers/codex-instructions.ts:1`  
- SSE 响应转换（codex/openai/gemini → anthropic SSE）：`backend/src/promptxy/transformers/sse.ts:302`  
- 预览转换 API（带 trace）：`backend/src/promptxy/api-handlers.ts:995`（`handleTransformPreview`）  
- request record 已有可扩展字段：`backend/src/promptxy/types.ts:183`（`RequestRecord` 的 transformerChain/transformTrace 等）

---

## 2. 本次重构的目标与硬约束（已确认）

### 2.1 协议/供应商粒度

- 供应商粒度按**协议类型**：仅需要支持 `claude`、`codex(/responses)`、`gemini`（v1 优先 `claude → codex`）。
- `openai(/chat/completions)` 仅作为“通用 chat 协议”概念存在，本次不作为 v1 目标。

### 2.2 字段缺失策略（强约束）

- **多字段 OK**（允许 extra / additional）  
- **少字段必须 error**（缺 required / 缺关键语义字段必须阻断或强失败）

### 2.3 可观测与落库

- 转换后的请求 **允许落库**，且 **不需要脱敏**（便于逐字段排查与回放）。

### 2.4 优先链路与必需能力

- v1 优先：`/claude → /codex (/v1/responses)`  
- `/claude` 客户端会 `stream=true`
- 工具调用交互采用 Anthropic 官方 `tool_use/tool_result` 语义（Claude Code 形态）
- v1 必须保证 **tool call 可用**（不仅字段存在，还要端到端闭环可运行）

### 2.5 instructions 规则

- **目标规则**：`codex.instructions = template + "\n\n" + normalize(system)`（template 在前；system 为空则仅 template）。
- **现状差异**：当前 `transformToCodex` 仅使用 template 生成 instructions，尚未拼接 Claude `system`（证据：`backend/src/promptxy/transformers/llms-compat.ts:1090`）。

### 2.6 模型映射（S2 策略）

- **Claude tier 解析**：从 `model` 字符串中按包含关系识别 `opus/haiku/sonnet`，识别不到默认 `sonnet`（证据：`backend/src/promptxy/model-mapping.ts:3`）。
- **路由映射（claudeModelMap）**：route 必须配置 `claudeModelMap.sonnet`，`haiku/opus` 缺省时回退 `sonnet`（证据：`backend/src/promptxy/model-mapping.ts:18`）。
- **缺失策略（符合“少字段必须 error”）**：route 未配置 `claudeModelMap` 或缺失 `sonnet` 时直接返回 400，避免 silent fallback（证据：`backend/src/promptxy/model-mapping.ts:22` 与 `backend/src/promptxy/gateway.ts:678`）。
- **OpenAI/Codex modelSpec → reasoning.effort**：如果 modelSpec 末尾形如 `<base>-<effort>`，网关会解析并写入 `reasoning.effort`（证据：`backend/src/promptxy/model-mapping.ts:45` 与 `backend/src/promptxy/gateway.ts:728`）。

### 2.7 证据与待验证项（实现前必须补齐）

> 本文档的目标是“面向实现可落地”。因此每个强断言都应该能在 `refence/*` 或 PromptXY 现有实现中找到印证；找不到的必须标为“待验证”，避免把猜测写成规格。

- **已证实（可直接作为 v1 硬契约）**
  - Claude Code 对 tool call 的 SSE 消费序列依赖（`content_block_* + input_json_delta + message_delta`）（证据：`refence/claude-code-router/src/index.ts:216`）。
  - Codex `/v1/responses` 的 `call_id` 对称性与 invariants（证据：`refence/codex/codex-rs/core/tests/common/responses.rs:802`）。
  - Codex Responses SSE 以 data JSON 的 `type` 字段分发事件，且 `response.completed` 缺失视为错误（证据：`refence/codex/codex-rs/codex-api/src/sse/responses.rs:191` 与 `:162`）。
- **待验证（现有描述不足以作为硬约束）**
  - “上游对 `instructions` 的校验严格到需要固定模板”的具体失败样本（当前仅有实现侧注释与规避策略，缺少可回放样本/可复现实验记录；证据：`backend/src/promptxy/transformers/codex-instructions.ts:1`）。

---

## 3. 核心设计：把“转换器”升级为可审计流水线（Pipeline）

本次重构不追求“一次写完所有协议对”，而是先把 **可审计、可回放、可增量覆盖** 的框架立住。

### 3.1 目标架构（概念图）

```mermaid
flowchart LR
  A[/Inbound /claude HTTP request/] --> B[Parse (Claude)]
  B --> C[Normalize (v1: minimal)]
  C --> D[Plan (policy/capabilities)]
  D --> E[Render -> Codex /responses request]
  E --> F[Validate (missing=error, extra=ok)]
  F --> G[Audit (diff/coverage/defaults)]
  G --> H[/Send upstream/]
  H --> I[/Upstream SSE/JSON response/]
  I --> J[Response Transform (Codex SSE -> Claude SSE)]
  J --> K[/Return to Claude Code client/]
```

### 3.2 每阶段必须产出的“证据”（用于可追溯）

- **Parse**：原始请求（path/headers/body）、解析结果、解析失败原因（如 JSON parse error）
- **Normalize/IR（v1 最小形态）**：统一语义表示（后续生成/推断/对齐的“锚点”）
- **Plan**：注入/降级决策（“为什么这样改”）
- **Render**：上游请求（即将发送给 /responses 的 body/headers/path）
- **Validate**：缺失字段列表（error）、额外字段列表（report）
- **Audit**：diff、覆盖率、默认值来源、未映射字段

> 现状对齐：PromptXY 已有 `TransformTrace`（step 级）与 preview API。重构后应把 “字段级证据”补到 trace/audit 中（而不是仅字符串 warning）。

### 3.3 Trace/Audit 的最小数据结构（v1，面向实现）

> 说明：当前 `TransformTrace` 仅覆盖 step 级成功/耗时/错误（见 `backend/src/promptxy/transformers/types.ts:96`）。为了实现“少字段 error + 可回放”，v1 必须新增 **字段级** 的审计结构。下面定义的是**目标结构**（实现时可落到 `transformTrace` 或新增字段，但字段名/语义必须一致）。

**路径约定**

- 所有字段定位使用 **JSON Pointer**（例如：`/messages/0/content/2/type`），便于 diff、校验与报错一致化。
- 避免使用“点号路径”（`a.b[0]`），因为会在 keys 含 `.`、`~` 等字符时产生歧义。

**建议结构（最小可用）**

```ts
type JsonPointer = string;

type EvidenceRef = {
  // 证据来自哪里（实现/协议/样本），允许空但建议填
  source: 'promptxy' | 'refence' | 'sample';
  // 可选：便于追溯的文件定位（不强制写死行号）
  ref?: string;
};

type FieldDiff = {
  op: 'add' | 'remove' | 'replace';
  path: JsonPointer;
  // 允许截断（大对象/大文本）
  valuePreview?: unknown;
};

type FieldAudit = {
  // 解析期：源请求里实际出现过的字段路径（用于 unmapped/coverage）
  sourcePaths: JsonPointer[];
  // 渲染期：目标请求里最终发送的字段路径
  targetPaths: JsonPointer[];

  // 多字段 OK：但必须可观测
  extraTargetPaths: JsonPointer[];

  // 少字段必须 error：缺失即阻断
  missingRequiredTargetPaths: JsonPointer[];

  // “源字段未映射”的清单（用于定位语义丢失）
  unmappedSourcePaths: JsonPointer[];

  // 字段级 diff（建议 JSON Patch 语义，但不强制完全遵循 RFC6902）
  diffs: FieldDiff[];

  // 默认值与来源（必须能解释“为什么出现这个字段”）
  defaulted: Array<{
    path: JsonPointer;
    source: 'template' | 'route' | 'supplier' | 'inferred' | 'fallback';
    reason: string;
  }>;

  evidence?: EvidenceRef[];
};
```

**落库要求**

- 生产环境允许“转换后请求”完整落库（已确认约束 2.3），因此 `FieldAudit` 不需要脱敏；但可对超长内容做截断预览以控制体积。

---

## 4. Phase C（后续）：统一中间表示（IR）与 Workbench（v1 不实现完整 IR 类型系统）

> 本节用于提前固定“后续演进方向”，避免把 v1 交付拖成“大而全”。v1 仅做最小规范化与可审计 pipeline，不做完整 IR 类型系统与样本驱动 Workbench。

### 4.1 为什么需要 IR

没有 IR 的转换会退化为：

- 字段 rename + if-else 拼接
- 供应商差异不断侵入核心逻辑
- 无法系统化地回答“这个字段从哪来、为什么丢、如何回放验证”

IR 的作用是把转换从 `N×M` 的协议对耦合，变成：

- `claude -> IR`（入站协议解析/规范化）
- `IR -> codex`（上游协议渲染）
- `codex -> IR`（响应解析，可选）
- `IR -> claude`（响应渲染，尤其是 SSE tool_use）

### 4.2 IR 建议字段域（Phase C 草案；v1 不做类型系统）

> 以下为设计建议字段域，最终实现可按类型系统固化。核心是：**tool_use/tool_result 必须进入 IR 主干字段**，不能只塞 extensions。

- `modelSpec`：`{ tier?: "sonnet"|"haiku"|"opus", rawModel?: string, effort?: string }`
- `system`：结构化 blocks（可由 string 升级为单块）
- `messages[]`：统一 blocks（至少支持 `text/tool_use/tool_result`）
- `tools[]`：`{ name, description?, inputSchema }`
- `toolChoice`：`auto|any|{name}`
- `generation`：`maxOutputTokens/temperature/topP/stop/...`（按需）
- `reasoning`：与 `thinking` 相关的语义字段（可先保留为 extensions，但必须审计）
- `stream`：`{ enabled: boolean }`
- `metadata`：`user_id/sessionId/...`
- `extensions`：协议独有字段（保留可观测，避免污染主干）

---

## 5. 校验策略：多字段 OK，少字段 error（两层校验）

为了实现“可对齐、可生成”，校验建议拆两层：

### 5.1 协议级校验（线上必须）

目标：保证发往 `/v1/responses` 的请求满足 Codex 侧期望，缺失关键字段直接阻断。

Codex 请求体结构（实现定义）：

- `ResponsesApiRequest` 字段清单见：`refence/codex/codex-rs/codex-api/src/common.rs:121`
- builder 默认 `tool_choice:"auto"`, `stream:true`：`refence/codex/codex-rs/codex-api/src/requests/responses.rs:113`

#### 5.1.1 字段级 required（以 Codex CLI 实现为“可印证基线”）

> 注意：这里的 required 是指 **PromptXY v1 发送到 `/v1/responses` 时必须具备** 的字段集合（缺失即 error）。我们选择以 `refence/codex/codex-rs` 的实现作为最强证据来源，而不是把某个 JSON schema 当作协议真理。

- 必须存在且类型正确（缺失即 error）：
  - `/model: string`（builder 缺失会报错；证据：`refence/codex/codex-rs/codex-api/src/requests/responses.rs:97`）
  - `/instructions: string`（同上；证据同上）
  - `/input: array`（同上；证据同上）
  - `/tools: array`（Codex CLI 会发送 tools 列表；PromptXY 允许为空数组，但字段必须存在）
  - `/tool_choice: string`（Codex CLI 固定 `"auto"`；证据：`refence/codex/codex-rs/codex-api/src/requests/responses.rs:113`）
  - `/parallel_tool_calls: boolean`
  - `/store: boolean`
  - `/stream: boolean`（Codex CLI 固定 `true`；证据同上）
  - `/include: array<string>`

- 可选（缺失不应作为“少字段”错误，但必须进入审计，避免 silent 变化）：
  - `/reasoning?: object`（为 Option；证据：`refence/codex/codex-rs/codex-api/src/common.rs:129`）
  - `/prompt_cache_key?: string`（为 Option；证据：`refence/codex/codex-rs/codex-api/src/common.rs:133`）
  - `/text?: object`（为 Option；证据：`refence/codex/codex-rs/codex-api/src/common.rs:135`）

#### 5.1.2 tool call 级 invariants（缺失即 error）

> 这部分不是“字段是否存在”的问题，而是“字段之间必须成对/成闭环”的问题；属于 v1 必须强失败的范畴（否则上游会拒绝或工具链无法运行）。

- `call_id` 不允许缺失/空字符串
- `function_call_output/custom_tool_call_output` 必须能匹配同一 input 中此前出现的 call
- 并且必须对称：每个 call 都要有 output

**证据**：`validate_request_body_invariants`（`refence/codex/codex-rs/core/tests/common/responses.rs:802`）

#### 5.1.3 extra 字段策略（多字段 OK，但必须可观测）

- 额外字段允许存在（“多字段 OK”），但必须进入 `FieldAudit.extraTargetPaths`，并在必要时允许配置“drop list”（避免某些上游严格拒绝）。

### 5.2 样本对齐校验（Workbench/开发必备）

目标：用 “成功原版 /codex 请求样本 B” 约束转换结果 T，保证快速收敛。

- `missingComparedToSample = (paths(B) - paths(T))` → error（少字段）
- `extraComparedToSample = (paths(T) - paths(B))` → ok（多字段），但产出 report

> 这是你最初诉求 “只给两份成功请求就能推导转换器骨架” 的基础：对齐校验本身就是生成/调试的闭环驱动力。

---

## 6. `/claude -> /codex` 请求映射要点（v1）

### 6.1 instructions：template + system

PromptXY 现状中，Codex 上游对 `instructions` 有严格校验，因此已引入模板机制：

- 模板提取与缓存：`backend/src/promptxy/transformers/codex-instructions.ts:39`
- Claude→Codex 构造 instructions：`backend/src/promptxy/transformers/llms-compat.ts:1090`～`:1099`

重构后应将其提升为：
- `instructionsTemplate` 作为 policy（route/supplier）层可配置项
- 审计里必须记录：
  - `defaultedTargetFields: /instructions (source=template)`
  - `mappedFields: /system -> /instructions (append)`

#### 6.1.1 `system` → string 的规范化规则（必须写死，避免实现分叉）

> Codex `instructions` 是 string，但 Claude `system` 允许 string 或 blocks。规范化的目标不是“丢掉结构”，而是 **在 string 约束下尽量保留可读顺序与 `<env>` 等关键片段**（并能审计哪些信息丢失/被改写）。

- 若 `system` 为 string：直接使用
- 若 `system` 为 array：
  - 仅取 `type === "text"` 的 block
  - `block.text` 为 string：直接拼接
  - `block.text` 为 string[]：按顺序 join 后拼接
  - 其他形态：忽略，但必须记录到 `FieldAudit.unmappedSourcePaths`

**证据（system 的真实形态）**：`refence/claude-code-router/src/utils/router.ts:43`～`:56`

### 6.2 messages：Claude messages[] → Codex input[]

PromptXY 现状对 text blocks 做了映射：

- `messages[].content` 的 text block → `input[]` 的 `{type:"message", content:[{type:"input_text"}]}`  
  见 `backend/src/promptxy/transformers/llms-compat.ts:1111`～`:1139`

重构要求（v1 tool call 可用）：

- 必须将 Claude 的 `tool_use/tool_result` 也映射到 codex `input[]` 的等价结构（至少生成 `function_call_output` 或 `custom_tool_call_output`，并满足 call_id 对称性）。

Codex 对 call_id 对称性有强约束（测试级 invariant）：

- `validate_request_body_invariants`：`refence/codex/codex-rs/core/tests/common/responses.rs:802`

#### 6.2.1 最小映射表（v1）

> 目标：让 Claude Code 的“工具闭环”在 Codex 侧仍然是一个可被验证的闭环（call/output 对称）。映射时不要“凭感觉”发明字段，必须与 `refence/codex` 的类型与测试约束对齐。

| Claude 来源 | 条件 | Codex `input[]` 目标 | 备注/证据 |
|---|---|---|---|
| `messages[].content` text block | `block.type==="text"` | `{"type":"message","role":<role>,"content":[{"type":"input_text","text":<text>}]}` | 当前 PromptXY 已实现（证据：`backend/src/promptxy/transformers/llms-compat.ts:1111`） |
| `tool_use` block | `block.type==="tool_use"` | `{"type":"function_call","call_id":<id>,"name":<name>,"arguments":<json-string>}` | `arguments` 必须是 JSON string（证据：`refence/codex/codex-rs/protocol/src/models.rs:95`） |
| `tool_result` block | `block.type==="tool_result"` | `{"type":"function_call_output","call_id":<tool_use_id>,"output":<string-or-structured>}` | output 形态需兼容（证据：`docs/protocols/codex-responses-spec.md` 第 3.2 节） |

#### 6.2.2 call_id 配对规则（少字段必须 error 的落地）

- 每个 `tool_use.id` 必须非空；否则 error
- 每个 `tool_result.tool_use_id` 必须非空；否则 error
- 每个 `tool_use.id` 必须能在后续消息中找到 **且仅找到一个** `tool_result` 与之配对；否则 error（缺失/重复都会破坏对称性）
- 出现“孤儿 tool_result”（找不到对应 tool_use）同样应视为 error

**证据（Claude 最小字段集合）**：`refence/claude-code-router/src/index.ts:238`～`:252`  
**证据（Codex 对称性 invariants）**：`refence/codex/codex-rs/core/tests/common/responses.rs:802`

#### 6.2.3 tool_result.output 的序列化策略（v1 先保守，避免上游拒绝）

> Claude `tool_result.content` 允许 string 或 object（证据：`refence/claude-code-router/src/utils/router.ts:22`～`:41`）。Codex `function_call_output.output` 在不同实现里可能接受多形态。为了避免“把 object 直接塞到 output 导致上游拒绝”，v1 建议：

- 若 `tool_result.content` 为 string：直接作为 output
- 否则：`JSON.stringify(content)` 作为 output（并在审计里记录 `outputWasStringified=true`）

### 6.3 tools：Claude tools[] → Codex tools[]

Codex tool 定义（Responses API 的 function tool）在实现中包含：

- `type:"function"`, `name`, `description`, `strict`, `parameters`  
  见 `refence/codex/codex-rs/core/src/client_common.rs:182`～`:238`

PromptXY 当前已做了 “Anthropic tools → OpenAI function schema（严格剪裁）”：

- schema normalize/裁剪 required/追加 additionalProperties=false：`backend/src/promptxy/transformers/llms-compat.ts:1141`～`:1206`

重构建议：
- 将 schema 的“强剪裁策略”写成可配置 policy（默认保持现状，以通过上游严格校验）
- 在 audit 里输出：
  - `toolSchemaPruning`（哪些字段被删、为什么删：format/$schema 等）
  - `schemaStrictMode`（strict/required 处理策略）

---

## 7. `/codex -> /claude` 响应映射要点（stream=true 且 tool call 可用）

这是 v1 成败关键：Claude Code 侧对 tool call 的消费是“事件序列驱动”的，而不是“JSON 响应后处理”。

### 7.1 Codex Responses SSE 的真实事件类型

Codex 的 SSE data JSON 内有 `type` 字段（如 `response.output_text.delta`），解析器按 `kind` 分发：

- 解析与分发主循环：`refence/codex/codex-rs/codex-api/src/sse/responses.rs:139`～`:305`

其中 tool call 常见于：
- `response.output_item.done`，`item.type="function_call"`（包含 `call_id/name/arguments`）  
  构造样例：`refence/codex/codex-rs/core/tests/common/responses.rs:416`

并且 stream 结束必须有 `response.completed`：
- 缺失 completed 会报错：`refence/codex/codex-rs/codex-api/src/sse/responses.rs:162`～`:178`

### 7.2 Claude Code 对 tool call SSE 的硬依赖序列

Claude Code Router 的实现清晰表明 consumer 侧依赖：

- `content_block_start`（带 `content_block.name/id`）
- `content_block_delta` 且 `delta.type="input_json_delta"`（拼 partial_json）
- `content_block_stop`
- `message_delta`（用于触发下一轮 tool loop）

关键消费逻辑：`refence/claude-code-router/src/index.ts:216`～`:312`

### 7.3 PromptXY SSE 现状与缺口（对齐定位）

PromptXY 当前已能把 Codex SSE 的文本增量转成 Claude SSE 的 text_delta：

- codex SSE → anthropic SSE：`backend/src/promptxy/transformers/sse.ts:359`～`:449`

但现状缺口：
- 没有把 `response.output_item.done` 的 `function_call/custom_tool_call` 转成 Claude Code 侧可消费的 tool_use SSE 事件序列。
- 现状把 `response.output_item.done` 视为“终止信号”并直接发 `message_stop`，会在 tool call 场景下提前结束流（证据：`backend/src/promptxy/transformers/sse.ts:418`）。

> 结论：本次转换器重构必须把 “SSE tool call 映射” 提升为一等公民（状态机/组装器），否则无法满足 v1 的“tool call 可用”约束。

### 7.4 Codex SSE → Claude SSE 的最小状态机（v1）

> 本节定义“可实现”的 SSE 映射算法，避免后续实现者各写各的导致 Claude Code 无法消费。重点：**区分 item.type**，不要把所有 `output_item.done` 都当作 stop。

#### 7.4.1 事件输入（Codex）

- 事件类型以 data JSON 的 `type` 字段为准（不要依赖 SSE 的 `event:` 行是否存在）  
  **证据**：Codex 解析器读取 `SseEvent.kind`（`#[serde(rename="type")]`），并据此 match（`refence/codex/codex-rs/codex-api/src/sse/responses.rs:191`～`:205`）。

#### 7.4.2 事件输出（Claude Code 侧可消费）

Claude Code tool loop 强依赖的序列（证据：`refence/claude-code-router/src/index.ts:216`）：

1) `content_block_start`（`data.content_block.name`、`data.content_block.id` 必须存在）  
2) `content_block_delta` with `delta.type="input_json_delta"`（拼 arguments）  
3) `content_block_stop`  
4) `message_delta`（触发 tool loop）

#### 7.4.3 推荐映射规则（最小可用）

**初始化**

- 首次看到 `response.created` 或 `response.output_text.delta` 或任何 `response.output_item.*` 时：
  - 发一次 `message_start`（id 可用 response.id，缺失则空字符串）
  - 若是文本输出：再发一次 `content_block_start(index=0,type=text)`

**文本增量**

- `response.output_text.delta` → `content_block_delta(index=0, delta.type=text_delta)`

**工具调用**

- 当收到 `response.output_item.done` 且 `item.type==="function_call"`：
  - 分配新的 `toolIndex`（从 1 开始递增；0 预留给文本）
  - 发 `content_block_start(index=toolIndex, content_block.type="tool_use", content_block.name=item.name, content_block.id=item.call_id)`
  - 发 `content_block_delta(index=toolIndex, delta.type="input_json_delta", delta.partial_json=item.arguments)`
  - 发 `content_block_stop(index=toolIndex)`
  - 发 `message_delta`（用于触发 tool loop；`stop_reason` 取值是否需要 `tool_use` 目前缺少直接证据，建议先保持 `end_turn` 并在审计记录 `toolStopReasonStrategy`）

**结束**

- 优先以 `response.completed` 作为流结束信号；收到后再补齐：
  - 文本 `content_block_stop(index=0)`（若文本 block 已开始但未 stop）
  - `message_stop`
- 若 stream 结束但没见 `response.completed`：
  - 仍然补齐 `message_stop`（避免 Claude 侧报错）
  - 但必须在审计里记录 `missingUpstreamCompleted=true`（与 Codex 侧错误语义对齐；证据：`refence/codex/codex-rs/codex-api/src/sse/responses.rs:162`）

---

## 8. ModelSpec / tier 解析策略（v1 落地规范）

> 本节描述的是 **PromptXY v1 已落地** 的 tier 与 modelSpec 处理逻辑（与实现对齐），并明确审计要记录哪些证据。

### 8.1 tier 解析与路由映射（Claude → modelSpec）

1) `detectClaudeModelTier(model)`：`opus > haiku > sonnet(默认)`（证据：`backend/src/promptxy/model-mapping.ts:3`）  
2) `resolveClaudeMappedModelSpec(claudeModelMap, tier)`：
   - 需要 `claudeModelMap.sonnet`（缺失则 error）
   - `claudeModelMap[tier]` 缺失则回退 `sonnet`（证据：`backend/src/promptxy/model-mapping.ts:18`）

### 8.2 modelSpec effort 解析（OpenAI/Codex）

- 解析 `<base>-<effort>` 并写入 `reasoning.effort`（证据：`backend/src/promptxy/model-mapping.ts:45`）

### 8.3 审计要求（必须记录）

- `inputModel`（入站 Claude 原始值）
- `resolvedTier`
- `mappedModelSpec`
- `strategy`（`contains-opus|contains-haiku|default-sonnet`）
- `fallbackUsed`（bool，是否因缺省而回退 sonnet）
- `effortParsed`（可选：解析到的 reasoning effort）

---

## 9. Workbench（样本驱动生成/调试工作流）

> 本节定义“理想工作流”的产物格式，使得新增协议对/补齐字段变成可重复流程。

### 9.1 最小输入（你期望的形态）

- 一份成功的 `/claude` 原版请求（A）
- 一份成功的 `/codex` 原版请求（B）

### 9.2 最小输出（必须落库/可回放）

- `mapping skeleton`：字段/语义映射骨架（开发者可补）
- `defaults`：template/route(claudeModelMap 回退)/modelSpec effort 解析等注入项来源说明
- `report`：
  - `missingComparedToSample`（error）
  - `unmappedSourceFields`（清单）
  - `extraTargetFields`（清单）
  - `diffPatch`（JSON Patch）
- `fixtures`：保存 A/B 与 ignorePaths（回归用）

### 9.3 增量覆盖策略（附加更多请求）

- 支持添加 `(A2,B2)` `(A3,B3)` 形成样本集
- 产出字段“条件出现”报告（如 tools/stream/vision/long context）
- 允许生成 `when` 条件（按 `stream/tools.length/tier` 等）以避免把一次样本的特殊字段写死到所有请求中

---

## 10. 分阶段落地建议（实现路线，便于迭代与回归）

### Phase A：先把“审计 + 少字段 error”补齐（立刻提升可观测）

- 把转换前后请求（含 headers/path/body）与字段 diff 落库
- 引入 required 校验：缺字段直接 error
- 输出 unmapped 字段清单（最小实现：source paths - mapped paths）

### Phase B：补齐 SSE tool call 映射（让工具可用）

- 识别 codex SSE `response.output_item.done` 的 `function_call/custom_tool_call`
- 生成 Claude Code 期望的 `content_block_*` + `input_json_delta` 事件序列
- 处理 message_stop/completed 的边界一致性

### Phase C：引入 IR 与 Workbench（让新增对接变成可复用流程）

- 固化 `claude -> IR` 与 `IR -> codex` 的边界
- 产出 mapping/defaults/fixtures/report 的统一格式

---

## 11. 变更记录

- 2026-01-06：v1.0 初稿，固化本次重构目标、硬约束与关键对齐点；与两份协议 spec 文档形成互相引用的基线。
