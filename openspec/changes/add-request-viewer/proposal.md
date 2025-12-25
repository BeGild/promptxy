# Change: Add Reusable Request Viewer Component

## Why

当前请求详情页面存在严重的用户体验问题：

1. **信息过载**：单个请求体可达 1300+ 行，包含大量嵌套的文本内容（system prompt、tools 定义等），用户需要大量滚动才能找到关键信息
2. **Markdown 格式丢失**：请求体中的文本字段（如 system prompt）通常是 Markdown 格式，但当前展示为纯文本转义后的一坨内容，无法阅读结构化内容（标题、列表、代码块等）
3. **DIFF 视图失效**：当请求体是复杂嵌套结构（数组、对象）时，数组元素的任何变化都会导致整个区域高亮，无法区分"结构性变化"和"内容变化"
4. **关注点错位**：PromptXY 的主要用途是通过改写规则修改系统提示词来改变 LLM 行为，但 system prompt 往往是最大且最难阅读的部分
5. **可复用性差**：当前请求详情查看逻辑与 Claude API 格式强耦合，无法适配其他 API 格式（如 OpenAI、Gemini）

## What Changes

- **新功能**: `request-viewer` - 可复用的请求详情查看组件
  - 支持多种渲染模式（结构概览、内容详情、差异对比）
  - Markdown 渲染支持（包含代码高亮、目录导航、全屏阅读）
  - 智能折叠/展开树形结构
  - 配置驱动的字段渲染行为
  - 适配器模式支持多种 API 格式

- **架构变更**:
  - 新增 `RequestAdapter` 接口，支持适配不同的 API 请求格式
  - 新增 `ViewNode` 通用树形数据结构
  - 新增可扩展的节点渲染器系统

- **UI/UX 改进**:
  - 三视图模式：结构概览（默认）、内容详情、差异对比
  - System Prompt 等 Markdown 内容支持完整渲染
  - 差异对比支持"仅显示变化"和段落级对比
  - 搜索/定位功能
  - 数学公式渲染支持（LaTeX 语法）

## Impact

- Affected specs (new):
  - `request-viewer` - 可复用请求查看器组件
  - `request-adapter` - API 格式适配器接口

- Affected code:
  - 新增 `frontend/src/components/request-viewer/` 目录
  - 替换 `frontend/src/components/requests/RequestDetail.tsx`
  - 替换 `frontend/src/components/requests/DiffViewer.tsx`

- Dependencies:
  - `react-markdown` + `remark-gfm` + `rehype-highlight` + `remark-math` + `rehype-katex` (Markdown + 数学公式渲染)
  - `katex` (数学公式渲染)

- Security:
  - Markdown 渲染需要防范 XSS（使用 `rehype-sanitize`）
  - 确保用户输入的 Markdown 不被执行为脚本

- Breaking Changes:
  - 旧的 `RequestDetail` 和 `DiffViewer` 组件将被完全替换
  - 无需保留向后兼容（开发阶段）
