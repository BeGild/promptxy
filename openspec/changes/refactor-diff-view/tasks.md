# 实施任务清单（行级文本 Diff：叶子节点=文件）

> 说明：本清单以最新需求为准：
> - **全量行显示**（不提供“仅显示变化”过滤）
> - **仅内容修改**：目录树结构不变，不存在新增/删除节点
> - **行级 diff + 对齐 + 同步滚动**（meld 风格）

## 0. 规格对齐

- [x] 0.1 更新 `proposal.md` / `design.md` / `spec.md` 并确认评审通过

## 1. 文本化与叶子节点定义

- [x] 1.1 定义“叶子节点”判定规则（与内容详情一致）
- [x] 1.2 复用 `getNodeCopyContent(node)` 作为叶子节点的“文件文本内容”
- [x] 1.3 选择非叶子节点时右侧显示提示（不渲染结构化内容）

## 2. 行级 diff 工具

- [x] 2.1 新增 `diffLines(leftText, rightText)`：按 `\n` 分割（空白敏感），输出对齐 `rows[]`
- [x] 2.2 新增 `buildHunks(rows)`：把连续差异行聚合为差异块
- [x] 2.3 单元测试覆盖：空行、空白差异、插入/删除/替换组合

## 3. TextDiffViewer（双栏对齐 + 同步滚动）

- [x] 3.1 新增 `TextDiffViewer`：使用 `react-window` 单一列表渲染每行的左右两列
- [x] 3.2 行高亮：same/added/removed/modified（added/removed 为行增删，非“文件新增/删除”）
- [x] 3.3 不显示行号（按需求）
- [x] 3.4 单元测试覆盖：渲染 rows、差异样式正确

## 4. 差异导航（hunk navigator）

- [x] 4.1 新增 `DiffHunkNavigator`：展示差异块分布（meld 风格）
- [x] 4.2 点击差异块可跳转（通过 listRef.scrollToItem）
- [x] 4.3 单元测试覆盖：点击触发跳转

## 5. DiffView 容器联动

- [x] 5.1 DiffView：只把叶子节点作为“可对比文件”
- [x] 5.2 DiffView：diff 列表/PrevNext 基于“差异块（hunk）”而非结构节点
- [x] 5.3 目录树选中叶子节点时，右侧更新文本 diff；目录树结构不裁剪
- [x] 5.4 分栏拖拽：与内容详情共享 `request-viewer:panel-sizes` 的持久化比例

## 6. 验收与回归

- [x] 6.1 TypeScript `npm -C frontend run type-check` 通过
- [x] 6.2 定向测试（diff 相关）通过
- [ ] 6.3 手工验收：
  - [ ] 6.3.1 选择叶子节点：全量行 diff 正常、空白敏感
  - [ ] 6.3.2 插入/删除行：左右对齐占位正确、同步滚动
  - [ ] 6.3.3 差异导航：点击跳转到差异块正确
  - [ ] 6.3.4 目录树结构不变（不裁剪、不增删）
