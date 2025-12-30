# promptxy：项目初衷与需求溯源（可回溯文档）

本文档用于把项目早期的讨论、调研与决策过程“沉淀”为可复用材料，方便后续：

- 回忆项目最初要解决什么问题（Why）
- 确认边界与约束（Constraints / Non-Goals）
- 理解为什么采用当前架构（Decisions / Trade-offs）
- 在新增能力时不偏离目标（Scope guardrails）

> 说明：本文档描述的是**本地版（localhost）** `promptxy` 的 MVP 背景与需求。

---

## 1. 背景（Why）

在 AI coding 场景里，多个 AI CLI 工具（Claude Code / Codex CLI / Gemini CLI）会向各自的云端服务发起 HTTP(S) 请求。这些请求体中通常包含或隐式依赖“系统提示词/系统指令（system prompt / instructions）”，决定了工具的默认行为边界（例如：工具如何规划、如何修改文件、如何输出格式等）。

问题在于：默认规则并不总能满足个人工作流，需要在某些场景下对系统提示词做：

- **检索**：找到默认系统提示词中的特定片段
- **替换**：把某段规则替换为自定义规则
- **追加/插入**：在指定位置插入自定义规则
- **删除**：移除不想要的默认约束

因此需要一个“可控、可配置、可复用”的中间层，对请求体做可编排的“增删改（CRUD）”。

---

## 2. 目标与非目标（Goals / Non-Goals）

### 2.1 Goals（本期必须达成）

- **支持 3 个 AI CLI**：
  - Claude Code（Anthropic Messages API）
  - Codex CLI（OpenAI Responses API）
  - Gemini CLI（Gemini API Key 模式）
- **对请求体中的提示词字段做 CRUD**：
  - 检索 + 替换 + 追加 + 插入 + 删除（以规则引擎实现）
- **本地部署（localhost）**：
  - 默认监听 `127.0.0.1`，不做公网服务
- **认证信息完全透传**：
  - 不在 `promptxy` 配置里保存任何上游密钥
  - 不注入/生成上游认证，完全依赖 CLI 自身携带认证信息
- **流式响应可用**：
  - SSE/stream 响应透传，不阻断 CLI 的实时体验

### 2.2 Non-Goals（明确不做，避免需求漂移）

- 不做 HTTPS MITM（不安装根证书、不透明抓包）
- 不做多用户、账号池、额度统计（单用户本地使用场景）
- 不做响应改写（MVP 只改请求，不改 response）
- 不做通用"模型路由平台"（例如多 provider 混合路由），除非未来明确需要

> **注**：Web 管理面板最初是 Non-Goal，但在 v2.0 中已实现，提供规则管理、请求监控等可视化功能。

---

## 3. 调研与评估（Research）

本项目在启动阶段参考了两个本地已 clone 的项目（位于 `refence/` 下）：

```
refence/
  claude-code-router/
  claude-relay-service/
```

### 3.1 `claude-code-router`（结论：适合 Claude Code，但不是统一入口）

观察要点：

- 通过设置 `ANTHROPIC_BASE_URL` 把 Claude Code 请求指到本地服务（显式 base_url，而非 MITM）。
- 具备改写 `system` 的实际实现点（例如按 `<env>` 分割替换）。

结论：

- 对 Claude Code 友好、扩展方式清晰（plugin/transformer/agent）。
- 但它的定位更偏“Claude Code 专用路由器”，不是面向 3 个 CLI 的统一网关。

### 3.2 `claude-relay-service`（结论：覆盖面广，但对本地 MVP 偏重）

观察要点：

- 提供更“可运营”的中继服务形态（多账号/Redis/Web 面板/限流统计等）。
- 也支持 Codex CLI/Gemini CLI 等接入方式（通过 base_url 指向中继服务）。
- 内部存在对 Codex `instructions` 的固定注入/验证逻辑；如果要做“自由替换”，需要额外兼容其校验策略（尤其前缀不宜破坏）。

结论：

- 功能强、覆盖广，但对于“本地只做 prompt 改写”而言成本偏高（引入 Redis/账号体系/管理面板等复杂度）。

---

## 4. 核心决策（Key Decisions）

### 4.1 决策：选择“显式 base_url 网关”，不做 MITM

原因：

- 3 个 CLI 都能通过配置 `base_url/endpoint` 指向本地。
- MITM 的维护成本高，且在不同平台/网络环境更脆弱。

### 4.2 决策：做一个“统一规则引擎”，通过适配器支持不同协议

原因：

- Claude/Codex/Gemini 的“提示词字段”位置不同，但最终都能归一成“文本改写”。
- 把协议差异封装在 adapter 中，规则引擎保持纯粹（便于测试与迭代）。

### 4.3 决策：认证头完全透传，不存储任何上游密钥

原因：

- MVP 先解决“提示词改写”，不引入密钥管理的风险与复杂度。
- 本地运行更易控，且避免误记录敏感信息。

---

## 5. 需求落到实现：哪些字段会被改写？

为了“只改提示词、其余透传”，本项目在 MVP 中把改写面限定在以下字段：

### 5.1 Claude Code（Anthropic Messages API）

- 入口：`POST /v1/messages`
- 改写字段：`body.system`
  - 支持 string
  - 支持 text blocks array（仅改 `type: "text"` 的 `text`，保留非 text block）

### 5.2 Codex CLI（OpenAI Responses API）

- 入口：`POST /openai/v1/responses`（由本地前缀 `/openai` 映射）
- 改写字段：`body.instructions`（string）
- 风险提示：Codex 侧可能依赖前缀校验，建议优先使用“insert_after 固定前缀”而非整体替换。

### 5.3 Gemini CLI（Gemini API Key 模式）

- 入口：`POST /gemini/v1beta/...:generateContent`（由本地前缀 `/gemini` 映射）
- 改写字段：`body.system_instruction` / `body.systemInstruction`

---

## 6. 规则引擎：CRUD 的表达方式

规则以 `(client, field)` 为最低匹配维度，并支持按顺序执行一组操作（ops）。

支持的操作（MVP）：

- `set`
- `append`
- `prepend`
- `replace`（match 或 regex）
- `delete`（match 或 regex）
- `insert_before`（regex）
- `insert_after`（regex）

重要原则：

- **有序执行**：规则按配置顺序；同一规则的 ops 按声明顺序。
- **可预测**：不匹配则 no-op，不破坏请求转发。

---

## 7. 本项目在 OpenSpec 中的溯源位置

本项目采用 OpenSpec 记录需求与实施任务，关键变更为：

- change id：`add-promptxy-local-gateway`
- 提案与任务：`openspec/changes/add-promptxy-local-gateway/`
  - `proposal.md`：为什么做、做什么、影响面
  - `design.md`：关键架构决策与取舍
  - `tasks.md`：实施任务清单与验证项

建议在后续新增能力时，优先新增 OpenSpec change，并明确是否属于：

- 新 capability（ADDED）
- 修改既有行为（MODIFIED）

---

## 8. 后续演进（Roadmap 参考）

以下是“可能会需要，但不属于 MVP”的方向，供后续规划：

- Gemini Code Assist/GCA 模式适配（与 API Key 模式请求结构不同）
- 对缺失字段的“创建/补位”策略（例如 Codex 请求没有 `instructions` 时自动创建）
- 更丰富的匹配条件（按 path/method/model/session/project 等）
- 提供请求/响应的可选审计日志（需严格脱敏与本地存储策略）
- 多用户共享部署（需要鉴权、隔离、限额、可观测）
