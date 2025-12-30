# 设计文档：叶子节点=文件的行级文本 Diff（Meld 风格）

## 设计原则

1. **把 Diff 当作“两个文本文件”对比**：右侧不做结构化渲染，不依赖 `NodeRenderer`。
2. **叶子节点内容文本化规则复用“内容详情”**：Diff 视图不自行发明 stringify 规则。
3. **同步滚动优先**：通过“单一虚拟列表每行渲染两列”实现稳定同步滚动。
4. **目录树结构不变**：不裁剪、不增删节点，仅用于定位叶子节点。
5. **仅考虑内容修改**：不支持新增/删除文件；所有被对比文件均两侧存在且仅内容不同。

## 架构概览

```
DiffView.tsx (容器)
├── DiffToolbar (显示差异数量、Prev/Next hunk)
├── FileTree (左侧目录树：modifiedTree；结构不变)
└── DiffTextPanel (右侧内容区)
    ├── DiffHunkNavigator (差异块导航条/小地图)
    └── TextDiffViewer (行级对齐 + 同步滚动)
        └── react-window FixedSizeList<Row>
            └── Row = [LeftTextCell | RightTextCell]
```

## 数据流

### 1) 叶子节点选择

- 用户在左侧目录树选择节点：
  - 若为叶子节点：进入文本 diff
  - 若非叶子节点：右侧显示提示“请选择叶子节点查看差异”

> 目录树不裁剪，所以必须在内容区做叶子判断与提示。

### 2) 文本化（与内容详情一致）

Diff 视图获取文本内容时，复用现有工具：

- `getNodeCopyContent(node)`（定义在 `frontend/src/components/request-viewer/utils/clipboard.ts`）

理由：

- 它已经对 string / null / number / object/array 给出了稳定的文本化逻辑
- 与内容详情“纯文本查看/复制”的用户预期一致

### 3) 行级 diff（对齐行）

对比目标：`leftText` vs `rightText`（由 `getNodeCopyContent` 产出）

处理步骤：

1. `splitLines(text)`：按 `\n` 分割，保留空行；**空白敏感**（不 trim）
2. `diffLines(leftLines, rightLines)`：生成对齐行 `rows[]`
3. `buildHunks(rows)`：基于 rows 生成差异块（hunk）用于导航

对齐行数据结构（示例）：

```ts
type RowType = 'same' | 'added' | 'removed' | 'modified';

interface TextDiffRow {
  type: RowType;
  left: string;  // 可能为空（占位）
  right: string; // 可能为空（占位）
}
```

说明：

- `added/removed` 在本提案“仅内容修改”的前提下不作为业务入口，但算法层可以自然产生（例如内容中插入/删除行），仍需要用空行占位以对齐显示。

### 4) 同步滚动

使用 `react-window` 渲染 `rows[]`：

- 每个虚拟列表行同时渲染左右两列文本
- 因为只有一个滚动容器，所以左右必然同步滚动

横向滚动：

- 两列内容各自可以 `overflow-x-auto`（但纵向仍同步）
- 或者用同一个横向滚动容器包裹两列（可选，后续再决定）

## 交互与 UI 细节

### 1) 全量行显示

- 永远显示完整文本行
- 仅通过背景色/边框强调差异行

### 2) 差异导航（Meld 风格）

- `DiffHunkNavigator` 显示纵向或横向差异分布
- 点击某个 hunk：`listRef.scrollToItem(hunk.startRow)`

### 3) 工具栏

- 不提供“仅显示变化”过滤（与“全量行显示”冲突）
- 仍保留：
  - 差异块数量
  - 上一个/下一个差异块

## 性能考虑

- 行级 diff 采用近线性复杂度的 diff 算法（优先 Myers）
- `TextDiffViewer` 使用虚拟列表渲染，避免超长文本导致 DOM 爆炸
- `useMemo` 缓存：
  - `leftText/rightText`
  - `rows/hunks`

## 测试策略（最小集）

1. `diffLines`：给定输入文本，断言 rows 对齐与类型正确（包含空行、空白差异、插入/删除）
2. `TextDiffViewer`：渲染少量 rows，断言差异行 className/内容正确
3. `DiffHunkNavigator`：点击跳转触发 `scrollToItem`（可用 mock listRef）

