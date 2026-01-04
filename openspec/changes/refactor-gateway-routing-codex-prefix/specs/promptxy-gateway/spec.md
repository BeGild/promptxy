## MODIFIED Requirements

### Requirement: Provider Route Mapping

网关对外暴露的本地前缀 MUST 为：

- `/claude`：Claude Code（Anthropic Messages）入口
- `/codex`：Codex CLI（Responses）入口
- `/gemini`：Gemini CLI 入口

并且系统 MUST NOT 暴露 `/openai` 前缀（不提供兼容别名）。

#### Scenario: `/codex` 前缀可用且 `/openai` 不存在

- **WHEN** 客户端向 `/codex/*` 发起请求
- **THEN** 系统按 `/codex` 作为入口前缀处理
- **AND THEN** 系统不接受 `/openai/*` 作为入口前缀

### Requirement: Upstream Request Forwarding

网关在选择上游时 MUST 使用 `routes` 配置（Route → Supplier），而不是直接按协议类型选择“第一个启用 supplier”。

#### Scenario: 网关按 routes 选择上游

- **GIVEN** `routes` 中存在 `localService=claude` 且 `enabled=true` 的路由，且其 `supplierId` 指向一个启用的供应商
- **WHEN** 客户端向 `/claude/*` 发起请求
- **THEN** 系统使用该路由选择上游 supplier 并转发请求

