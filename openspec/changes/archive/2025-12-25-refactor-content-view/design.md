# File Browser View Design

## Context

当前 `FullView` 组件使用递归树形结构展示请求内容，节点以缩进方式排列。这种方式存在以下问题：
1. 对于深层嵌套结构，需要大量滚动才能查看完整内容
2. 长文本内容（如 Markdown）与结构混在一起，影响阅读体验
3. 无法同时查看请求的不同部分，需要反复展开/折叠
4. 数值数组（如 embedding 向量）会撑爆目录树

用户希望采用类似 VS Code 文件浏览器的交互模式，更专注于内容而非结构。

## Goals / Non-Goals

**Goals:**
- 提供直观的文件系统风格导航界面
- 左右分栏布局，支持拖拽调整宽度比例
- 选中节点后右侧渲染完整内容
- 支持横向滚动（目录树深层嵌套、内容区宽表格等）
- 支持全屏模式
- 数值数组特殊处理，避免撑爆目录树

**Non-Goals:**
- 不保留原 FullView（直接替换）
- 不添加复杂的搜索/筛选功能（可后续添加）
- 不支持拖拽重排序或编辑节点

## Decisions

### Decision 1: 使用 react-resizable-panels

**选择理由：**
- 由 React Core Team 成员维护，质量可靠
- 无额外依赖，轻量级（~15KB gzipped）
- 支持鼠标、触摸、键盘操作
- 良好的 a11y 支持

**Alternatives considered:**
- `react-split-pane`: 已停止维护（最后更新 2019 年）
- `golden-layout`: 功能过于复杂，适合多标签场景
- `@hello-pangea/dnd`: 专注拖拽排序，不适合分割面板

### Decision 2: 节点类型判断逻辑

**文件夹（可展开）判断：**
```typescript
function isFolder(node: ViewNode): boolean {
  // 纯数值数组作为叶子节点
  if (node.type === NodeType.ARRAY && isNumericArray(node.value)) {
    return false;
  }
  // 对象类型、有子节点的数组都是文件夹
  return node.type === NodeType.JSON ||
         (node.type === NodeType.ARRAY && node.children?.length > 0);
}
```

**纯数值数组判断：**
```typescript
function isNumericArray(arr: any[]): boolean {
  return arr.length > 0 && arr.every(item => typeof item === 'number');
}
```

**理由：** embedding 向量等数值数组可能有 1536 个元素，展开为文件夹会撑爆目录树，直接作为叶子节点更合适。

### Decision 3: 初始状态显示根节点

**选择：** 默认选中根节点，右侧显示整个请求的结构

**理由：**
- 用户打开视图时有内容可看，避免空状态
- 根节点作为默认选中项符合文件浏览器的习惯（类似打开文件夹时选中第一个子项）

**Alternatives considered:**
- 空状态提示："请从左侧选择节点" - 用户体验较差
- 选中第一个叶子节点 - 逻辑复杂，不够直观

### Decision 4: MarkdownRenderer 简化样式

**选择：** 创建 `InlineNodeRenderer`，去掉外层边框、工具栏等装饰

**理由：**
- 右侧内容区已经有面包屑和全屏按钮，不需要每个渲染器重复
- 简化后更清爽，类似阅读文章的体验

**保留的功能：**
- 代码高亮
- 数学公式渲染
- 表格、列表等 Markdown 格式

**去掉的功能：**
- 外层容器边框
- 复制按钮（可在内容面板层统一提供）
- 全屏按钮（已在面板层提供）

### Decision 5: 图标使用 lucide-react

**选择：** 使用项目中已安装但未使用的 `lucide-react` 图标库

**图标映射：**
| 节点类型 | 图标 |
|---------|------|
| 文件夹 (展开) | `FolderOpen` |
| 文件夹 (折叠) | `Folder` |
| Markdown 文件 | `FileText` |
| 普通文件 | `File` |
| 代码 | `Code` |
| 数组 | `List` |
| 数值 | `Hash` |

**理由：** 项目已安装，无需额外依赖；图标风格统一，支持深色模式。

## Component Architecture

```
FileBrowserView (主容器)
├── PanelGroup (react-resizable-panels)
│   ├── Panel (左侧，30%, min 15%, max 50%)
│   │   └── FileTree
│   │       └── FileTreeNode (递归)
│   │           ├── FileIcon (lucide-react)
│   │           ├── NodeLabel
│   │           └── ExpandIndicator
│   │
│   ├── PanelResizeHandle (拖拽分割条)
│   │
│   └── Panel (右侧，70%)
│       └── FileContentPanel
│           ├── PathBreadcrumb
│           ├── ContentActions (全屏按钮)
│           └── InlineNodeRenderer
```

## State Management

```typescript
interface FileBrowserViewState {
  selectedNodeId: string | null;      // 当前选中的节点 ID
  expandedNodes: Set<string>;         // 展开的文件夹 ID 集合
  isFullScreen: boolean;              // 是否全屏
  panelSizes: [number, number];       // 左右面板宽度比例 (可选持久化)
}

// localStorage keys
'request-viewer:file-tree-expanded'
'request-viewer:file-tree-selected'
'request-viewer:panel-sizes' (可选)
```

## Risks / Trade-offs

### Risk 1: 大型请求的性能

**风险：** 包含数千个节点的请求可能导致目录树渲染缓慢

**缓解措施：**
- 使用 React.memo 优化 TreeNode 渲染
- 按需展开（默认只展开第一层）
- 必要时引入虚拟滚动（react-window）

### Risk 2: 兼容性问题

**风险：** 移除 FullView 可能影响依赖其内部 API 的代码

**缓解措施：**
- 确认没有外部代码直接导入 FullView
- 如有，提供迁移路径或保留一段时间标记为 deprecated

### Trade-off: 功能复杂度

**权衡：** 初期不实现键盘导航、右键菜单等高级功能

**理由：** 先满足核心需求，后续根据用户反馈迭代

## Migration Plan

1. 创建新组件，不影响现有 FullView
2. 在 RequestDetailPanel 中添加切换逻辑（临时）
3. 测试验证后，移除 FullView 和切换逻辑
4. 更新文档和示例

**Rollback：** 如果出现问题，可以快速切换回 FullView

## Open Questions

1. **是否需要保留展开状态跨请求？**
   - 当前设计：每个请求独立状态
   - 备选：使用路径模式匹配，自动展开相同路径

2. **面板宽度是否需要持久化？**
   - 当前设计：使用 react-resizable-panels 默认持久化
   - 备选：不持久化，每次重置为 30/70

3. **是否需要支持多个节点同时选中？**
   - 当前设计：单选
   - 备选：多选，支持批量操作（如复制多个节点）
