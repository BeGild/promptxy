# Change: 协议转换（Claude Code 统一入口 → 单上游）与可验证预览/Trace

## Why

PromptXY 当前的核心价值是本地 HTTP 网关 + rules（提示词/字段修改）+ 请求历史与可视化查看。但当前网关默认假设“下游协议 == 上游协议”，这会导致：

- Claude Code（Anthropic Messages）无法稳定对接 OpenAI compatible（DeepSeek/Groq/OpenRouter/Ollama 等）或 Gemini 等上游
- tools / streaming / tool_use 等结构差异难以靠 rules 层解决
- 用户在配置错误时只能看到“请求失败/工具不可用”，缺乏可定位的诊断与可验证手段

`docs/protocol-transformation-research.md` 已给出结论：协议转换属于高耦合高出错成本能力，v1 必须以“可验证（预览 + trace）”作为一等能力交付；同时 v1 明确边界为“统一入口 + 协议转换到一个指定上游”（单 `localPrefix` ⇄ 单 supplier），不引入 Router。

## What Changes

### 新增能力（v1）

- **协议转换层（后端）**
  - 以 Claude Code / Anthropic Messages 作为下游入口协议
  - 支持将请求转换为指定 supplier 上游协议，并将上游响应转换回 Anthropic（含 streaming）
  - 采用 `@musistudio/llms` 作为主要转换实现，PromptXY 仅做“薄封装”（注册、配置校验、trace、与网关集成）

- **可验证（Preview + Trace）**
  - 提供可交互的“转换预览/验证”能力：输入示例请求 → 输出 rules 后请求、上游请求预览（默认脱敏）、trace/warnings/errors
  - 支持定位：命中 supplier、命中链（default / model override）、每一步 transformer 的摘要与失败原因

- **鉴权模型调整（兼容 Claude Code，不要求新增自定义 header）**
  - 新增 `gatewayAuth`（入站鉴权）：仅从客户端原生可发送的鉴权头读取 token（header 名称由配置决定），不要求 Claude Code 发送额外字段
  - 新增 `supplier.auth`（上游鉴权）：PromptXY 存储并注入/覆盖上游鉴权（与入站 token 解耦）
  - 默认不落盘入站 `requestHeaders`（避免 token/secret 写入本地文件）；诊断只允许记录“header 名称/存在性”，不记录值
  - `gatewayAuth.acceptedHeaders` 的收敛方式：通过运行 `cc_lo -p "<提示词>"` 触发真实 Claude Code 请求（在 Claude Code 已指向 PromptXY 的前提下），由后端捕获该请求的完整入站信息并解析（仅用于确定“使用了哪个 header 名称”，不落盘 header 值）

### UI/UX 方向（v1）

- “协议转换实验室”默认以三栏工作台交付：示例请求 / 上游请求预览（脱敏）/ trace + warnings
- 画布映射（React Flow）作为 v2+ 可选高级视图，不阻塞 v1

## Non-Goals（v1 明确不做）

- 不引入 Router（按任务/模型/脚本做多上游选择）
- 不提供字段级映射画布作为默认视图（仅保留 v2+ 扩展点）
- 不要求 Claude Code 增加任何自定义 header/字段（例如 `x-promptxy-token`）

## Impact

- **Affected specs（新增）**
  - `promptxy-protocol-transformation`：协议转换配置/执行/trace
  - `promptxy-protocol-lab`：可验证预览与 trace UI

- **Affected specs（修改）**
  - `promptxy-gateway`
    - 认证模型从“仅透传客户端鉴权”扩展为“可选 gatewayAuth + 可选 supplier.auth 注入/覆盖”
    - streaming 从“纯透传”扩展为“可选转换（解析 → 转换 → 序列化 → 输出）”

- **Security**
  - 需要显式管理 supplier token/key 存储与脱敏展示
  - preview/trace 输出默认隐藏敏感字段，日志/历史不得落盘明文 token

## Open Questions

（已确认）

1. v1 将“Claude Code → OpenAI/Gemini compatible 上游”的 **streaming 全链路转换** 列为硬验收。
2. `gatewayAuth.acceptedHeaders` 的 header 名称通过 `cc_lo -p "<提示词>"` 触发真实请求，由后端捕获并解析确定；不增加任何 Claude Code 侧自定义 header/字段。
