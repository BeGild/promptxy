# 文档对齐 + UI 引导增强 + 删除过期 start.sh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 以“当前实现为准”对齐文档与 UI 引导，降低端口/路由误配率，并删除已过期的 `scripts/start.sh`（不改变核心转发/转换行为）。

**Architecture:** 不改动核心路由匹配与协议转换逻辑，仅做三类改动：1) 文档事实对齐；2) UI 上的默认值/提示/校验增强；3) 网关错误提示更可操作（只改 message 文案，不改错误码/流程）。

**Tech Stack:** Node.js + TypeScript（后端原生 http）、React + Vite + HeroUI（前端）、Vitest（前后端测试）。

---

## 背景（当前实现的关键事实）

- 后端默认端口：`config.listen.port = 0` 时会按用户名 hash 计算并在 `8000-9000` 找可用端口（`backend/src/promptxy/port-utils.ts`、`backend/src/promptxy/config.ts:701`）。
- 生产静态 Web UI：后端在 `GET /` 时返回 `dist/frontend/index.html`（`backend/src/promptxy/gateway.ts:444`）。API 仍是 `/_promptxy/*`。
- Claude 路由：当前没有 `defaultSupplierId` 字段；匹配不到 `modelMappings` 时不会回退（`backend/src/promptxy/gateway.ts:180`），因此必须在 UI/文档中明确“需要兜底规则（例如 `inboundModel = '*'`）”。
- 请求记录：网关会保存 `requestHeaders`（最终请求头）与 `originalRequestHeaders`（清理后、转换前的请求头）（`backend/src/promptxy/gateway.ts:1191`）。若供应商配置了 bearer，会注入 `authorization`（`backend/src/promptxy/gateway.ts:1055`）。

---

## 总体交付物

- 文档：`README.md`、`docs/architecture.md` 对齐端口/入口/路由约束/数据存储事实；移除 `scripts/start.sh` 相关引用。
- 代码：
  - 前端：路由配置页提示“必须有 `*` 兜底规则”、新建 Claude 路由默认预选供应商（减少“空 targetSupplierId”导致的创建失败）。
  - 后端：`route_not_configured` 与 `supplier_unavailable` 的 `message` 更可操作（建议用户去 UI 做什么）。
- 删除：`scripts/start.sh`。
- 测试：为新增 UI 提示与错误 message 的行为补充/更新 Vitest 测试。

---

## 约束与非目标（YAGNI）

- 不引入 `defaultSupplierId` 或任何“未命中规则自动回退”的新行为（这属于行为变更，需另开规格/方案）。
- 不调整核心端口策略（仍保留 `port=0` 哈希分配）；仅把文档/提示对齐。
- 不在本计划内处理“请求头持久化的脱敏/不落盘”能力（这是安全/隐私功能，需单独提案）。本计划仅把事实写清。

---

### Task 0: 建立执行上下文（worktree + 基线验证）

**Files:**
- (No code changes)

**Step 1: 创建独立 worktree**

Run: `git worktree add -b docs-ui-alignment ../promptxy-docs-ui-alignment`
Expected: 输出 worktree 路径，无报错。

**Step 2: 安装依赖（若需要）**

Run: `npm install`
Expected: 依赖安装成功。

**Step 3: 跑一次基线测试（记录现状）**

Run: `npm test`
Expected:
- 理想：全部 PASS。
- 若 FAIL：记录失败用例（不要在本计划外“顺手修”无关问题），后续每一步只保证“我改到的行为”对应测试通过。

**Step 4: Commit（可选）**

不提交（本任务不改代码）。

---

### Task 1: README 文档事实对齐（端口/入口/路由兜底/存储事实）

**Files:**
- Modify: `README.md`

**Step 1: 写一个失败的文档断言测试（可选，若现有测试体系支持）**

如果仓库没有针对文档的校验测试，跳过（YAGNI）。

**Step 2: 修改 README（最小改动）**

在 `README.md` 完成以下对齐：

1) 端口策略：明确默认是 8000-9000（hash），并给出固定端口的推荐用法（例如 `promptxy --port 7070`）。
2) 生产 UI 入口：把“`/_promptxy/` 是 UI”改为“UI 在 `/`，API 在 `/_promptxy/*`”。
3) Claude 路由：删掉/改写 `defaultSupplierId` 描述，改成“未命中规则不回退；必须配置 `inboundModel='*'` 兜底”。
4) 请求记录：把“不存储 API 密钥”改成精确表述（例如“默认会记录请求头用于排错；如配置 bearer/header 认证，可能包含敏感头；请自行评估是否开启/如何清理”）。
5) 历史条数：统一成 `1000`（不要再出现 `100` 的说法）。

