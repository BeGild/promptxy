# 网关领域边界化重构设计（可维护性 + 稳定性优先）

> 主题：在现有 `gateway-pipeline` 重构基础上，引入更清晰的 **领域边界与核心契约**，让网关从“上帝对象 + 分散分支”演进为“契约驱动 + 可机械迁移”的架构。
>
> 背景约束：遵循项目关键决策——转换器只需要支持 **`/claude -> 任意供应商`**；本次允许做一次“小的破坏性调整”（优先落在配置收敛）。

## 1. 背景与动机

当前网关体系已经在做 pipeline 化（`backend/src/promptxy/gateway-pipeline/*`），这是正确方向；但从可维护性与稳定性视角看，仍存在结构性风险：

- `gateway.ts` 仍然承担大量职责（路由、规则、转换、上游执行、流式写回、记录/广播），变更影响面大。
- 新旧组织形态并存（`gateway.ts` + `gateway-pipeline` + 既有 `routing/transformers/proxying/streaming`），长期容易出现“计划/日志与实际执行漂移”。
- 错误处理模型在多个层级分散，尤其是 SSE/流式边界收尾需要更强的一致性保障。

本设计目标是：**先固化边界与契约，再迁移实现**，让后续重构具备稳定护栏（测试可锁定、回归可定位）。

## 2. 目标 / 非目标

### 2.1 目标

- 显式化网关处理链路的关键契约：`InboundRequest`、`RoutePlan`、`TransformPlan`/`UpstreamRequest`、`AuditTrail`。
- 将核心“决策逻辑”迁移到领域层：可单测、无 I/O、无 HTTP 细节。
- 统一错误模型（领域错误 → 接口层映射），保证失败路径可预测、可观测，特别是流式“确定性结束”。
- 允许一次小范围破坏性调整，用于**配置结构收敛**，降低长期认知负担。

### 2.2 非目标

- 不新增或完善 `/codex`、`/gemini` 等客户端方向的转换器能力。
- 不做插件化/微核等高抽象方案（YAGNI）。
- 不在本轮追求性能极限优化；先把边界与测试护栏立起来。

## 3. 现状问题（批判性 review 摘要）

1) **上帝对象风险**：`gateway.ts` 过大、职责过载，测试难、回归风险高。

2) **分层不彻底**：pipeline 步骤存在，但领域逻辑仍可能散落在网关/步骤/工具函数中，导致规则、路由、转换在多个点被重复/条件性处理。

3) **类型与错误分散**：通过大量 `union` 返回值 + 多处 `status/message` 组合来表达失败；缺少稳定的 `code`/`category` 与结构化 `details`，使前端/records-query 定位成本高。

4) **配置语义混合**：路由/供应商/转换链路的职责若不清晰，最终会体现在大量“例外分支”和不可预测的行为上。

## 4. 推荐方案：领域边界先行（稳中求快）

核心策略：**先定边界与契约 → 再迁移实现 → 迁移完成即删除旧逻辑**。

### 4.1 目标分层与职责

- `domain/*`：纯业务决策与纯函数逻辑（不得触碰 HTTP、DB、SSE、fetch）。
- `application/*`：编排（pipeline），负责把领域模块串起来，做最少的 glue。
- `infra/*`：HTTP/DB/SSE/Upstream 等 I/O。

### 4.2 架构示意图（建议落盘）

```
        ┌──────────────────────────┐
        │      interfaces/http      │  (gateway.ts / API 路由适配)
        └─────────────┬────────────┘
                      │
                      ▼
        ┌──────────────────────────┐
        │   application/pipeline    │  (固定步骤编排 + finally 收尾)
        └───────┬───────────┬──────┘
                │           │
                ▼           ▼
     ┌────────────────┐  ┌────────────────┐
     │  domain/routing │  │  domain/rules   │
     └────────────────┘  └────────────────┘
                │           │
                └────┬──────┘
                     ▼
            ┌────────────────┐
            │ domain/transform│   (仅 Claude → Supplier)
            └───────┬────────┘
                    ▼
            ┌────────────────┐
            │  infra/upstream │  (fetch / retry / timeout)
            └───────┬────────┘
                    ▼
            ┌────────────────┐
            │ infra/streaming │  (SSE 生命周期/确定性结束)
            └────────────────┘
```

## 5. 核心契约（建议最终形态）

> 关键原则：**契约尽量少、尽量稳定**。迁移期允许在 ctx 中保留临时字段，但以“最终收敛”为目标。

### 5.1 `InboundRequest`（只读事实）

包含：
- 原始 `method/url/headers/bodyBuffer`
- 解析出的最小摘要：`path`（去掉 `/claude` 前缀后的路径）、`stream`、`model`（若存在）
- 追踪信息：`requestId/sessionId`（复用现有体系）

