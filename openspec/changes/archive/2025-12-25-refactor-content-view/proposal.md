# Change: Refactor Content Detail View to File Browser Style

## Why

当前 Content Detail (内容详情) 视图使用树形结构展示请求内容，过于侧重结构而忽视了内容。用户希望采用类似文件浏览器的界面风格：
- 左侧显示目录树（对象/数组是文件夹，叶子节点是文件）
- 右侧渲染选中的节点内容
- 支持拖拽调节面板宽度
- 支持全屏展示

这种设计更符合用户浏览和阅读请求内容的习惯，特别适合查看包含大量文本的 AI 对话请求。

## What Changes

- **新建 `FileBrowserView` 组件**：替换现有的 `FullView`，采用左右分栏布局
- **新增 `FileTree` 组件**：左侧目录树，支持展开/折叠、横向滚动
- **新增 `FileContentPanel` 组件**：右侧内容渲染面板，显示路径面包屑和节点内容
- **新增 `InlineNodeRenderer` 组件**：简化版渲染器，去掉外层容器样式
- **添加 `react-resizable-panels` 依赖**：实现可拖拽调整面板宽度
- **修改 `RequestDetailPanel`**：将 RenderMode.FULL 的渲染组件从 FullView 替换为 FileBrowserView

## Impact

- **Affected specs**: `request-viewer`
- **Affected code**:
  - `frontend/src/components/request-viewer/components/views/FullView.tsx` (将被移除或保留作为备选)
  - `frontend/src/components/request-viewer/components/RequestDetailPanel.tsx`
  - 新增文件：`FileBrowserView.tsx`, `FileTree.tsx`, `FileTreeNode.tsx`, `FileContentPanel.tsx`, `InlineNodeRenderer.tsx`, `PathBreadcrumb.tsx`
  - 新增工具：`frontend/src/components/request-viewer/utils/arrayHelper.ts`
