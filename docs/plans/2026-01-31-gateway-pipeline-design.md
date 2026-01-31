# 网关 RequestPipeline（中等重构）设计稿

> 主题：将 `backend/src/promptxy/gateway.ts` 从“单文件业务巨石”重构为可测试、可演进的 RequestPipeline（解析 → 鉴权 → 路由计划 → 规则 → 协议转换 → 上游执行 → 流式写回 → 记录/广播）。
>
> 约束：保持外部行为与现有 API/配置格式不变；遵循项目关键决策：转换器只需支持 `/claude -> 任意供应商`。

## 1. 背景与现状问题（批判性 review）

当前实现的关键痛点主要集中在 **可维护性与边界不清**：

- `backend/src/promptxy/gateway.ts` 承担了过多职责：API 路由、静态文件、入站鉴权、请求解析、路由选择、规则应用、协议转换、上游请求执行、SSE/流式转换、落库、SSE 广播。
- 路由/计划体系存在重复与分叉风险：文件内有 `resolveRouteByPath/resolveSupplierByModel`，同时又有 `deriveRoutePlan`（`backend/src/promptxy/routing/*`）。长期会导致“显示/日志上的 plan”与“实际执行路径”不一致。
- 规则应用的条件分支复杂：为了避免 Claude→跨协议场景重复应用规则，当前在多个分支里分别 mutate（Claude/Codex/Gemini），读者难以推断“规则到底在哪层生效”。
- 流式/SSE 的终止/异常/落库逻辑分散：例如 `gateway.ts` 内部的 expected termination 判断，与 `backend/src/promptxy/streaming/stream-response.ts` 中的处理同时存在，未来容易出现边界行为不一致。

结论：目前功能可用，但结构会持续放大回归风险与开发成本。

## 2. 目标 / 非目标

### 2.1 目标

- 把一次请求的处理过程显式化为可组合的步骤（RequestPipeline），显著降低 `gateway.ts` 的认知负担。
- 统一“路由计划/转换计划”的来源与落地，避免并行实现长期漂移。
- 统一错误模型与收尾逻辑，保证流式场景可确定性结束，并且记录/广播行为一致。
- 提升可测试性：让关键分支可以在不启动 HTTP server、不打真实上游的情况下覆盖。

### 2.2 非目标

- 不引入新的客户端协议支持（不扩展 `/codex` 或 `/gemini` 的跨协议能力）。
- 不改变外部接口：`/_promptxy/*` API、`/claude/*`、`/codex/*`、`/gemini/*` 的行为与配置结构保持不变。
- 不在本轮强行做性能优化；结构稳定后再做更合适。

## 3. 方案选型（含取舍）

### 方案 A：只拆文件（最小侵入）
- 做法：把 `gateway.ts` 中的函数按职责搬到多个文件。
- 优点：改动小、容易落地。
- 缺点：流程仍是“长函数 + if/else 分支”，可测试性与边界一致性改善有限。

### 方案 B：RequestPipeline（中等重构，推荐）
- 做法：引入显式 `GatewayContext` 与 `runPipeline()`，把处理分成固定步骤；`gateway.ts` 只负责 HTTP 适配与调用 pipeline。
- 优点：
  - 每一步可单测
  - 错误与收尾可统一
  - 未来扩展更可控（新增策略或供应商行为可落在单步模块中）
- 缺点：需要一次性引入新的组织结构与内部契约。

### 方案 C：深度分层（Domain/Infra）
- 做法：彻底形成 domain（RoutePlan/TransformPlan）+ infra（http/db/stream）分层，系统性重构。
- 优点：长期最干净。
- 缺点：改动面大、回归风险高，不适合当前节奏。

结论：选择 **方案 B**。并且以“分 3 个阶段、小步迁移、每步可回滚”的方式实施。

## 4. 目标架构：RequestPipeline 概览

建议形成如下处理链路（顺序固定，便于定位与测试）：

1) `parseRequest`：读取 body、决定是否 JSON、构建摘要
2) `authInbound`：网关入站鉴权、清理鉴权头
3) `resolveRoutePlan`：从请求摘要得到唯一的 RoutePlan，并派生 RouteInfo（supplier、upstreamPath 等）
4) `applyRules`：以单点策略决定是否/如何应用规则（避免重复应用）
5) `transformRequest`：仅在 Claude 跨协议时调用 transformer
6) `executeUpstream`：构造并发送上游请求（abort/close 边界集中处理）
7) `handleResponse`：决定透传或 SSE 转换，并写回
8) `finalizeRecordAndBroadcast`：统一落库与 SSE 广播（无论成功/失败/中断）

## 5. 模块拆分与接口建议

