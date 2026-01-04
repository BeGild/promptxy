# Change: Claude 三档模型映射（haiku/sonnet/opus）与 OpenAI ModelSpec（reasoning effort）解析

## Why

当前 PromptXY 已支持 `/claude` → `/codex`（OpenAI Responses）协议转换，但仍存在一个“必然失败”的兼容性缺口：

- Claude Code 发起的请求 `model` 通常为 `claude-{VERSION}-{TYPE}-{DATE}`（例如包含 `sonnet/opus/haiku`）
- 当该请求通过 `/claude` 路由转到 OpenAI/Codex 上游时，现有转换会把 `model` 原样带入 OpenAI Responses 请求体
- 上游供应商无法识别 `claude-*` 模型名，导致请求 400/失败

此外，Codex/OpenAI 侧存在“思考深度（reasoning effort）”能力。为支持在 UI/配置中稳定表达“模型 + 思考深度”，需要引入可配置的 modelSpec 表达方式（例如 `gpt-5.2-codex-high`），并在发往上游前拆解为：

- `model = gpt-5.2-codex`
- `reasoning.effort = high`

本变更目标是：**通过“供应商声明支持模型 + Claude 路由三档映射 + 出站 modelSpec 拆解”**，让 `/claude` → `/codex` 请求能被上游识别，同时保持可用性（识别失败默认 sonnet、haiku/opus 回落 sonnet）。

## What Changes

### 配置层（数据结构）

- Supplier 新增 `supportedModels: string[]`，用于：
  - UI 下拉选择可用上游模型
  - 后端校验路由映射的正确性（避免映射到不存在的模型）
- Supplier（OpenAI/Codex）新增可选 `reasoningEfforts?: string[]`：
  - 用于判断 modelSpec 最后一个 `-suffix` 是否应当解析为 `reasoning.effort`
  - 默认值由系统内置（不要求 UI 配置）
  - **未知 suffix 不报错，直接透传为模型名**（增强普适性）
- Route（仅 `localService=claude`）新增可选 `claudeModelMap`：
  - 最小要求：必须配置 `sonnet -> <上游模型>`
  - 可选：`haiku/opus` 未配置则回落到 `sonnet`

### 运行时行为（网关）

- Claude 模型档位识别：
  - 只识别 `haiku/opus/sonnet`（大小写不敏感）
  - 识别不到则视为 `sonnet`（提高可用性）
- `/claude` 入口跨协议时（例如 transformer=codex/gemini）：
  - 根据档位选择上游模型（优先 haiku/opus 映射，否则回落 sonnet）
  - 将请求体内 `model` 覆盖为上游模型 spec 再进入后续转换
  - 若完全未配置 `claudeModelMap` 则返回 400（避免 silent 失败）
- OpenAI/Codex 出站请求（含 `/codex` 透明转发与 `/claude` 转换后）：
  - 若 `model` 形如 `<base>-<effort>` 且 `<effort>` 命中 supplier 的 `reasoningEfforts`（或默认列表），则：
    - `model = <base>`
    - 注入/覆盖 `reasoning.effort = <effort>`
  - 若不命中则不拆解，直接透传（不报错）

### UI（仅新增必要表单能力）

- 供应商管理：支持模型列表以 **Chips** 方式编辑（回车添加、点击 × 删除）
- 路由配置：当 `localService=claude` 时展示 Claude 三档映射：
  - sonnet 必填（从 supplier.supportedModels 下拉选择）
  - haiku/opus 可选（未选则回落 sonnet）

## Non-Goals

- 不新增 `/openai` 前缀兼容路由（继续严格只暴露 `/codex`）
- 不在 UI 中暴露 `reasoningEfforts` 配置（选项 A：仅后端支持，默认列表内置）
- 不引入 Router（按任务/模型做多上游选择）

## Impact

- Affected spec:
  - `promptxy-gateway`（配置结构扩展 + `/claude` → 上游映射行为 + `/codex` 出站 modelSpec 解析）
- Affected code (预计)：
  - 后端：`types.ts`、`config.ts` 校验与迁移、`gateway.ts` 请求管线、（可能）transform preview API
  - 前端：`SupplierManagementPage`、`RouteConfigPage`、`types/api.ts`

## Rollout / Compatibility

- 旧配置中没有 `supportedModels` 与 `claudeModelMap`
- 策略：
  - 若 `/claude` route 需要跨协议（transformer!=none）但未配置 `claudeModelMap`，运行时返回 400，并提示用户在路由配置中补齐（至少 sonnet）
  - 若已配置 `claudeModelMap.sonnet`，haiku/opus 缺失则自动回落 sonnet（提升可用性）

