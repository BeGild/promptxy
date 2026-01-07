# Design: 转换器重构（可审计流水线 + tool call 端到端闭环）

## Goals（v1）

1. **tool call 端到端可用**：Claude Code → PromptXY → Codex Responses → PromptXY → Claude Code，工具闭环可运行。
2. **少字段必须 error，多字段 OK 但可观测**：缺 required/关键语义字段必须阻断并给出可定位原因；额外字段允许但必须进入审计。
3. **可审计、可回放**：每次转换都能回答：
   - 哪些字段来自源请求、哪些是默认值、哪些被丢弃/未映射
   - upstream stream 是否缺失 `response.completed`
4. **推倒重写 transformers 系统**：删除现有 transformers 代码与隐式行为，从零实现一套可审计、可扩展的转换器架构，并作为唯一权威实现。
5. **可扩展可维护**：新增协议/供应商时，主要通过新增协议模块与少量配置完成，不应继续堆叠 if-else 与跨文件耦合。

## Non-Goals

- 完整 IR 类型系统与 Workbench 的样本驱动生成（作为后续 change）。
- 新的路由策略/多上游选择。

## High-level Architecture（v1 最小实现）

```
Inbound Claude (/v1/messages)
  |
  | Parse + Normalize (保持 blocks)
  v
Claude → Codex Request Transform
  - instructions = template + normalize(system)
  - messages(text/tool_use/tool_result) → input[] (message/function_call/function_call_output)
  - tools[] schema normalize（保守策略）
  - Validate (required + call_id 对称性)
  - Audit (FieldAudit: missing/extra/unmapped/defaulted/diffs)
  v
Upstream Codex (/v1/responses, stream=true)
  |
  | Codex SSE → Claude SSE Transform (状态机)
  v
Outbound Claude SSE (tool loop 可消费)
```

## Code Organization（v1，新架构）

> 目标：让“新增协议/新增字段/新增校验”变成局部改动，而不是在一个巨型文件里做全局 if-else 手术。

建议以 `backend/src/promptxy/transformers/` 作为唯一实现入口（旧目录将被删除并以同名新结构重建），并按职责拆分：

```
backend/src/promptxy/transformers/
  index.ts                      # public API：供 gateway/preview 调用
  engine/
    engine.ts                   # TransformerEngine：选择协议对、组织 pipeline、产出 trace/audit
    pipeline.ts                 # Pipeline runner：统一 stage 执行与错误包装
    errors.ts                   # 结构化错误（validation/mapping/sse）
  audit/
    field-audit.ts              # FieldAudit 数据结构与收集器
    json-pointer.ts             # JSON Pointer 规范化/拼接工具
    diff.ts                     # 生成 diffs（可截断预览）
  protocols/
    claude/
      parse.ts                  # Claude 入站解析（保留 blocks）
      normalize.ts              # 最小规范化（system/messages/tool blocks）
      types.ts
    codex/
      render.ts                 # 渲染 /v1/responses request（含 instructions 拼接策略）
      validate.ts               # Codex 请求校验（required/types + call_id 对称性）
      sse/
        parse.ts                # 解析 Codex Responses SSE（以 data.type 为准）
        to-claude.ts            # SSE 状态机（text + tool call → Claude SSE 序列）
      types.ts
    openai-chat/                # （如仍需兼容 openai chat.completions，可放这里）
    gemini/                     # （如仍需 gemini 协议转换，可放这里）
  policy/
    instructions-template.ts    # template 来源策略（环境变量/配置/内置）
    tool-schema.ts              # tool schema 裁剪/strict 策略（可配置）
  sse/
    sse.ts                      # 通用 SSE parse/serialize（协议无关）
```

### 代码组织原则（必须遵守）

