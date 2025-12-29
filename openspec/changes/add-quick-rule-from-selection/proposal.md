# Change: 基于选中内容快速创建规则

## Why

当前创建规则流程繁琐，用户需要：
1. 在请求详情页面复制目标文本
2. 切换到规则创建标签页
3. 手动粘贴文本到匹配字段
4. 手动编写正则表达式（添加 `^`、`$` 等符号）

正则表达式编写对非技术用户有较高门槛，容易出错。此功能旨在降低规则创建门槛，提升用户体验。

## What Changes

- 在"内容详情"视图的 `PlainTextRenderer` 组件中，添加选中文本后显示快捷创建按钮
- 点击按钮弹出匹配模式选择菜单（完整匹配、前缀匹配、后缀匹配、包含匹配、全词语匹配、忽略大小写）
- 根据用户选择的匹配模式，自动生成对应的正则表达式
- 自动从当前请求中提取 `client`、`method`、`path`、`model` 等元数据填充到规则
- 自动转义选中内容中的正则特殊字符
- 跳转到规则创建标签页，预填充所有字段
- 替代现有的"快速创建规则"按钮功能

## Impact

- **Affected specs**: `request-viewer`（添加选中内容快捷操作），`promptxy-rules`（规则预填充逻辑）
- **Affected code**:
  - `frontend/src/components/request-viewer/components/file-tree/InlineNodeRenderer.tsx`（PlainTextRenderer）
  - `frontend/src/components/request-viewer/components/views/FileBrowserView.tsx`（工具栏区域）
  - `frontend/src/components/rules/QuickRuleEditor.tsx`（规则创建逻辑）
  - `frontend/src/components/request-viewer/adapters/claude/ClaudeMessagesAdapter.ts`（元数据提取）
