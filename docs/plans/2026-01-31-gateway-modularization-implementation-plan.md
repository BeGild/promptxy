# Gateway Modularization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `backend/src/promptxy/gateway.ts` 以“渐进式、可回滚、行为不变”为原则拆分为业务语义模块 `Routing / Transform / Proxying / Streaming`，并建立核心契约与测试护栏。

**Architecture:** 先引入最小契约（RequestContext/RoutePlan）与薄适配层，再逐步迁移实现；每一阶段只迁移一个边界，并以单测/集成验证锁定行为。

**Tech Stack:** Node.js + TypeScript；后端测试使用 Vitest（`backend/vitest.config.ts`、`backend/vitest.integration.config.ts`）；现有 transformer/records-query 测试目录为 `backend/tests/*`。

---

## 0. 前置约束（必须遵守）

- **任何代码修改前必须方案 review 通过**：本计划文档需先评审通过后再进入执行阶段。
- **渐进式拆分**：每个 Task 只做一个小动作（2–5 分钟级别），确保可回滚。
- **行为不变优先**：默认不改变对外 API、状态码、SSE 事件语义与 headers 策略；如需变更必须单独列出并评审。

---

## Task 1: 建立重构护栏（最小测试与样例固化）

**Files:**
- Modify: `backend/tests/unit`（新增测试文件）
- Modify: `backend/tests/integration`（新增最小集成测试或脚本式用例）

**Step 1: 盘点现有测试入口与运行命令**
Run: `npm -w backend test -- --help || true`
Expected: 输出 vitest 使用帮助或 npm script 信息

**Step 2: 找到现有 gateway 相关测试（若有）并记录模式**
Run: `ls -la backend/tests/unit backend/tests/integration`
Expected: 能看到既有测试组织方式（命名、mock 方式）

**Step 3: 写一个“路由决策不变”的单元测试（先失败）**
Test file (create): `backend/tests/unit/gateway-routing-compat.test.ts`

Minimal test skeleton（按现有测试风格微调）：
```ts
import { describe, it, expect } from "vitest";

// 这里先只断言：未来抽出的 Routing 产物和旧逻辑一致。
// 在实现前先占位，确保后续拆分有护栏。

describe("gateway routing compat", () => {
  it("produces stable route decisions for representative cases", async () => {
    expect(true).toBe(false);
  });
});
```

**Step 4: 运行测试确认失败**
Run: `npm -w backend test -- backend/tests/unit/gateway-routing-compat.test.ts`
Expected: FAIL（占位断言失败）

**Step 5: 提交（仅测试护栏占位）**
```bash
git add backend/tests/unit/gateway-routing-compat.test.ts
git commit -m "测试：新增网关路由兼容性护栏（占位）"
```

---

## Task 2: 引入最小契约（RequestContext / RoutePlan）

**Files:**
- Create: `backend/src/promptxy/gateway-contracts.ts`
- Modify: `backend/src/promptxy/types.ts`（如需复用或导出类型）

**Step 1: 写一个类型层单测（先失败）**
Test file (create): `backend/tests/unit/gateway-contracts.test.ts`

```ts
import { describe, it, expect } from "vitest";
import type { RequestContext, RoutePlan } from "../../src/promptxy/gateway-contracts";

describe("gateway contracts", () => {
  it("RequestContext/RoutePlan types are importable", () => {
    const x: RequestContext | RoutePlan | null = null;
    expect(x).toBe(null);
  });
});
```

**Step 2: 运行测试确认失败（找不到模块）**
Run: `npm -w backend test -- backend/tests/unit/gateway-contracts.test.ts`
Expected: FAIL（module not found）

**Step 3: 写最小实现（只定义类型，不改行为）**
Create `backend/src/promptxy/gateway-contracts.ts`：
```ts
export type RequestContext = {
  requestId?: string;
  sessionId?: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  // 最小摘要：后续按需要扩展，但避免塞入协议细节
  bodySummary?: {
    model?: string;
    stream?: boolean;
  };
};

export type RoutePlan = {
  localService: string;
  supplier: string;
  supplierProtocol: string;
  targetModel: string;
  transformer?: string; // none/registry key
  flags?: {
    allowPassthrough?: boolean;
    forceStream?: boolean;
  };
};
```

