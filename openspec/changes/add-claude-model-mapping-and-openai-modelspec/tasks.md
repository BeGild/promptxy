# Tasks: Claude 三档模型映射与 OpenAI ModelSpec 解析

## 0. 对齐与基线

- [x] 0.1 确认 Claude Code 的模型输入仅以 `haiku/sonnet/opus` 三档抽象配置
- [x] 0.2 确认 OpenAI Responses 上游用于思考深度的字段为 `reasoning.effort`
- [x] 0.3 回归基线：`/codex` 透明转发可用；`/claude` → `/codex` 当前因 `claude-*` 模型失败

## 1. 后端：类型与配置校验/迁移

- [x] 1.1 扩展 `Supplier`：新增 `supportedModels: string[]`，新增可选 `reasoningEfforts?: string[]`
- [x] 1.2 扩展 `Route`：新增可选 `claudeModelMap`（仅 claude 生效）
- [x] 1.3 配置校验：
  - `supportedModels` 数组化、去重、过滤空串
  - claude route：若 transformer!=none 且 enabled，则必须存在 `claudeModelMap.sonnet`
  - claudeModelMap 的值必须属于 supplier.supportedModels
- [x] 1.4 迁移策略（方案 5.2）：
  - haiku/opus 缺失时回落 sonnet
  - claudeModelMap 不存在仍报错（提示配置）

## 2. 后端：运行时映射与 modelSpec 解析

- [x] 2.1 实现 Claude 档位识别：`opus` 优先，其次 `haiku`，否则 `sonnet`
- [x] 2.2 `/claude` 跨协议时在 transformer 前覆盖 `model` 为映射后的上游 modelSpec
- [x] 2.3 实现 OpenAI modelSpec → reasoning 拆解：
  - 使用 supplier.reasoningEfforts（否则用默认 `["low","medium","high","xhigh"]`）
  - 仅当 suffix 命中列表才拆解；不命中则透传
  - 合并/覆盖 `reasoning.effort`

## 3. 前端：供应商模型 Chips 与 Claude 路由映射 UI

- [x] 3.1 SupplierManagementPage：新增 supportedModels Chips 编辑器（回车添加、× 删除、去重）
- [x] 3.2 RouteConfigPage：claude route 显示三档映射（sonnet 必填；haiku/opus 可选并提示“默认同 sonnet”）
- [x] 3.3 前端类型更新：`frontend/src/types/api.ts` 同步新增字段

## 4. 测试与回归

- [x] 4.1 后端单测：modelSpec 解析（不误拆 `gpt-4o-mini` 等）
- [x] 4.2 端到端验证：
  - `/codex`：`model=<base>-high` → 上游收到 `model=<base>` 且 reasoning.effort=high
  - `/claude`：model 含 `haiku/opus/sonnet` → 映射到上游 modelSpec → 解析 reasoning → 上游可识别并返回

## 5. 文档

- [x] 5.1 更新 README：说明 Supplier supportedModels、claudeModelMap、modelSpec + reasoning 行为
- [x] 5.2 增加排障指南：出现 400 claude_model_mapping_missing 时如何配置
