# Tasks: 路由驱动网关（Supplier 解耦）与 `/codex` 前缀统一

## 后端

- [x] 网关按 `routes` 选择上游（移除按协议找 supplier 的 fallback）
- [x] `/claude` 支持跨协议转换（anthropic→codex/gemini），`/codex` 与 `/gemini` 仅透明转发
- [x] 路由 API 支持“同 localService 多条 route，但同一时刻仅 1 条 enabled”
- [x] 请求记录落盘并返回 route/supplier/transform 信息（含 `supplierBaseUrl`）
- [x] 统一移除 `/openai`，改为 `/codex`

## 前端

- [x] `useConfigStatus` 基于 routes + suppliers 计算 `/claude|/codex|/gemini` 当前命中 supplier
- [x] `ConfigStatusIndicator` 文案与前缀更新为 `/codex`
- [x] 路由配置页面 UI 紧凑化：每行一个路由，不换行炸裂
- [x] 测试/预览默认路径修正：Codex 使用 `/responses`

## 文档与测试

- [x] 更新文档/CLI help：示例统一 `/codex`
- [x] 更新后端测试配置与路径（移除 `/openai`）
