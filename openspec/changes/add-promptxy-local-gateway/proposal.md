# Change: Add local Prompt Gateway (`promptxy`)

## Why
Claude Code、Codex CLI、Gemini CLI 都会在请求体里携带（或隐式依赖）“系统提示词/指令”。但各自的默认提示词规则并不总是符合我们的工作流需求（例如：需要对某段默认规则做替换、删除、或在特定位置追加自定义规则）。

本变更新增一个本地（`localhost`）网关服务，让 3 个 CLI 通过 `base_url/endpoint` 指向本地，再由服务端基于规则引擎对请求体中的提示词字段做 **检索 + 增删改（CRUD）**，并将请求转发到真实上游 API，最终实现“无需修改 CLI 源码，即可定制系统规则”的目标。

## What Changes
- 新增本地 HTTP 网关（默认只监听 `127.0.0.1`），作为 3 个 CLI 的统一入口。
- 支持 3 类协议/客户端的请求接入与转发：
  - Claude Code（Anthropic Messages API：`/v1/messages`）
  - Codex CLI（OpenAI Responses API：`/v1/responses`，以 `/openai` 前缀挂载）
  - Gemini CLI（Gemini API Key 模式优先，以 `/gemini` 前缀挂载，先做最小可用适配）
- 增加“提示词改写”规则引擎：
  - 按 `client + field (+ path/method/model 可选)` 匹配规则
  - 支持 `replace/delete/append/prepend/insert_before/insert_after/set` 等操作
  - 规则按顺序执行、结果可预测
- 增加最小的可观测性与安全约束：
  - 可选 debug 日志（只记录被改写的字段差异，不记录密钥类 header）
  - 默认不落盘会话内容（本地工具优先）
  - 认证信息完全透传 CLI 自带 header，不在 `promptxy` 配置中保存上游密钥

## Impact
- Affected specs (new):
  - `promptxy-gateway`
  - `promptxy-rules`
- Affected code:
  - 新增 `promptxy` 本地服务（实现阶段创建）
- Compatibility:
  - 不做 HTTPS MITM；依赖 CLI 支持配置 `base_url/endpoint`（Claude Code / Codex CLI / Gemini CLI 均支持）
- Security:
  - 默认只绑定 `127.0.0.1`，避免局域网访问
  - 明确避免日志打印 `Authorization`、API key 等敏感头部