### 5.2 `RoutePlan`（路由决策结果）

- `supplierId` / `supplierProtocol` / `upstreamBaseUrl`
- `targetModel`（最终上游模型）
- `transformChain`（仅描述 Claude → Supplier 的必要步骤）
- 可选策略位：是否强制流式、是否允许直通、约束来源（配置/默认/规则）

### 5.3 `TransformPlan` / `UpstreamRequest`（执行计划）

- `url/method/headers/body`（规范化上游请求）
- `expectStreaming`（流式语义）
- `responseMapping`（上游事件 → Claude SSE 的映射信息，供 streaming 使用）

### 5.4 `AuditTrail`（可观测性与回溯）

贯穿全程记录：
- `original`（原始请求对象或可序列化摘要）
- `afterRules`（应用规则后的对象）+ `diff`
- `afterTransform`（上游请求形态摘要）
- `upstreamMeta`（耗时/状态码/中断原因）

## 6. 错误模型（领域错误 → HTTP/SSE 映射）

### 6.1 领域错误（不含 HTTP 细节）

建议稳定枚举（示例）：
- `ModelMissing`
- `RouteNotFound`
- `SupplierNotFound` / `SupplierDisabled`
- `RouteConstraintViolation`
- `RuleApplyFailed`
- `TransformUnsupported`（例如非 Claude 入口或不支持方向）
- `UpstreamFailed`

字段建议：
- `code`（稳定）
- `message`（可读）
- `details`（结构化：supplierId、routeId、constraint 等）

### 6.2 接口层映射（统一一个地方做）

在 pipeline 最外层（或专门的 `handleError`）将领域错误映射为：
- HTTP 状态码
- 客户端可见 `safeMessage`
- `errorId`（短 id，写入日志、records，便于追踪）

关键约束：**无论何种错误，流式输出必须确定性结束**（发送 stop/关闭连接/写回终止事件，策略由 streaming 层统一实现）。

## 7. “一次破坏性调整”的建议落点：配置收敛

最值得破坏一次的点是配置，因为它决定后续代码的边界是否清晰。

建议收敛规则：
- `routes[]`：只负责 inbound 匹配与选择 `supplierId`（及必要的约束），不夹带转换细节。
- `suppliers[]`：声明上游能力（protocol/baseUrl/auth/启用状态/模型映射规则）。
- `transform`：只描述 **Claude → Supplier** 的转换链路，不出现 Supplier → Claude 或 Supplier ↔ Supplier。

可选（若需要更小破坏面）：保留旧字段但在启动时一次性 normalize 为新结构；并在 UI/records-query 中展示 normalize 后结构（减少心智负担）。

## 8. 迁移策略（分批次、机械化、可回滚）

1) **契约冻结（无行为变化）**
- 引入/固化 `InboundRequest/RoutePlan/UpstreamRequest/AuditTrail/Error`。
- pipeline steps 开始只通过契约对象交互。

2) **迁移 routing（低风险、收益高）**
- 将 route/supplier/model mapping 决策集中到 `domain/routing`。
- 以测试锁定行为（输入摘要 → RoutePlan）。

3) **迁移 rules + audit（可观测性增强）**
- 规则输出固定为 `{ mutated, diff, appliedRules }`。
- 防止重复应用规则：策略点单一化（例如只在某一步做）。

4) **迁移 transform + upstream + streaming（风险最高，最后做）**
- transform 严格限制为 Claude → Supplier。
- upstream/streaming 统一负责中断、超时、SSE 生命周期。

每迁移完成一个步骤：删旧逻辑，避免长期双实现。

## 9. 测试策略（稳定性优先）

- 领域层单测优先：`routing`、`rules`、`transform` 均应可在无网络环境下测试。
- 流式解析（SSE parse/to-claude）使用 golden tests（固定输入事件序列 → 固定输出事件序列）。
- 少量关键路径集成测试（可选）：起 mock upstream 覆盖 3 个主分支（健康检查 / Claude 跨协议流式 / 非 Claude 透传）。

## 10. 风险与缓解

- 风险：迁移期产生新的耦合与临时字段堆积
  - 缓解：每批次完成后进行一次“字段清理”，把临时 ctx 字段收敛回契约。
- 风险：流式边界回归（挂起、不结束、落库不一致）
  - 缓解：streaming 层统一收尾；为 start/delta/stop 序列加最小集成测试。

## 11. 与现有设计稿的关系

- `docs/plans/2026-01-31-gateway-pipeline-design.md`：主线是 pipeline 化，本稿在其基础上强化“领域边界与契约”，减少 pipeline 步骤中夹杂的业务决策。
- `docs/plans/2026-01-31-gateway-modularization-design.md`：主线是模块化拆分，本稿补充“允许一次破坏性调整时，最佳落点是配置收敛”，并给出更明确的契约与错误模型方向。