**Step 3: 运行 Markdown 快速检查（若有）**

若无 markdown lint，跳过。

**Step 4: Commit**

Run:

```bash
git add README.md
git commit -m "$(cat <<'EOF'
文档：对齐 README 与当前实现行为

- 端口：说明默认为 8000-9000 的哈希端口，并给出固定端口用法
- 入口：明确 Web UI 在 /，API 在 /_promptxy/*
- 路由：移除 defaultSupplierId 叙事，强调 Claude 路由需 * 兜底规则
- 存储：修正“API 密钥不存储”的绝对表述，改为精确事实说明
EOF
)"
```

Expected: commit 成功。

---

### Task 2: docs/architecture.md 同步 + 移除 start.sh 引用

**Files:**
- Modify: `docs/architecture.md`

**Step 1: 写失败测试（跳过）**

文档改动不写测试（YAGNI）。

**Step 2: 更新架构文档**

- 将脚本列表/结构图里 `start.sh` 的描述移除或标注为已删除。
- 在“服务入口/端口/路径”处对齐：UI `/`、API `/_promptxy/*`、代理 `/claude` `/codex` `/gemini`，端口策略与 README 一致。

**Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "$(cat <<'EOF'
文档：更新架构说明并移除 start.sh 引用

- 移除过期的 scripts/start.sh 相关描述
- 对齐 Web UI/API/代理路由入口与端口策略
EOF
)"
```

---

### Task 3: 删除过期脚本 scripts/start.sh + 清理引用

**Files:**
- Delete: `scripts/start.sh`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- (Optional) Modify: `openspec/changes/archive/2025-12-21-add-promptxy-v2-full-stack/tasks.md`（只在你希望归档记录也同步时；默认不改归档）

**Step 1: 写失败测试（跳过）**

脚本删除不写测试。

**Step 2: 删除文件**

Run: `git rm scripts/start.sh`
Expected: 文件被删除并进入 staged。

**Step 3: 清理文档中对 start.sh 的引用**

- `README.md` 的目录结构/脚本说明处删除 `start.sh`。
- `docs/architecture.md` 结构图/脚本列表处删除 `start.sh`。

**Step 4: Commit**

```bash
git add README.md docs/architecture.md
git commit -m "$(cat <<'EOF'
维护：删除过期 scripts/start.sh 并清理文档引用

- 删除 scripts/start.sh（端口与产物路径假设已不符合当前实现）
- 清理 README/docs 中的相关引用，避免误导使用者
EOF
)"
```

---

### Task 4: 前端路由配置页 UX 引导（Claude 路由兜底规则 + 默认预选 supplier）

**Files:**
- Modify: `frontend/src/pages/RouteConfigPage.tsx`
- Test: `frontend/tests/integration/pages.test.tsx` 或新建 `frontend/tests/unit/route-config.test.tsx`

**Step 1: 写失败测试（UI 提示与默认值）**

目标：当创建 Claude 路由时：
- 如果没有任何 `inboundModel === '*'` 的规则，UI 显示显眼提示/警告（不阻塞保存，但强提醒）。
- 新建 Claude 路由初始 `modelMappings` 的 `targetSupplierId` 自动填充为“第一个 enabled supplier”，避免用户一上来就保存失败。

（示意测试，具体以现有测试工具/渲染方式为准）

```ts
it('Claude 路由缺少 * 兜底规则时应提示', async () => {
  // render RouteConfigPage
  // 设置 newRoute.modelMappings 不包含 '*'
  // expect 页面出现“建议添加 inboundModel=\"*\" 兜底”提示
});
```

**Step 2: 运行测试确认失败**

Run: `npm run test:frontend -- frontend/tests/integration/pages.test.tsx`
Expected: FAIL（找不到提示文案或默认值不符合）。

**Step 3: 最小实现**

在 `frontend/src/pages/RouteConfigPage.tsx`：
- 在 Claude 路由编辑区域（ModelMappingEditor 下方或顶部）增加一段说明：
  - “实现为准：未命中 modelMappings 不会回退，请确保存在 `inboundModel='*'` 的兜底规则”。
- 在初始化 `newRoute`（或打开新增 modal 时）把 `targetSupplierId` 默认设置为首个 enabled supplier id。
  - 注意：不要改后端行为，只是 UI 预填字段。

**Step 4: 运行测试确认通过**

Run: `npm run test:frontend -- frontend/tests/integration/pages.test.tsx`
Expected: PASS。

**Step 5: Commit**

```bash
git add frontend/src/pages/RouteConfigPage.tsx frontend/tests/integration/pages.test.tsx
git commit -m "$(cat <<'EOF'
前端：增强 Claude 路由配置引导，降低误配率