1. **协议隔离**：任何“Claude 特有字段/事件”只能出现在 `protocols/claude/*`；任何“Codex 特有字段/事件”只能出现在 `protocols/codex/*`。
2. **单一入口**：gateway 与 preview 只依赖 `transformers/index.ts` 暴露的 API，避免在网关层散落协议细节。
3. **校验与转换解耦**：先转换，再校验；校验失败必须给出 FieldAudit 可定位信息。
4. **审计一等公民**：每个 stage 都可以往 FieldAudit 写证据（defaulted/unmapped/missing/extra），而不是只在日志里写字符串。
5. **为 IR 预留位置但不强行引入**：v1 只做“最小规范化 + 可审计 pipeline”，完整 IR 作为后续 change。

## Key Decisions

### Decision 0: 全量推倒重写 transformers（先删后写）

**选择**：对整个 transformers 系统采用“先删除旧代码、再按新架构重建”的方式落地：

- apply 阶段的第一步执行删除（旧 transformers 目录及其对外入口）
- 删除后开始新实现的骨架与功能重建，避免旧代码“参考/借用/迁移”导致歧形继续扩散
- 最终 repo 内只保留新 transformers 架构（无双轨、无 fallback 到旧逻辑）

**理由**：当前转换器实现未满足 v1 的硬约束（tool call 端到端闭环与可审计证据），且历史上已经形成“看起来能跑、但关键路径不可用”的风险。继续增量修补会把错误抽象固化为长期负担，并造成“规格写 A，代码跑 B”的持续风险。

### Decision 1: FieldAudit 以 JSON Pointer 为字段路径标准

**选择**：FieldAudit 中所有路径使用 JSON Pointer（`/a/0/b`），避免点号路径歧义与转义问题。

**理由**：字段级 diff/校验/错误定位需要稳定且无歧义的路径表达。

### Decision 2: FieldAudit 作为 trace 的扩展载体（向后兼容）

**选择**：在现有 transform trace（step 级）结构上扩展一个字段级 audit 结构（不改变旧字段语义）。

**理由**：最小侵入、便于在 Preview 与历史落库中复用同一结构。

### Decision 3: 校验来源以“可印证实现”为基线，而非 schema 文件

**选择**：协议级 required 与 SSE 结束条件等关键规则，以 `refence/codex` 与 `refence/claude-code-router` 的实现行为为证据基线。

**理由**：避免把抽取/推断得到的 JSON schema 误当作协议真理，降低误导风险。

### Decision 4: 工具闭环以 call_id 对称性为硬 invariant

**选择**：请求侧必须生成对称的 `function_call` ↔ `function_call_output`（或 custom_tool_call 对应 output），否则直接 error。

**理由**：这类错误不应被 silent fallback 掩盖；否则上游/下游会在更晚处失败，难定位。

### Decision 5: SSE 转换必须按 item.type 区分 output_item.done

**选择**：`response.output_item.done` 不再一刀切视为 stop；必须解析 `item.type`：

- `message`：可作为文本输出收束的一部分
- `function_call/custom_tool_call`：必须转为 Claude tool_use 序列

**理由**：否则 tool call 会被提前 message_stop 截断，直接导致工具不可用。

## Error Model（建议）

为保证“少字段必须 error”可定位，建议统一输出结构（示例）：

- `error`: 固定错误类型，例如 `transform_validation_error`
- `message`: 可读描述
- `details`: `{ missingPaths, invariant, stepName }`

（具体字段名在实现阶段可调整，但必须能映射回 FieldAudit 的路径清单）

## Risks / Trade-offs

- **审计体积**：字段级 diff/defaulted 可能增长 request history 体积；需要截断/采样策略，但不能破坏可定位性。
- **custom_tool_call 语义**：Codex 的 custom tool 输入是 string，而 Claude tool_use 的 input 期望 object；需要策略明确。
- **事件顺序**：多 tool call + 文本交错场景需要状态机稳健处理；必须补充 fixtures 覆盖。
- **先删后写的中间态不可运行**：实现过程中会短暂处于“编译失败/功能缺失”的状态；必须通过细粒度任务与持续验证确保最终提交是可运行的。
- **重写带来的切换风险**：必须用 fixtures + 预览工具验证行为，且删除旧实现后不保留隐式回滚路径，避免回滚变成“隐性分叉”。  
