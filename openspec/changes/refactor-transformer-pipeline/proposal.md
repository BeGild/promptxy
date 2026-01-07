# Change: 转换器重构（可审计流水线 + tool call 端到端闭环）

## Why

当前 PromptXY 已具备“Claude 入口跨协议转发到 Codex(/v1/responses)”的能力，并提供了 preview/trace 的基础诊断面板。但根据现有对齐文档（`docs/transformers/transformer-refactor.md`、`docs/protocols/*`）与实现现状对比，仍存在会直接阻断 v1 目标的问题：

- **tool call 不可用（关键阻断）**：
  - 请求侧：Claude `tool_use/tool_result` 尚未映射到 Codex `input[]` 的等价结构，无法形成 call/output 对称闭环。
  - 响应侧：Codex Responses SSE 中的 `response.output_item.done(function_call/custom_tool_call)` 尚未映射为 Claude Code 必需的 `content_block_* + input_json_delta + message_delta` 序列。
- **缺少字段级证据，难以审计与回放**：
  - 现有 trace 仅是 step 级摘要，无法回答“少字段在哪里”“默认值从哪来”“有哪些字段未映射”。
- **少字段必须 error 的落地不完整**：
  - 目前缺少对 `/v1/responses` 出站请求的“协议级 required + tool-call 对称性 invariants”校验与可定位错误输出。

本提案的目标是把“转换器”提升为可审计流水线（Pipeline），并以最小实现满足 v1 的端到端工具闭环与可验证性。

## What Changes

> 核心策略：**不在现有“歪地基”上修修补补**。当前转换器实现（尤其是 `/claude → /codex` 的 tool mapping 与 SSE tool call 映射）无法满足 v1 的硬约束；继续增量打补丁会把错误结构固化成历史负担。本 change 将以“**先删旧实现，再按规格重写并切换入口**”的方式落地，确保只有一套权威实现、没有历史负担干扰。

### 1) 后端：可审计 Pipeline（最小实现）

- **重写** Claude→Codex 转换逻辑为“可审计 Pipeline”，并将其作为唯一权威实现（旧实现删除，避免双轨）。
- Pipeline 必须产出 **字段级审计结构**（FieldAudit），并将其挂到 transform trace（preview 与历史落库均可观测）。
- 增加 **协议级校验**：
  - `/v1/responses` 出站请求的关键字段与类型校验（缺失即 error）
  - tool call `call_id` 对称性校验（缺失/孤儿/不对称即 error）
- 明确并落地 `instructions = template + system` 的规范化规则（template 作为默认值来源可审计）。

### 2) 请求映射：Claude tool_use/tool_result → Codex input[]（闭环）

- 将 Claude messages 中的 `tool_use` 映射为 Codex `function_call`（`arguments` 必须为 JSON string）。
- 将 `tool_result` 映射为 Codex `function_call_output`，并执行 call_id 配对与对称性校验。
- 保持 v1 的保守策略：非 string 的 tool_result 内容统一 stringify，并在审计中记录发生了 stringify。

### 3) 响应映射：Codex Responses SSE → Claude SSE tool_use 序列（闭环）

- 引入最小状态机：
  - 文本增量仍走 text_delta（index=0）
  - tool call 事件转换为 Claude Code 侧可消费的 `content_block_start(name/id) → input_json_delta(partial_json) → content_block_stop → message_delta`
  - 不再把所有 `response.output_item.done` 当作 stop 信号（需按 item.type 区分）
- 结束条件以 `response.completed` 为优先证据；若缺失则补齐 `message_stop` 并在审计中标记 `missingUpstreamCompleted=true`。

### 4) UI（最小必要）与可验证性

- Protocol Lab/preview 输出需要可展示 FieldAudit 的关键摘要（missing/extra/unmapped/defaulted/diffs），确保“可验证”不是只能看原始 JSON。

## Rewrite / Migration Plan（必须明确）

本 change 将以“**先删旧实现，再重建骨架并逐步补齐能力**”的方式完成迁移，避免旧代码在实现过程中继续被参考/误用导致偏离规格：

1. **删除旧实现（第一步）**：移除现有 `backend/src/promptxy/transformers/*` 内与协议转换相关的旧逻辑，并同步更新 gateway/preview 的调用入口，使 repo 内不存在可回退到旧逻辑的路径。
2. **重建新架构骨架**：按 `design.md` 的 Code Organization 搭出最小可编译的骨架（public API + pipeline runner + audit/errors），此时协议转换可临时返回明确的 “not implemented / validation error”。
3. **按验收目标补齐能力**：优先完成 v1 的可审计字段证据 + tool call 请求映射 + SSE tool call 状态机。
4. **回归验证并收口**：用 fixtures + Protocol Lab 逐用例验证通过后，确保没有遗留的旧实现文件/代码路径。

## Non-Goals（本提案不做）

- **Phase C（IR/Workbench）全量落地**：本提案优先交付 Phase A+B（审计 + tool call 闭环），IR 与样本驱动 Workbench 作为后续独立 change。
- 不引入新的 Router/多上游路由策略（沿用现有“单入口 → 单 supplier”模型）。

## Impact

- Affected code areas（实现阶段）：
  - `backend/src/promptxy/transformers/llms-compat.ts`（Claude→Codex 请求映射、校验、trace）
  - `backend/src/promptxy/transformers/sse.ts`（Codex SSE → Claude SSE tool call 状态机）
  - `backend/src/promptxy/transformers/types.ts`（trace/audit 数据结构扩展）
  - `backend/src/promptxy/gateway.ts`（落库 trace 的体积/字段管理；不改变既有安全约束）
- Affected specs（本提案新增/修改）：
  - `promptxy-protocol-transformation`（新增：FieldAudit、校验、tool call 映射、SSE 状态机）
  - `promptxy-protocol-lab`（修改：展示/导出 audit 摘要）

## Open Questions（需要在评审中明确）

1. **Claude SSE 的 `message_delta.delta.stop_reason`**：tool call 场景是否需要特定值（例如 `tool_use`），还是维持现状 `end_turn` 即可？（当前消费者逻辑只看 `message_delta` 事件本身，但希望确认验收标准）
2. **`custom_tool_call` 的映射策略**：当 Codex SSE 返回 `custom_tool_call.input` 为 string 时，Claude `tool_use.input` 应如何构造（包一层 object？还是直接 error）？
3. **FieldAudit 的落库策略**：是否需要对 `diffs/defaulted` 做截断或采样，以避免 request history 体积暴涨？（仍需保证可回放与可定位）
