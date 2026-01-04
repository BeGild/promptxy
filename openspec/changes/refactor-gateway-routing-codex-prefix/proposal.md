# Change: 路由驱动网关（Supplier 解耦）与 `/codex` 前缀统一

## Why

当前 PromptXY 存在三类“配置与运行时不一致”的混乱：

1. **运行时仍在按路径前缀直接选 Supplier**：网关会按 `/claude|/openai|/gemini` 推断协议后选择“第一个启用的 supplier”，绕过 `routes` 配置，导致“前端路由配置页”与“实际生效的上游”不一致。
2. **`/openai` 与 `/codex` 混用**：前端已出现 `/codex`，后端/文档仍使用 `/openai`，造成 CLI 配置和 UI 展示错位。
3. **请求记录缺少路由/转换透明度**：请求详情无法稳定展示“命中的路由/转换器/上游 supplier 服务”，影响排障。

## What Changes

- 网关请求转发完全改为 **Route → Supplier**：
  - `/claude|/codex|/gemini` 仅决定 `localService`
  - 再从 `config.routes` 选择该 `localService` 当前启用的路由（`route.enabled=true`）
  - 彻底移除“按协议找第一个启用 supplier”的旧 fallback 行为
- **Claude 入口支持跨协议**：`/claude/*` 可以对接 `anthropic|openai|gemini` 上游（通过转换器）。
- **Codex/Gemini 入口保持透明**：`/codex/*` 仅允许对接 `openai` 协议供应商；`/gemini/*` 仅允许对接 `gemini` 协议供应商；均不做跨协议转换。
- **统一前缀**：移除 `/openai`，统一对外暴露 `/codex`。
- **请求记录增强**：请求详情落盘并返回：
  - 命中的 `routeId`
  - 命中的 `supplierId/supplierName/supplierBaseUrl`
  - 命中的 `transformerChain` 与 `transformTrace`

## Impact

- **Breaking**：移除 `/openai` 前缀（不提供兼容别名）。
- 影响范围：
  - 后端：网关路由选择、协议转换、请求落盘结构、路由管理 API 语义
  - 前端：配置状态指示器、路由配置 UI、示例请求路径
  - 文档：CLI 配置与示例统一为 `/codex`

