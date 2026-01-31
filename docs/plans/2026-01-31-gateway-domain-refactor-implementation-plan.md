# Gateway Domain Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不扩展协议支持范围（仅 `/claude -> 任意供应商`）的前提下，收敛 `routes` 配置（唯一破坏点），并以现有 `gateway-pipeline` 为主线逐步将 routing/rules/streaming 关键路径“契约化 + 单点化”，提升可维护性与稳定性。

**Architecture:** 先用测试锁定行为（TDD），再做最小实现改动；每个阶段都可回滚。破坏性调整只发生在 `routes` schema：严格禁止 legacy/互斥字段，迁移只做一次且失败可定位。

**Tech Stack:** TypeScript (Node.js), Vitest (`backend/vitest.config.ts`), 现有 gateway-pipeline/transformers/streaming 模块。

---

## Scope & Success Criteria

### Must
1) `routes` 配置收敛生效：
   - `localService='claude'` 只允许 `modelMappings`，禁止 `singleSupplierId/defaultSupplierId/supplierId/modelMapping/transformer` 等 legacy/互斥字段。
   - `localService='codex'|'gemini'` 只允许 `singleSupplierId`，禁止 `modelMappings/defaultSupplierId/supplierId/modelMapping`。
   - 错误信息必须包含字段路径（如 `config.routes[0].modelMapping`）。

2) routing 决策不漂移：同一输入下，pipeline 与网关得到一致的 route/supplier/model/transform 推断（由 compat 测试锁定）。

3) 规则只应用一次：Claude 跨协议路径中，非幂等规则不会重复生效。

4) SSE 确定性结束：abort / upstream 提前断开时客户端连接必须结束，且 record 可定位 error。

### Non-goals
- 不新增协议与客户端方向支持（不做 `/codex`、`/gemini` 的跨协议转换）。
- 不进行大规模目录重排；本计划聚焦“边界/契约/一致性”与 routes 破坏性收敛。

---

## Task 1: 为 routes 破坏性收敛添加失败用例（claude route 禁止 legacy 字段）

**Files:**
- Test: `backend/tests/unit/config.test.ts`
- Modify: `backend/src/promptxy/config.ts`

**Step 1: Write the failing test**

在 `backend/tests/unit/config.test.ts` 增加用例：构造一个含 `routes[].modelMapping` 或 `routes[].supplierId/defaultSupplierId` 的输入配置，并断言 `loadConfig()` 抛错且 message 含字段名。

（示意）
```ts
import { it, expect } from 'vitest';
import { loadConfig } from '../../src/promptxy/config.js';

it('rejects legacy route fields for claude route', async () => {
  // arrange: write temp promptxy.config.json in a temp dir + chdir
  // act: await loadConfig()
  // assert: rejects.toThrow(/config\.routes\[0\]\.modelMapping/)
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --root backend -- tests/unit/config.test.ts`
Expected: FAIL（当前可能会静默迁移/删除，不报错）

**Step 3: Write minimal implementation**

在 `backend/src/promptxy/config.ts` 做最小改动：
- `migrateRoutes()` 之后、或 `assertConfig()` 内增加严格检查：
  - 如 route 对象仍带 legacy 字段，直接抛错，错误信息指向具体路径。

**Step 4: Run test to verify it passes**

Run: `npm test -- --root backend -- tests/unit/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/promptxy/config.ts backend/tests/unit/config.test.ts

git commit -m "fix：收敛 routes 配置并拒绝 legacy 字段（破坏性升级）"
```

---

## Task 2: 补齐 routes 互斥/必填组合约束测试（claude/codex/gemini）

**Files:**
- Test: `backend/tests/unit/config.test.ts`
- Modify: `backend/src/promptxy/config.ts`

**Step 1: Write the failing test**

新增用例覆盖：
- `codex` route 存在 `modelMappings` → 报错
- `codex` route 缺 `singleSupplierId` → 报错
- `claude` route 误配 `singleSupplierId` → 报错

**Step 2: Run test to verify it fails**

Run: `npm test -- --root backend -- tests/unit/config.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

在 `backend/src/promptxy/config.ts` 的 routes 校验段补齐：
- “禁止字段存在即报错”
- “必填字段缺失即报错”

**Step 4: Run test to verify it passes**

Run: `npm test -- --root backend -- tests/unit/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/promptxy/config.ts backend/tests/unit/config.test.ts

