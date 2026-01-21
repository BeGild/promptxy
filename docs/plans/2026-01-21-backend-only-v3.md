# Backend-Only v3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 PromptXY 收敛为仅 `backend/src/promptxy` 的单一实现与单一配置语义（`suppliers/routes`），删除所有“简化版/upstreams”相关口径，并将版本升级为 `v3.0.0`（破坏性变更，不提供任何配置兼容）。

**Architecture:** 不改变现有后端/前端/数据库/协议转换的核心能力；只做代码与文档的“单一真相”收敛。仓库根目录负责构建编排与发布入口（`dist/cli-entry.js`），实现全部落在 `backend/src/promptxy/*`。

**Tech Stack:** Node.js >= 18, TypeScript (NodeNext), Node `http` server, SQLite, React (frontend), Vitest.

---

### Task 1: Create isolated worktree

**Files:**
- Modify: none

**Step 1: Check base working tree is clean**

Run: `git status -sb`
Expected: 没有无关未提交改动

**Step 2: Create worktree + branch**

Run: `git worktree add ../promptxy-v3-backend-only -b chore/v3-backend-only`
Expected: 输出包含新 worktree 路径 `../promptxy-v3-backend-only`

**Step 3: Enter worktree and confirm branch**

Run:
- `cd ../promptxy-v3-backend-only`
- `git status -sb`
Expected: `## chore/v3-backend-only`

---

### Task 2: Remove untracked drafts (repo hygiene)

**Files:**
- Delete: `Untitled-2-1.md`（若存在且确认无用）
- Delete: `openspec/changes/2026-01-21-fix-codex-to-clude-tool-use-sse-events/`（若存在且确认无用；本次不走 OpenSpec）

**Step 1: Verify drafts exist**

Run: `git status -sb`
Expected: 看到 `?? Untitled-2-1.md` 或 `?? openspec/changes/...`（如存在）

**Step 2: Inspect draft quickly (avoid deleting real work)**

Run:
- `ls -la Untitled-2-1.md 2>/dev/null || true`
- `sed -n '1,40p' Untitled-2-1.md 2>/dev/null || true`
Expected: 内容是临时草稿

**Step 3: Delete drafts**

Run:
- `rm -f Untitled-2-1.md`
- `rm -rf openspec/changes/2026-01-21-fix-codex-to-clude-tool-use-sse-events`
Expected: `git status -sb` 不再出现上述路径

**Step 4: Commit**

```bash
git add -A
git commit -m "清理：移除临时草稿与未使用目录\n\n- 删除未跟踪的临时 markdown 草稿，避免污染 v3 PR\n- 删除未纳入当前流程的 openspec 草稿目录，保持仓库整洁"
```
Expected: commit 成功（若无变更则跳过）

---

### Task 3: Fix root `tsconfig.json` to match backend-only reality

**Files:**
- Modify: `tsconfig.json`

**Step 1: Write the failing check**

Run: `sed -n '1,120p' tsconfig.json`
Expected: 看到 `rootDir: "src"` / `include: ["src/**/*.ts"]`

**Step 2: Apply minimal change**

Set `tsconfig.json` to:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "backend/src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "downlevelIteration": true
  },
  "include": ["backend/src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 3: Run build to verify**

Run: `npm run build:backend`
Expected: PASS

**Step 4: Commit**

```bash
git add tsconfig.json
git commit -m "构建：根 tsconfig 收敛到 backend/src\n\n- rootDir/include 不再指向已移除的 src\n- 明确 backend/src 为唯一实现来源，减少结构歧义"
```

---

### Task 4: Remove all `upstreams` / “简化版” doc narrative (breaking)

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/configuration.md`

**Step 1: Write the failing check**

Run: `rg -n "\\bupstreams\\b|简化版|PROMPTXY_UPSTREAM_" README.md docs`
Expected: 命中至少包括 `docs/architecture.md`、`docs/configuration.md`（当前已知命中点：`docs/architecture.md:309`、`docs/configuration.md:371` 等）

**Step 2: Update `README.md` (single story)**

Edits checklist:
- 删除“简化版/完整版”叙事与所有 `upstreams` 示例
- 保留安装方式：`npm install -g promptxy` + `promptxy`
- 明确入口边界：
  - `/claude/*`：允许跨协议转换到任意 supplier
  - `/codex/*`：透明转发 OpenAI **Responses API**
  - `/gemini/*`：透明转发 Gemini
- 增加破坏性说明（可直接粘贴）：

```md
> ⚠️ v3.0.0 破坏性变更：不再支持旧的 `upstreams` 配置与“简化版”口径；仅支持 `suppliers/routes` 配置格式。
```

**Step 3: Update `docs/architecture.md`**

Edits checklist:
- 删除目录结构中的 `src/`（简化版）描述
- 删除/替换 `upstreams` 配置示例为 `suppliers/routes`

**Step 4: Update `docs/configuration.md`**

Edits checklist:
- 删除环境变量映射表中：`PROMPTXY_UPSTREAM_ANTHROPIC|OPENAI|GEMINI`
- 删除所有 `upstreams` JSON 示例段
- 最小示例只保留 `suppliers/routes`

**Step 5: Re-run check to ensure it passes**

Run: `rg -n "\\bupstreams\\b|简化版|PROMPTXY_UPSTREAM_" README.md docs`
Expected: 0 matches

**Step 6: Commit**

```bash
git add README.md docs/architecture.md docs/configuration.md
git commit -m "文档：移除简化版/upstreams 口径，统一为 suppliers/routes（v3 破坏性）\n\n- 删除简化版配置叙事与 upstreams 示例\n- 移除 PROMPTXY_UPSTREAM_* 环境变量说明\n- 明确 v3 不提供旧配置兼容"
```

---

### Task 5: Bump version to `v3.0.0`

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Write the failing check**

Run: `node -p "require('./package.json').version"`
Expected: 输出不是 `3.0.0`

**Step 2: Bump version (no git tag)**

Run: `npm version 3.0.0 --no-git-tag-version`
Expected: `package.json` 版本变为 `3.0.0`，lockfile 同步更新

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "版本：升级到 v3.0.0（backend-only，破坏性变更）\n\n- 主版本号上调以反映移除简化版/upstreams 口径\n- 对外仅支持 suppliers/routes 配置语义"
```

---

### Task 6: Tests + smoke run

**Files:**
- Modify: none

**Step 1: Run tests**

Run: `npm test`
Expected: PASS

**Step 2: Build**

Run: `npm run build`
Expected: PASS

**Step 3: Start dev (background) per repo convention**

Run: `./scripts/dev.sh &`
Expected: 后端与前端启动，终端不阻塞

**Step 4: Probe health endpoint (auto-detect port)**

Run:

```bash
for port in {7070..7100} {8000..9000}; do
  curl -s -m 1 "http://127.0.0.1:${port}/_promptxy/health" >/dev/null 2>&1 && echo "OK ${port}" && break
done
```

Expected: 输出 `OK <PORT>`

**Step 5: Stop servers**

Run:
- `jobs -l`
- `kill %1`  # 以实际 job id 为准
Expected: 后台进程退出

---

## Definition of Done

- 根目录 `tsconfig.json` 不再引用 `src`。
- `README.md`、`docs/architecture.md`、`docs/configuration.md` 不包含 `upstreams`/“简化版”/`PROMPTXY_UPSTREAM_*`。
- `npm test`、`npm run build` 通过。
- 启动后 `/_promptxy/health` 可访问。
- `package.json` 版本为 `3.0.0`。

---

Plan complete and saved to `docs/plans/2026-01-21-backend-only-v3.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration

2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