**Step 4: 运行测试确认通过**
Run: `npm -w backend test -- backend/tests/unit/gateway-contracts.test.ts`
Expected: PASS

**Step 5: 提交**
```bash
git add backend/src/promptxy/gateway-contracts.ts backend/tests/unit/gateway-contracts.test.ts
git commit -m "重构：引入网关最小契约 RequestContext/RoutePlan"
```

---

## Task 3: 抽出 Routing（只搬运纯逻辑，保持 gateway.ts 入口不变）

**Files:**
- Create: `backend/src/promptxy/routing/index.ts`
- Create: `backend/src/promptxy/routing/derive-route-plan.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Modify: `backend/tests/unit/gateway-routing-compat.test.ts`

**Step 1: 补全 Task1 的单测用例数据（先让它表达需求）**
在 `backend/tests/unit/gateway-routing-compat.test.ts` 中：
- 定义 3–5 个 representative cases（至少覆盖：/claude + 不同 supplierProtocol + 有/无 transformer）
- 每个 case 期望输出的关键字段：supplier/supplierProtocol/targetModel/transformer

先保留失败：`expect(true).toBe(false)` 替换为更具体断言（但此时 routing 还没实现，仍应 FAIL）。

**Step 2: 运行测试确认失败**
Run: `npm -w backend test -- backend/tests/unit/gateway-routing-compat.test.ts`
Expected: FAIL

**Step 3: 在 routing 模块中实现 `deriveRoutePlan(ctx)`（最小可用）**
Create `backend/src/promptxy/routing/derive-route-plan.ts`：
- 输入：`RequestContext` +（必要的）配置/映射对象（通过参数注入，避免 routing 内部读全局）
- 输出：`RoutePlan`
- 仅迁移 gateway.ts 中“纯决策逻辑”，禁止网络 I/O

Create `backend/src/promptxy/routing/index.ts` re-export。

**Step 4: 在 gateway.ts 中接入 routing（保持现有行为路径）**
Modify `backend/src/promptxy/gateway.ts`：
- 在原本的路由决策位置，先构造 `RequestContext`，调用 `deriveRoutePlan`。
- 先以“对照模式”运行：保留旧逻辑产物 `legacyRoute`，并在开发模式下（或仅测试中）断言新旧一致。
  - 注意：对外响应不可变，差异只写日志，不影响用户请求。

**Step 5: 更新单测，让它通过**
`backend/tests/unit/gateway-routing-compat.test.ts` 改为直接测 `deriveRoutePlan` 输出是否符合期望（不依赖 gateway.ts 巨文件）。

**Step 6: 运行测试确认通过**
Run: `npm -w backend test -- backend/tests/unit/gateway-routing-compat.test.ts`
Expected: PASS

**Step 7: 提交**
```bash
git add backend/src/promptxy/routing backend/src/promptxy/gateway.ts backend/tests/unit/gateway-routing-compat.test.ts
git commit -m "重构：抽出 Routing 模块并保持路由决策一致"
```

---

## Task 4: 抽出 Transform（只迁移“协议映射/转换选择”，不改转换实现）

**Files:**
- Create: `backend/src/promptxy/transform/index.ts`
- Create: `backend/src/promptxy/transform/derive-transform-plan.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/unit/transform-plan.test.ts`

**Step 1: 写 failing test（TransformPlan 可导入且对关键 case 输出稳定）**
Create `backend/tests/unit/transform-plan.test.ts`（先断言 module not found / 未实现）。

**Step 2: 运行测试确认失败**
Run: `npm -w backend test -- backend/tests/unit/transform-plan.test.ts`
Expected: FAIL

**Step 3: 写最小实现 `deriveTransformPlan(routePlan, ctx)`**
- 输出 transformer key、上游协议类型需要的最小信息
- 不在此处改现有 transformer 目录结构（`backend/src/promptxy/transformers/*` 保持不动）

**Step 4: 在 gateway.ts 接入 TransformPlan**
- 只替换“选择 transformer 的逻辑”，调用现有 transformers registry/engine

**Step 5: 运行测试确认通过**
Run: `npm -w backend test -- backend/tests/unit/transform-plan.test.ts`
Expected: PASS

**Step 6: 提交**
```bash
git add backend/src/promptxy/transform backend/src/promptxy/gateway.ts backend/tests/unit/transform-plan.test.ts
git commit -m "重构：抽出 Transform 选择逻辑并锁定行为"
```

---

## Task 5: 抽出 Proxying（上游请求执行边界）

**Files:**
- Create: `backend/src/promptxy/proxying/index.ts`
- Create: `backend/src/promptxy/proxying/execute-upstream.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/integration/gateway-proxying-smoke.test.ts`

**Step 1: 写一个最小集成测试（先失败）**
- 复用 `backend/mock-upstream.js` 或既有 integration 测试模式
- 目标：对一个代表性请求，能跑通“发起上游请求并拿到响应/事件”

**Step 2: 运行集成测试确认失败**
Run: `npm -w backend test:integration -- backend/tests/integration/gateway-proxying-smoke.test.ts || npm -w backend test --config backend/vitest.integration.config.ts -- backend/tests/integration/gateway-proxying-smoke.test.ts`
Expected: FAIL

**Step 3: 实现 `executeUpstream(plan)`（最小封装现有实现）**
- 仅把 gateway.ts 中与 fetch/请求发送相关的逻辑抽出
- 保持 headers/timeout 策略不变

**Step 4: gateway.ts 切换到调用 executeUpstream**

**Step 5: 运行集成测试确认通过**
Expected: PASS

**Step 6: 提交**
```bash
git add backend/src/promptxy/proxying backend/src/promptxy/gateway.ts backend/tests/integration/gateway-proxying-smoke.test.ts
git commit -m "重构：抽出 Proxying 执行边界并通过集成验证"
```

---

## Task 6: 抽出 Streaming（SSE 生命周期与确定性结束）

**Files:**
- Create: `backend/src/promptxy/streaming/index.ts`
- Create: `backend/src/promptxy/streaming/stream-response.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/integration/gateway-streaming-termination.test.ts`

**Step 1: 写 failing 集成测试：流式请求必须结束**
- 用一个可控的 mock upstream：发送若干事件后主动结束
- 断言：客户端在合理时间内收到结束信号并关闭（具体断言按现有 SSE 工具函数/测试模式）

**Step 2: 运行集成测试确认失败**
Run: 同 Task 5 的 integration 运行方式
Expected: FAIL

**Step 3: 实现 `streamResponse()`（最小封装现有 SSE 写回）**
- 迁移 gateway.ts 中 SSE 写回逻辑
- 统一 abort/异常路径的“确定性结束”行为（不改变对外语义，只保证一定会结束）

**Step 4: gateway.ts 接入 streamResponse**

**Step 5: 运行集成测试确认通过**
Expected: PASS

**Step 6: 提交**
```bash
git add backend/src/promptxy/streaming backend/src/promptxy/gateway.ts backend/tests/integration/gateway-streaming-termination.test.ts
git commit -m "重构：抽出 Streaming 并保证流式请求确定性结束"
```

---

## Task 7: 收尾与清理

**Files:**
- Modify: `backend/src/promptxy/gateway.ts`
- Modify: `docs/architecture.md`（若已有网关章节，可补一句模块边界；可选）

**Step 1: 删除临时对照/开发断言（若有）**

**Step 2: 运行后端 unit + integration 测试**
Run: `npm -w backend test`
Run: `npm -w backend test --config backend/vitest.integration.config.ts`
Expected: 全部 PASS

**Step 3: 提交**
```bash
git add backend/src/promptxy/gateway.ts docs/architecture.md
git commit -m "重构：清理网关模块化过渡代码并补充架构说明"
```

---

## 执行前的 Review Checklist（给方案评审用）

- [ ] 是否明确“行为不变”的范围与例外处理方式
- [ ] 是否为 Routing/Streaming 的关键风险点提供了测试护栏
- [ ] 是否通过参数注入避免 routing 读取全局状态，确保可单测
- [ ] 是否确保任何错误路径都能被 Streaming 正确收尾
- [ ] 是否每个阶段都可以独立回滚（git commit 粒度足够小）