git commit -m "test：补齐 routes 字段互斥与必填约束用例"
```

---

## Task 3: routing 决策唯一权威化到 derive-route-plan（降低漂移风险）

**Files:**
- Modify: `backend/src/promptxy/gateway.ts`
- Modify: `backend/src/promptxy/gateway-pipeline/steps/resolve-route.ts`
- (Maybe) Modify: `backend/src/promptxy/routing/derive-route-plan.ts`
- Test: `backend/tests/unit/gateway-routing-compat.test.ts`
- (Maybe) Test: `backend/tests/unit/gateway-pipeline-resolve-route.test.ts`

**Step 1: Write the failing test**

在 `backend/tests/unit/gateway-routing-compat.test.ts` 增强用例：
- 给定最小输入（path/model/stream + config），断言 gateway 与 pipeline 的 resolve-route 输出一致（supplierId/targetModel/transformer 推断）。

**Step 2: Run test to verify it fails**

Run: `npm test -- --root backend -- tests/unit/gateway-routing-compat.test.ts`
Expected: FAIL（若存在重复逻辑导致差异）

**Step 3: Write minimal implementation**

- 保留 `derive-route-plan` 为唯一决策函数。
- `gateway.ts` 和 `gateway-pipeline/steps/resolve-route.ts` 变为薄适配：解析输入 → 调用 derive → 写回结果。

**Step 4: Run test to verify it passes**

Run: `npm test -- --root backend -- tests/unit/gateway-routing-compat.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/promptxy/gateway.ts backend/src/promptxy/gateway-pipeline/steps/resolve-route.ts backend/src/promptxy/routing/derive-route-plan.ts backend/tests/unit/gateway-routing-compat.test.ts

git commit -m "refactor：统一路由决策来源为 derive-route-plan，降低漂移风险"
```

---

## Task 4: 规则应用策略单点化（确保只 apply 一次）

**Files:**
- Modify: `backend/src/promptxy/gateway-pipeline/steps/apply-rules.ts`
- (Maybe) Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/integration/gateway-rules-apply-once.test.ts`
- (Maybe) Test: `backend/tests/unit/gateway-pipeline-apply-rules.test.ts`

**Step 1: Write the failing test**

在 `gateway-rules-apply-once` 中使用非幂等规则（append），构造 Claude 跨协议路径，断言只 append 一次。

**Step 2: Run test to verify it fails**

Run: `npm test -- --root backend -- tests/integration/gateway-rules-apply-once.test.ts`
Expected: FAIL（若仍重复 apply）

**Step 3: Write minimal implementation**

- 只允许在一个步骤中应用规则（推荐 pipeline 的 apply-rules）。
- 明确跳过策略（例如：已转换到上游协议后不再二次改写）。

**Step 4: Run test to verify it passes**

Run: `npm test -- --root backend -- tests/integration/gateway-rules-apply-once.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/promptxy/gateway-pipeline/steps/apply-rules.ts backend/src/promptxy/gateway.ts backend/tests/integration/gateway-rules-apply-once.test.ts

git commit -m "fix：规则应用策略单点化，避免请求被二次改写"
```

---

## Task 5: SSE 生命周期异常收尾一致性（确定性结束）

**Files:**
- Test: `backend/tests/integration/sse-abort.test.ts`
- Test: `backend/tests/integration/sse-upstream-premature-close.test.ts`
- (Maybe) Modify: `backend/src/promptxy/streaming/stream-response.ts`
- (Maybe) Modify: `backend/src/promptxy/gateway-pipeline/steps/handle-response.ts`

**Step 1: Write the failing test**

补充断言：abort/premature close 场景下客户端连接必须结束，且 record 的 `error` 字段可定位。

**Step 2: Run test to verify it fails**

Run: `npm test -- --root backend -- tests/integration/sse-abort.test.ts`
Expected: FAIL（若存在挂起/未收尾）

**Step 3: Write minimal implementation**

- 将异常收尾集中到 streaming/handle-response 的单一出口。
- 不改协议转换内容，仅保证连接生命周期正确。

**Step 4: Run test to verify it passes**

Run: `npm test -- --root backend -- tests/integration/sse-abort.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/promptxy/streaming/stream-response.ts backend/src/promptxy/gateway-pipeline/steps/handle-response.ts backend/tests/integration/sse-abort.test.ts backend/tests/integration/sse-upstream-premature-close.test.ts

git commit -m "fix：统一 SSE 异常收尾，保证流式确定性结束"
```

---

## Task 6: 回归验证（测试 + 构建 + 本地启动）

**Files:**
- None

**Step 1: Run backend tests**

Run: `npm test -- --root backend`
Expected: PASS

**Step 2: Build**

Run: `npm run build`
Expected: PASS

**Step 3: Manual dev smoke (按项目约定后台启动)**

Run: `./scripts/dev.sh &`
- 手动验证：
  - routes legacy 配置会明确报错
  - Claude 跨协议规则不重复
  - SSE abort/premature close 不挂起

**Step 4: Stop dev**

- 关闭后台 dev 进程（按脚本输出/进程管理方式）。

---

## Rollback Strategy

- routes 收敛回滚：将“遇到 legacy 字段即报错”临时降级为“警告 + 自动迁移”（仅需调整 `backend/src/promptxy/config.ts`）。
- routing 唯一权威回滚：在入口处临时切回旧决策路径（短期救火），但必须保留 compat 测试作为 guard。
- rules 单点化回滚：恢复旧路径（不建议长期），并明确跳过/更新 apply-once 测试。
- SSE 收尾回滚：回到旧处理，但需保留新增断言以避免再次引入挂起。
