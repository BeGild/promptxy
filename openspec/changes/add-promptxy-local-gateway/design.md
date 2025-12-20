## Context
本项目要解决的核心问题是：在不修改 Claude Code、Codex CLI、Gemini CLI 的情况下，对它们请求中的“系统提示词/指令”进行可配置的增删改（CRUD），从而让 AI 工具有“默认规则之外的规则”。

约束与边界：
- 部署形态先做本地（`localhost`），不考虑多用户鉴权、账号池、Web 面板等运维能力。
- 目标是“请求体改写 + 转发”，不是“模型路由平台”或“账号聚合服务”。
- 不采用 HTTPS MITM（不安装根证书、不做透明抓包），而是让 CLI 明确指向本地 `base_url/endpoint`。

## Goals / Non-Goals
### Goals
- 在本地提供一个稳定的 HTTP 网关，支持 3 个 CLI 的请求接入与上游转发。
- 提供规则引擎，对提示词字段做检索与 CRUD（replace/delete/append/insert…）。
- 支持流式响应透传（SSE/stream），避免破坏 CLI 的实时体验。
- 默认安全：不打印敏感 header、不默认落盘对话内容。

### Non-Goals (for MVP)
- 多人共享部署、用户体系、API key 管理、额度统计、账号池轮换（后续再做）。
- 通用模型路由（OpenRouter/多 provider 统一）——除非后续明确需要。
- 对响应内容进行二次改写（先仅改请求）。
- 对 CLI 的所有私有协议进行“完全兼容”（Gemini 的 Code Assist 形态先做最小可用适配，靠样本驱动完善）。

## Decisions
### Decision: 采用“本地显式 Base URL 网关”而非 MITM
理由：
- Claude Code / Codex CLI / Gemini CLI 都有官方/社区支持的 endpoint 配置能力。
- MITM 需要安装证书且对不同平台更脆弱，维护成本高。
- 显式网关更可控、可测试、可版本化。

### Decision: 以“协议适配器 + 统一规则引擎”的结构实现
结构：
- `Gateway`：HTTP 入口、路由、上游转发、stream 透传
- `Adapters`：按客户端/协议抽取并写回提示词字段
- `Rules Engine`：对抽取出的文本做 CRUD 操作并返回变更结果

这样做的好处：
- 规则引擎与协议解耦：未来加新 CLI 只需写 adapter。
- 操作可测试：rules engine 可以纯函数单测，adapter 可用 fixture 驱动测试。

### Decision: 最小改写面（只改“提示词字段”）
MVP 只改以下字段（按 CLI/协议）：
- Claude Code：`body.system`（string 或 text blocks array）
- Codex CLI：`body.instructions`（string）
- Gemini CLI：优先支持最常见的系统指令字段（实现阶段以抓样本为准）

其他字段（model/tools/temperature/headers）在 MVP 不主动干预，仅透传。

### Decision: 认证信息完全透传，不在本地配置保存上游密钥
MVP 阶段 `promptxy` 不提供“上游密钥注入”能力：
- 不在配置文件中保存/读取任何上游 API key
- 对来自 CLI 的认证头部（例如 `Authorization`、`x-goog-api-key` 等）做原样透传
- 配合默认的“敏感头不落日志”策略，降低本地误泄漏风险

### Decision: 流式响应采用“字节透传”
MVP 不解析 SSE 内容、不重写响应，只保证：
- 状态码与响应体原样透传
- `content-type`/`transfer-encoding` 等关键 header 尽可能保留
- 不对 stream 做全量缓冲（避免延迟与内存风险）

## Alternatives Considered
- 直接改造 `claude-code-router`：Claude Code 场景很顺，但扩展到 Codex/Gemini 需要补更多协议入口，且会混入“模型路由/transformer”相关复杂度。
- 直接使用 `claude-relay-service`：覆盖面广但偏“可运营服务”，本地 MVP 只做 prompt 改写会显得过重（Redis/Web/账号池等）。
- 使用 LiteLLM Proxy：能力强但引入更多概念（provider、billing、key mgmt），与“本地最小改写”目标不匹配。
- mitmproxy/自签 CA：可做到透明抓包，但运维与安全成本高，不符合 MVP 取向。

## Risks / Trade-offs
- CLI 请求体结构可能随版本变化 → 通过 adapter 的健壮性（best-effort no-op）+ fixture 测试缓解。
- Gemini CLI 的两种模式（API Key / Code Assist）字段差异大 → 采用“样本驱动完善”的策略，先保证不阻断请求。
- 规则 CRUD 可能破坏 CLI 的校验前缀（尤其 Codex CLI） → 规则层支持“insert_after 固定前缀”等安全用法，并在文档中强调。

## Migration Plan
本变更为新增本地工具，无既有数据迁移。

## Open Questions
- 规则配置格式：JSON vs YAML（MVP 先 JSON，后续如有需要再加 YAML）。