建议新增目录：`backend/src/promptxy/gateway-pipeline/`（命名可讨论，但建议显式表达“网关处理流水线”）。

### 5.1 `context.ts`

- `GatewayContext`（贯穿全链路的可变上下文）
  - request：`req/res`、解析后的 `url/method`
  - headers：`originalRequestHeaders`（清理后/转换前）、`finalRequestHeaders`（转换后/认证注入后）
  - body：`bodyBuffer`、`jsonBody`、`originalBodyBuffer`（用于记录与 token 兜底）
  - planning：`routeMatch/routePlan/transformPlan`（最终只保留一个来源）
  - effects：`matches/warnings`、`transformTrace`、`transformerChain`、`shortNameMap`
  - upstream：`upstreamUrl`、`upstreamResponse`、`shouldTransformSSE`、`estimatedInputTokens`
  - recording：记录草稿/响应 chunk 收集器/最终 record

- `GatewayError`
  - `category`：`Parse | Auth | Routing | Rules | Transform | Proxying | Streaming | Recording`
  - `code/status/message/meta`：用于稳定定位与对外错误响应

### 5.2 `pipeline.ts`

- `runPipeline(ctx): Promise<GatewayContext>`
  - 负责串行执行 step
  - 在 `finally` 确保调用 `finalizeRecordAndBroadcast(ctx, err)`

### 5.3 `steps/*.ts`

每个 step 文件只做一件事，避免“万能 util”。推荐：

- `steps/parse-request.ts`
- `steps/auth.ts`
- `steps/resolve-route.ts`
- `steps/apply-rules.ts`
- `steps/transform-request.ts`
- `steps/execute-upstream.ts`
- `steps/handle-response.ts`

### 5.4 `recording.ts`

把当前“非流式立即落库”与“流式结束后 finalize 落库”的两套代码收敛为同一 API：

- `recordInit(ctx)`：准备 requestId、创建 chunk 收集器、写入广播
- `recordFinalize(ctx, err)`：根据最终结果组装 `RequestRecord` 并落库

## 6. 迁移步骤（3 个可回滚阶段）

### 阶段 1：引入契约与 pipeline 框架（不改行为）

- 新增 `GatewayContext/GatewayError` 与 `runPipeline` 空壳。
- `gateway.ts` 仍保留原逻辑，但把关键变量逐步归拢到 ctx。
- 验收：功能与记录字段不变。

### 阶段 2：逐步搬运步骤（剪切+薄封装）

- 按顺序把 `parse/auth/resolve/execute/response/recording` 迁移到 steps。
- 每搬一步：禁止“顺手优化”，确保 diff 可 review、可回滚。
- 验收：核心路径（Claude 跨协议、Codex/Gemini 透传、API 路由）行为一致。

### 阶段 3：结构稳定后再收敛重复逻辑

- 合并路由计划来源：以 `deriveRoutePlan` 为唯一权威。
- 把“规则应用策略”变成单点决策（例如 `shouldApplyRules(ctx)`），并用单测锁定 Claude 跨协议不重复应用的边界。
- 统一 expected termination 判断，减少重复实现。

## 7. 测试策略（最小可行）

### 7.1 单元测试（优先）

- `steps/resolve-route.ts`：给定最小 request summary（path/model/stream）与配置，断言 `RoutePlan/RouteInfo`。
- `steps/apply-rules.ts`：覆盖 Claude 直连、Claude 跨协议、Codex/Gemini 入口三类规则应用策略。
- `steps/transform-request.ts`：使用 fixture 验证 Claude→Codex/Gemini 请求形状（仅测试转换器调用边界，不打真实上游）。

### 7.2 轻量集成测试（建议）

- 起一个本地 mock upstream server：返回固定 JSON 与固定 SSE。
- 发起三类请求覆盖关键分支：
  - `GET /_promptxy/health`
  - `POST /claude/v1/messages`（跨协议 + SSE）
  - `POST /codex/v1/responses`（透传 + SSE）

## 8. 风险与验收标准

### 8.1 风险

- 旧逻辑与新模块并存阶段易形成新的耦合。
- 流式边界最容易出现隐性回归（客户端挂起、落库不一致）。

### 8.2 缓解

- 每阶段只迁移一个边界，且每次提交保持“外部行为不变”。
- 用单测锁住策略函数（路由/规则/转换开关），用轻量集成覆盖 SSE 生命周期。

### 8.3 最小验收标准

- `gateway.ts` 的“流程逻辑”消失，只剩 HTTP 适配与 pipeline 调度。
- `Routing/Rules/Transform` 的关键分支具备单测。
- SSE 场景无论成功/失败/中断都能确定性结束，并且 request record 结构一致可定位。
