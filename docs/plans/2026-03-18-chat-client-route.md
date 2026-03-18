# Chat Client Route Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为当前项目新增 `/chat` 本地客户端入口，透明代理到 `openai-chat` 类型 supplier，并确保请求可在详情页查看。

**Architecture:** 在现有 route/config/gateway 主链路中增加新的 `chat` localService，行为对齐 `codex`：单 supplier、无 transformer、无模型映射。前后端只补齐类型、路由校验、UI 入口和请求展示映射，不引入 OpenAI Chat 协议级转换。

**Tech Stack:** TypeScript, Node.js HTTP server, React, Vitest

---

### Task 1: 后端类型与路由校验

**Files:**
- Modify: `backend/src/promptxy/types.ts`
- Modify: `backend/src/promptxy/api-handlers.ts`
- Test: `backend/tests/unit/gateway-pipeline-resolve-route.test.ts`

**Step 1: 写失败测试**
为 `chat` 路由解析和 supplier 协议校验补测试。

**Step 2: 运行测试确认失败**
Run: `npm test -- --run backend/tests/unit/gateway-pipeline-resolve-route.test.ts`
Expected: FAIL，缺少 `chat` localService 支持或校验不通过。

**Step 3: 写最小实现**
- 扩展 `PromptxyClient` / `LocalService`
- 为 `chat` 增加 `openai-chat` 协议校验
- 保持 transformer 为 `none`

**Step 4: 运行测试确认通过**
Run: `npm test -- --run backend/tests/unit/gateway-pipeline-resolve-route.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/promptxy/types.ts backend/src/promptxy/api-handlers.ts backend/tests/unit/gateway-pipeline-resolve-route.test.ts
git commit -m "feat: 增加 chat 本地路由的后端校验与解析"
```

### Task 2: 网关透明代理与记录链路

**Files:**
- Modify: `backend/src/promptxy/gateway.ts`
- Modify: `backend/src/main.ts`
- Modify: `backend/src/cli-entry.ts`
- Test: `backend/tests/unit/gateway-pipeline-resolve-route.test.ts`

**Step 1: 写失败测试**
补 `/chat/v1/*` 的路径前缀解析与 client 标识测试。

**Step 2: 运行测试确认失败**
Run: `npm test -- --run backend/tests/unit/gateway-pipeline-resolve-route.test.ts`
Expected: FAIL，日志/路由名或路径识别未覆盖 `/chat`。

**Step 3: 写最小实现**
- 启动日志加入 `/chat/*`
- 路由名称补 `Chat 路由`
- 确保 `/chat` 前缀被剥离后透明转发

**Step 4: 运行测试确认通过**
Run: `npm test -- --run backend/tests/unit/gateway-pipeline-resolve-route.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/promptxy/gateway.ts backend/src/main.ts backend/src/cli-entry.ts backend/tests/unit/gateway-pipeline-resolve-route.test.ts
git commit -m "feat: 打通 chat 本地入口的透明代理链路"
```

### Task 3: 前端路由配置与状态展示

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/types/rule.ts`
- Modify: `frontend/src/hooks/useSuppliers.ts`
- Modify: `frontend/src/hooks/useConfigStatus.ts`
- Modify: `frontend/src/pages/RouteConfigPage.tsx`
- Modify: `frontend/src/pages/SupplierManagementPage.tsx`
- Modify: `frontend/src/utils/*`（若 client 文案映射在该目录）
- Test: `frontend/tests/unit/utils.test.ts`
- Test: `frontend/tests/unit/hooks.test.tsx`
- Test: `frontend/tests/integration/pages.test.tsx`

**Step 1: 写失败测试**
补 `chat` client 文案、配置状态、路由配置入口测试。

**Step 2: 运行测试确认失败**
Run: `npm run test:frontend -- --run frontend/tests/unit/utils.test.ts frontend/tests/unit/hooks.test.tsx frontend/tests/integration/pages.test.tsx`
Expected: FAIL，缺少 `/chat` 枚举和展示。

**Step 3: 写最小实现**
- 前端类型增加 `chat`
- 新增 `/chat` 路由配置选项和状态显示
- 请求详情相关 client 标签补 `chat`

**Step 4: 运行测试确认通过**
Run: `npm run test:frontend -- --run frontend/tests/unit/utils.test.ts frontend/tests/unit/hooks.test.tsx frontend/tests/integration/pages.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add frontend/src/types/api.ts frontend/src/types/rule.ts frontend/src/hooks/useSuppliers.ts frontend/src/hooks/useConfigStatus.ts frontend/src/pages/RouteConfigPage.tsx frontend/src/pages/SupplierManagementPage.tsx frontend/tests/unit/utils.test.ts frontend/tests/unit/hooks.test.tsx frontend/tests/integration/pages.test.tsx
git commit -m "feat: 增加 chat 路由配置与前端展示"
```

### Task 4: 端到端验证

**Files:**
- Modify: `README.md`
- Optional Test/Docs: `docs/usage.md`

**Step 1: 启动开发环境**
Run: `./scripts/dev.sh &`
Expected: 后端和前端启动成功。

**Step 2: 手工验证**
- 配置一个 `chat` route 指向 `openai-chat` supplier
- 请求 `/chat/v1/chat/completions`
- 确认请求详情中能看到 `chat` 请求、路径、请求体和响应体

**Step 3: 补文档**
更新 README 中 CLI 配置和代理路由描述，加入 `/chat`。

**Step 4: 运行关键测试**
Run: `npm test && npm run test:frontend`
Expected: PASS

**Step 5: Commit**
```bash
git add README.md docs/usage.md
git commit -m "docs: 补充 chat 客户端入口使用说明"
```
