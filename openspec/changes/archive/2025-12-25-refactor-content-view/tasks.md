# Implementation Tasks

## 1. 基础设施

- [x] 1.1 安装 `react-resizable-panels` 依赖
  ```bash
  cd frontend && npm install react-resizable-panels
  ```

- [x] 1.2 创建数组工具函数
  - 创建 `frontend/src/components/request-viewer/utils/arrayHelper.ts`
  - 实现 `isNumericArray()` 函数
  - 实现 `isPrimitiveArray()` 函数

## 2. 核心组件开发

- [x] 2.1 创建 `FileTreeNode.tsx`
  - 实现递归渲染逻辑
  - 实现展开/折叠交互
  - 实现 `isFolder()` 判断函数
  - 集成 lucide-react 图标
  - 添加选中状态样式
  - 添加悬停效果

- [x] 2.2 创建 `FileTree.tsx`
  - 包装 `FileTreeNode` 组件
  - 管理展开状态（Set<string>）
  - 管理选中状态
  - 实现 localStorage 持久化
  - 添加横向滚动支持

- [x] 2.3 创建 `InlineNodeRenderer.tsx`
  - 创建简化版 Markdown 渲染器（去外层容器）
  - 创建数值数组渲染器（逗号分隔显示）
  - 复用 PrimitiveRenderer 逻辑
  - 处理其他节点类型（JSON, ARRAY）的内联渲染

- [x] 2.4 创建 `PathBreadcrumb.tsx`
  - 解析节点路径（如 `messages.0.content.0.text`）
  - 显示路径片段
  - 实现点击跳转功能

- [x] 2.5 创建 `FileContentPanel.tsx`
  - 显示选中节点内容
  - 集成 `PathBreadcrumb`
  - 集成 `InlineNodeRenderer`
  - 添加全屏按钮
  - 实现全屏模式逻辑
  - 添加横向滚动支持

## 3. 视图集成

- [x] 3.1 创建 `FileBrowserView.tsx`
  - 使用 `react-resizable-panels` 创建分割布局
  - 集成 `FileTree` 和 `FileContentPanel`
  - 设置默认面板宽度（30/70）
  - 设置最小/最大宽度限制
  - 实现面板宽度持久化
  - 实现全屏模式（左右面板同时全屏）

- [x] 3.2 修改 `RequestDetailPanel.tsx`
  - 将 `RenderMode.FULL` 的渲染组件从 `FullView` 替换为 `FileBrowserView`
  - 更新导入语句

## 4. 样式与优化

- [x] 4.1 实现暗色模式适配
  - 适配 tree 节点样式
  - 适配内容面板样式
  - 适配分割条样式
  - 适配全屏模式样式

- [x] 4.2 添加交互状态样式
  - 选中节点高亮
  - 悬停效果
  - 展开/折叠动画

- [x] 4.3 实现分割条样式
  - 默认状态样式
  - 悬停状态样式
  - 拖拽状态样式

- [x] 4.4 键盘快捷键支持
  - 方向键导航（上下选择，左右展开/折叠）
  - Enter 展开/折叠或选中
  - Escape 退出全屏

## 5. 测试与验证

- [x] 5.1 功能测试
  - 测试各种节点类型渲染（primitive, string, markdown, json, array）
  - 测试数值数组特殊处理
  - 测试深层嵌套结构的横向滚动
  - 测试面板宽度调整
  - 测试全屏模式
  - 测试 localStorage 持久化

- [x] 5.2 边界情况测试
  - 空数组处理
  - null/undefined 值处理
  - 超长文本渲染

- [x] 5.3 兼容性测试
  - 验证现有 diff view 和 summary view 不受影响
  - 验证适配器正常工作

## 6. 文档与清理

- [x] 6.1 移除 `FullView.tsx`
  - 确认无外部依赖后删除

## 实施完成总结

### 新增文件（8个）

| 文件 | 说明 |
|------|------|
| `utils/arrayHelper.ts` | 数组类型判断工具 |
| `file-tree/FileTreeNode.tsx` | 递归树节点组件 |
| `file-tree/FileTree.tsx` | 文件树组件（含键盘导航） |
| `file-tree/InlineNodeRenderer.tsx` | 简化版节点渲染器 |
| `file-tree/PathBreadcrumb.tsx` | 路径面包屑组件 |
| `file-tree/FileContentPanel.tsx` | 内容面板组件 |
| `views/FileBrowserView.tsx` | 文件浏览器风格视图主组件 |
| `file-tree/index.ts` | 导出文件 |

### 修改文件（2个）

| 文件 | 修改内容 |
|------|----------|
| `package.json` | 添加 `react-resizable-panels` 依赖 |
| `RequestDetailPanel.tsx` | 将 FullView 替换为 FileBrowserView |

### 删除文件（1个）

| 文件 | 原因 |
|------|------|
| `views/FullView.tsx` | 已被 FileBrowserView 替换 |

### 核心功能

- ✅ 左侧文件系统风格目录树
- ✅ 右侧内容渲染面板
- ✅ 可拖拽调整面板宽度
- ✅ 全屏模式（ESC 退出）
- ✅ localStorage 持久化（展开状态、选中状态、面板宽度）
- ✅ 数值数组特殊处理
- ✅ 暗色模式支持
- ✅ 横向滚动支持
- ✅ 键盘导航（方向键、Enter、ESC）
- ✅ React.memo 性能优化

### 构建状态

✅ TypeScript 编译通过
✅ Vite 构建成功
