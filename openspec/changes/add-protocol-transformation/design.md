# Design: 协议转换（Claude Code 统一入口 → 单上游）与可验证预览/Trace

## Goals（v1）

1. **对下游完全兼容 Claude Code（Anthropic Messages）**：不要求增加任何自定义 header/字段。
2. **单上游协议转换**：命中 `localPrefix` 后将请求转换并转发到该 supplier（不引入 Router）。
3. **可验证**：提供可交互的 preview/trace，支持定位配置与转换问题。
4. **安全默认**：不落盘入站 request headers；所有输出默认脱敏；禁止 token 明文泄漏。

## Non-Goals（v1）

- 多上游选择与路由策略（Router）
- 字段级映射画布作为默认交付（v2+ 可选）

## High-level Architecture

```
Claude Code (Anthropic Messages)
  |
  | 1) 请求进入 PromptXY（/v1/messages）
  v
PromptXY Gateway
  | 2) supplier 命中（localPrefix）
  | 3) gatewayAuth 校验（可选；读取 acceptedHeaders）
  | 4) parse JSON（尽量保持失败透传）
  | 5) rules/adapters（内容修改）
  | 6) protocol transformer（@musistudio/llms 薄封装）
  | 7) supplier.auth 注入/覆盖（可选）
  v
Upstream Supplier API (OpenAI compatible / Gemini / ...)
  |
  | 8) 响应转换（含 streaming：解析→转换→序列化）
  v
Claude Code（保持 Anthropic 兼容响应）
```

## Key Decisions

### Decision 1: “最薄封装 llms”

**选择**：以 `@musistudio/llms` 为主要协议转换实现；PromptXY 只负责：

- 配置结构与校验（尽量贴近 llms 的能力，但保留 PromptXY 自己的显式结构）
- transformer registry（可列出可用 transformer、编译 chain、选择 default vs model override）
- trace/diagnostics 输出
- 与网关管线的集成（插入位置、错误处理、脱敏）

**理由**：协议转换与 streaming 细节复杂，复用成熟实现降低维护成本。

### Decision 2: v1 只做“统一入口 → 单上游”

**选择**：保持 `localPrefix` ⇄ supplier 的既有约束，不引入 Router。

**理由**：将可变复杂度（路由策略）延后，优先把协议转换与可验证性做扎实。

### Decision 3: 鉴权模型：gatewayAuth 与 supplier.auth 解耦

**选择**：

- `gatewayAuth`：用于访问 PromptXY（入站鉴权）
- `supplier.auth`：用于访问上游（上游鉴权）

并且：

- v1 不要求 Claude Code 增加自定义 header/字段
- `gatewayAuth.acceptedHeaders` 只允许从“客户端原生会发送的 header”读取 token（通过运行时观测收敛默认值）
- 入站鉴权通过后必须清理相关 header，避免误传到上游
- 转发上游时如果 `supplier.auth` 存在，则注入/覆盖上游鉴权，不透传入站凭证

**理由**：实现“统一入口 token”与“上游密钥”分离，降低误用与泄漏风险。

**运行时观测建议**：

- 在 Claude Code 已指向 PromptXY 的前提下，运行 `cc_lo -p "<提示词>"` 触发真实请求
- 后端通过 transform trace 返回 `authHeaderUsed`（仅 header 名称，不含值），以确定 `acceptedHeaders` 的最小集合

### Decision 4: pathMappings 与 transformer 的职责边界

**选择**：

- `pathMappings`：只做 URL path rewrite
- `transformer`：只做 body/headers/stream 的协议语义转换，不负责 path rewrite

**理由**：避免“双重转换/隐式路由”，提高可预测性与可测试性。

### Decision 5: UI v1 默认交付工作台，不交付画布

**选择**：协议实验室交付“三栏工作台：输入 / 预览 / trace”，画布映射仅保留 v2+ 扩展点。

**理由**：画布需要稳定可信的字段级映射数据，v1 优先交付可验证与排障能力。

## Data Contracts（摘要）

### Supplier.transformer（PromptXY 显式结构）

- `default: chain`（必填）
- `models: { [model: string]: chain }`（可选，精确匹配）
- `chain` step：
  - `"name"` 或 `{ "name": "name", "options": { ... } }`

### Preview / Trace

- Preview：上游 method/path/headers/body（默认脱敏）
- Trace：supplier 命中、链选择、步骤摘要、warnings/errors、耗时（不含明文 token）

## Risks / Trade-offs

- **Streaming 转换复杂度**：需要解析与序列化 SSE，且事件粒度不同可能需要状态机。
- **密钥存储信任成本**：必须提供清晰的 UI 文案与脱敏策略；日志/历史禁止明文。
- **Claude Code 鉴权 header 不确定性**：由于 fixture 默认不落盘 request headers，需要通过运行时观测收敛 `acceptedHeaders` 默认值。
