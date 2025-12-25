# Implementation Tasks

## 1. 核心类型与基础设施

- [x] 1.1 创建 `request-viewer/` 目录结构
- [x] 1.2 定义核心类型 (`types/index.ts`)
  - [x] `NodeType` 枚举
  - [x] `DiffStatus` 枚举
  - [x] `RenderMode` 枚举
  - [x] `ViewNode` 接口
  - [x] `FieldConfig` 接口
  - [x] `RequestMetadata` 接口
  - [x] `ViewGroup` 接口
- [x] 1.3 定义适配器接口 (`types/adapter.ts`)
  - [x] `RequestAdapter<T>` 接口
  - [x] `AdapterFactory` 接口

## 2. 树构建器与适配器基础设施

- [x] 2.1 实现树构建器 (`adapters/utils/treeBuilder.ts`)
  - [x] `buildTreeFromPath()` 函数
  - [x] `inferNodeType()` 函数
  - [x] `calculateDiffStatus()` 函数
  - [x] `shouldCollapse()` 函数
  - [x] `generateSummary()` 函数
- [x] 2.2 实现适配器注册表 (`adapters/Registry.ts`)
  - [x] `AdapterRegistry` 单例类
  - [x] `register()` 方法
  - [x] `findAdapter()` 方法
  - [x] `listAdapters()` 方法

## 3. Claude API 适配器

- [x] 3.1 实现 Claude Messages API 适配器 (`adapters/claude/ClaudeMessagesAdapter.ts`)
  - [x] `name` 和 `version` 属性
  - [x] `supports()` 方法
  - [x] `extractMetadata()` 方法
  - [x] `buildViewTree()` 方法
  - [x] `getFieldConfig()` 方法
  - [x] `getGroups()` 方法
- [x] 3.2 定义 Claude API 字段配置
  - [x] System prompt 配置（Markdown 渲染，默认展开）
  - [x] Messages 数组配置
  - [x] Tools 数组配置（默认折叠）
  - [x] 其他关键字段配置

## 4. 基础渲染器

- [x] 4.1 实现 `NodeRenderer` 入口组件 (`components/renderers/NodeRenderer.tsx`)
  - [x] 支持自定义渲染器
  - [x] 回退到默认渲染器
- [x] 4.2 实现 `PrimitiveRenderer` (`components/renderers/PrimitiveRenderer.tsx`)
- [x] 4.3 实现 `StringLongRenderer` (`components/renderers/StringLongRenderer.tsx`)
  - [x] 折叠/展开控制
  - [x] 复制功能
- [x] 4.4 实现 `JsonRenderer` (`components/renderers/JsonRenderer.tsx`)
  - [x] 树形展示
  - [x] 折叠/展开控制
- [x] 4.5 实现 `ArrayRenderer` (`components/renderers/ArrayRenderer.tsx`)
  - [x] 列表展示
  - [x] 折叠/展开控制

## 5. Markdown 渲染器

- [x] 5.1 安装依赖
  - [x] `react-markdown`
  - [x] `remark-gfm`
  - [x] `remark-math` (数学公式)
  - [x] `rehype-highlight` (代码高亮)
  - [x] `rehype-katex` (数学公式渲染)
  - [x] `rehype-sanitize` (安全)
  - [x] `katex` 和样式
  - [x] `highlight.js` 和样式
- [x] 5.2 实现 `MarkdownRenderer` 组件 (`components/renderers/MarkdownRenderer.tsx`)
  - [x] Markdown 渲染
  - [x] 代码高亮
  - [x] 数学公式渲染（行内 `$...$` 和块级 `$$...$$`）
  - [x] 自定义组件样式（h1-h6, p, code, pre, ul, ol, blockquote, table）
  - [x] 折叠/展开控制
  - [x] 复制功能（支持 Markdown 源码和纯文本）
- [x] 5.3 实现全屏阅读模式
  - [x] 全屏弹窗
  - [x] 目录导航
  - [x] 点击目录跳转到标题

## 6. 视图组件

- [x] 6.1 实现 `RequestDetailPanel` 主组件 (`components/RequestDetailPanel.tsx`)
  - [x] 自动检测适配器
  - [x] 视图模式切换（Tab）
  - [x] 元数据栏
- [x] 6.2 实现 `SummaryView` 组件 (`components/views/SummaryView.tsx`)
  - [x] 分组展示（基本信息、System Prompt、Messages、Tools）
  - [x] 智能摘要生成
  - [x] 展开/折叠控制
- [x] 6.3 实现 `FullView` 组件 (`components/views/FullView.tsx`)
  - [x] 可展开树形结构
  - [x] localStorage 持久化折叠状态
- [x] 6.4 实现 `DiffView` 组件 (`components/views/DiffView.tsx`)
  - [x] 并排对比
  - [x] "仅显示变化"开关
  - [x] 差异导航（下一个/上一个）

## 7. 差异算法

- [x] 7.1 实现 Markdown 段落级 diff (`utils/diff.ts`)
  - [x] 将 Markdown 解析为段落树
  - [x] 段落级对比算法
  - [x] 合并无变化段落
  - [x] 检测段落移动
  - [x] 相似度计算（编辑距离）
  - [x] 更新 DiffView 集成段落级 diff

## 8. 集成与替换

- [x] 8.1 集成新组件
  - [x] 在 `RequestDetail.tsx` 中使用 `RequestDetailPanel`
  - [x] 保留原有元数据和错误信息展示
- [x] 8.2 更新组件导出
  - [x] 创建 `request-viewer/index.ts` 导出文件

## 9. 文档与测试

- [ ] 9.1 编写适配器开发文档
  - [ ] 如何创建新的适配器
  - [ ] 适配器 API 参考
- [ ] 9.2 编写组件使用文档
  - [ ] `RequestDetailPanel` 使用示例
  - [ ] 自定义渲染器示例
- [ ] 9.3 编写单元测试
  - [ ] 树构建器测试
  - [ ] 适配器测试
  - [ ] 渲染器测试

## 10. 后续扩展（可选）

- [ ] 10.1 实现 OpenAI API 适配器
- [ ] 10.2 实现 Gemini API 适配器
- [ ] 10.3 添加配置文件驱动的适配器生成器
- [ ] 10.4 性能优化（虚拟滚动、延迟渲染）