- 新建 Claude 路由时默认预选可用供应商，避免 targetSupplierId 为空导致保存失败
- 增加 * 兜底规则提示：未命中 modelMappings 不会回退（以当前实现为准）
EOF
)"
```

---

### Task 5: 网关错误信息可操作化（不改错误码/流程，仅增强 message）

**Files:**
- Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/integration/gateway.test.ts`（或新增一个更小的错误响应测试文件）

**Step 1: 写失败测试（错误 message 包含指引）**

新增/修改测试用例，覆盖两类错误：

1) `route_not_configured`：message 包含“去 UI 的路由配置页启用一个 route”。
2) `supplier_unavailable`：message 包含“Claude 路由请确保存在 inboundModel='*' 的兜底规则，且目标 supplier 已启用”。

（示意）

```ts
it('route_not_configured 应返回可操作提示', async () => {
  const res = await client.post('/claude/v1/messages', { model: 'x', messages: [] });
  expect(res.status).toBe(503);
  expect(res.body.message).toContain('路由配置');
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- backend/tests/integration/gateway.test.ts`
Expected: FAIL（message 不含提示）。

**Step 3: 最小实现（只改 message 文案）**

在 `backend/src/promptxy/gateway.ts`：
- `route_not_configured` 分支（约 `backend/src/promptxy/gateway.ts:740`）补充 message：
  - 指向 UI（`/`）与 API（`/_promptxy/routes`）可选。
- `supplier_unavailable` 分支（约 `backend/src/promptxy/gateway.ts:842`）补充 message：
  - Claude：提示兜底 `*` 规则；Codex/Gemini：提示选择同协议 supplier 并启用。

**Step 4: 运行测试确认通过**

Run: `npm test -- backend/tests/integration/gateway.test.ts`
Expected: PASS。

**Step 5: Commit**

```bash
git add backend/src/promptxy/gateway.ts backend/tests/integration/gateway.test.ts
git commit -m "$(cat <<'EOF'
后端：优化路由/供应商错误提示，提升可操作性

- route_not_configured：提示用户到 UI 路由配置页启用路由
- supplier_unavailable：提示检查 supplier 启用状态与 Claude 路由 * 兜底规则
- 不改错误码与核心路由匹配逻辑，仅优化 message
EOF
)"
```

---

## 验收标准（Acceptance Criteria）

- README 与 docs/architecture 的端口/入口/路由约束描述与当前实现一致，且不再出现 `defaultSupplierId` 的用户向说明。
- 文档明确 UI 在 `/`，API 在 `/_promptxy/*`，并明确 Claude 路由需 `*` 兜底规则。
- `scripts/start.sh` 被删除，且 README/docs 不再引用。
- UI：新建 Claude 路由默认能选中一个 supplier；缺少 `*` 兜底规则时有明确提示。
- 网关：`route_not_configured` 与 `supplier_unavailable` 的响应 `message` 提供下一步操作指引。
- 测试：至少包含 1 个前端测试覆盖提示文本，至少包含 1 个后端集成测试覆盖错误 message。

---

## 风险与回滚

- 风险：改动错误 message 可能影响依赖文案的外部脚本/用户习惯。
  - 缓解：只增强（append）信息，不改变错误码与字段结构。
- 风险：前端默认选择 supplier 可能在“没有 enabled supplier”时表现不佳。
  - 缓解：无 enabled supplier 时保持空，并显示提示。
- 回滚：逐个 revert 对应 commits；删除脚本的回滚是 `git revert` 恢复文件即可。

---

## 执行交接

计划已写好后，执行时必须逐任务完成并频繁提交。

> **For Claude:** 执行本计划请使用 `superpowers:executing-plans`。
