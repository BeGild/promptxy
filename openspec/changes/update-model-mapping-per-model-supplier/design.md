# Design: 按模型粒度映射到供应商 + 模型

## Summary

将“路由 → 单一供应商”的模型映射机制升级为：

- 路由提供一个 **默认上游**（`defaultSupplierId`）。
- 每条模型映射规则在命中时可以指定 **目标供应商**（`targetSupplierId`）以及 **可选目标模型**（`targetModel?`）。
- `targetModel` 未提供时，网关将入站 `model` 原样透传给目标供应商。
- `transformer` 不再作为配置字段保存，运行时根据入口与目标供应商协议自动推断，并在入口协议约束下做强校验。

## Data Model

### Route

- `localService`: 固定入口（`claude|codex|gemini`）
- `defaultSupplierId`: 未命中规则时使用的默认上游（必填）
- `modelMapping`: 可选

### ModelMappingRule

- `pattern`: 通配符匹配入站模型
- `targetSupplierId`: 命中后选择的目标上游供应商
- `targetModel?`: 可选；缺失则透传入站 `model`

## Request Flow (Runtime)

1. 根据请求路径匹配入口（`/claude`、`/codex`、`/gemini`）并选择启用的 Route。
2. 读取入站 `model`（若缺失则视为未命中规则）。
3. 若 `modelMapping.enabled`：按顺序匹配规则，首个命中生效。
4. 计算 `effectiveSupplierId`：命中用 `targetSupplierId`，否则用 `defaultSupplierId`。
5. 计算 `effectiveModel`：命中且 `targetModel` 存在则用它；否则透传入站 `model`。
6. 推断 `transformer`：
   - `localService=codex`：仅允许 `supplier.protocol=openai` 且 transformer 固定为 `none`。
   - `localService=gemini`：仅允许 `supplier.protocol=gemini` 且 transformer 固定为 `none`。
   - `localService=claude`：
     - `supplier.protocol=anthropic` → transformer=`none`
     - `supplier.protocol=openai` → transformer=`codex`
     - `supplier.protocol=gemini` → transformer=`gemini`
7. 基于推断结果进行协议转换（如 `claude` 跨协议）并转发。

## Constraints & Validation

- Route 必须配置 `defaultSupplierId` 且引用存在的 supplier。
- 每条规则必须配置 `targetSupplierId` 且引用存在的 supplier。
- 对 `codex`/`gemini` 入口：规则选择的 supplier 必须与入口协议一致，否则返回 400（配置错误）。
- `targetModel` 校验策略：
  - 若目标 supplier 提供 `supportedModels` 且非空：`targetModel` 若提供，必须在列表中。
  - 若目标 supplier `supportedModels` 为空：前端不提供 model 下拉；规则允许 `targetModel` 为空（透传）。

## Backward Compatibility

本变更处于开发期，允许破坏性变更：不保证旧配置可直接运行。
将提供迁移脚本：
- `supplierId` → `defaultSupplierId`
- 移除 `transformer`
- 将旧的 model 映射规则目标补齐为 `targetSupplierId=defaultSupplierId`

## UI Design Notes

- 路由编辑页：
  - 顶部新增“默认上游供应商”选择（对应 `defaultSupplierId`）
  - 规则列表每条包含：pattern / 目标供应商 / 目标模型（可选）
  - 若目标供应商无 `supportedModels`：目标模型选择区显示“透传”提示

## Trade-offs

- 选择“运行时推断 transformer”减少配置负担，但要求校验逻辑更严格。
- 对 codex/gemini 入口保持协议固定，避免引入跨协议转换链带来的复杂性。
