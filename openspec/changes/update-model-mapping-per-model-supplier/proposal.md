# Change: 按模型粒度映射到供应商 + 模型

## Why

当前路由配置的模型映射粒度仍然绑定在“已选供应商”的前提下：只能在某个路由选择一个供应商后，再在该供应商的 supportedModels 中做 model 映射。
这无法满足“不同入站模型映射到不同供应商+不同模型”的需求。

另外，当目标供应商未指定目标模型时，期望行为应为“透传入站模型”（不强制映射）。

## What Changes

- **新增能力**：对每个入站 `model`（通配符匹配）支持映射到「目标供应商 +（可选）目标模型」。
- **未指定目标模型**：当规则命中但未填写 `targetModel` 时，网关将把入站 `model` 原样透传给目标供应商。
- **未命中规则**：仍走路由的默认上游供应商（保持现有默认行为），并原样透传 `model`。
- **BREAKING（配置结构）**：
  - `routes[].supplierId` 改为 `routes[].defaultSupplierId`（默认上游）。
  - `routes[].transformer` 不再存储；运行时根据 `localService` 与目标供应商 `protocol` 自动推断 transformer 并强制校验。
  - `modelMapping.rules[]` 的规则目标从「仅模型」升级为「目标供应商 + 可选目标模型」。

## Non-Goals

- 不新增任意自定义入口路径（仍保持 `/claude`、`/codex`、`/gemini` 固定入口）。
- 不允许 `codex`/`gemini` 入口跨协议选择目标供应商（入口协议固定，保持透明转发语义）。
- 不引入复杂的负载均衡、权重、随机选择等策略。

## Impact

- Affected spec: `promptxy-gateway`
- Affected backend areas: 路由解析、供应商选择、协议转换器推断与校验、配置校验
- Affected frontend areas: 路由配置 UI（默认上游 + 规则级选择目标供应商/模型）
- Migration: 需要提供迁移脚本将旧配置转换为新结构（并备份原文件）。
