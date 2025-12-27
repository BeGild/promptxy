# 实施任务清单

## 1. 建立样式系统基础

### 1.1 创建目录结构
- [x] 1.1.1 创建 `frontend/src/styles/tokens/` 目录
- [x] 1.1.2 创建 `frontend/src/styles/utilities/` 目录
- [x] 1.1.3 创建 `frontend/src/styles/themes/` 目录

### 1.2 定义 CSS 变量
- [x] 1.2.1 创建 `tokens/colors.css` - 定义所有颜色变量
- [x] 1.2.2 创建 `tokens/spacing.css` - 定义 4px 网格间距变量
- [x] 1.2.3 创建 `tokens/typography.css` - 定义字体变量
- [x] 1.2.4 创建 `tokens/effects.css` - 定义圆角和阴影变量
- [x] 1.2.5 创建 `tokens/index.css` - 聚合所有 token 文件

### 1.3 定义主题变量
- [x] 1.3.1 创建 `themes/light.css` - 浅色主题变量
- [x] 1.3.2 创建 `themes/dark.css` - 深色主题变量

### 1.4 创建工具类
- [x] 1.4.1 创建 `utilities/layout.css` - 布局工具类（flex, grid 等）
- [x] 1.4.2 创建 `utilities/components.css` - 组件工具类（card, btn 等）

### 1.5 创建入口文件
- [x] 1.5.1 创建 `index.css` 作为样式入口点
- [x] 1.5.2 在 `main.tsx` 中引入新的 `index.css`

## 2. 配置 Tailwind CSS

### 2.1 更新 Tailwind 配置
- [x] 2.1.1 在 `tailwind.config.js` 中映射颜色变量
- [x] 2.1.2 在 `tailwind.config.js` 中映射间距变量
- [x] 2.1.3 在 `tailwind.config.js` 中映射字体变量
- [x] 2.1.4 在 `tailwind.config.js` 中映射效果变量
- [x] 2.1.5 设置 `darkMode: 'class'` 启用基于类的主题切换

### 2.2 配置 HeroUI 主题
- [x] 2.2.1 更新 HeroUI light 主题配置引用 CSS 变量
- [x] 2.2.2 更新 HeroUI dark 主题配置引用 CSS 变量
- [x] 2.2.3 验证 HeroUI 组件使用主题变量

## 3. 创建 TypeScript 类型定义

### 3.1 类型定义
- [x] 3.1.1 创建 `frontend/src/styles/tokens.ts` 定义 Token 类型
- [x] 3.1.2 导出 `StyleTokens` 常量
- [x] 3.1.3 导出 `ColorTokens`, `SpacingTokens`, `TypographyTokens`, `EffectTokens` 类型

## 4. 迁移公共基础组件 (P0 优先级)

### 4.1 LogoIcon 组件
- [x] 4.1.1 替换硬编码渐变色 `#007AFF`, `#0055D4` 为 CSS 变量
- [x] 4.1.2 验证浅色/深色主题下颜色正确

### 4.2 StatusIndicator 组件
- [x] 4.2.1 替换状态颜色为 CSS 变量
- [x] 4.2.2 替换内联样式为 Tailwind 类名
- [x] 4.2.3 验证状态指示器效果

### 4.3 EmptyState 组件
- [x] 4.3.1 替换内联样式为语义化类名
- [x] 4.3.2 验证布局和样式

### 4.4 ErrorBoundary 组件
- [x] 4.4.1 替换内联样式为语义化类名
- [x] 4.4.2 验证错误显示样式

## 5. 迁移布局组件 (P1 优先级)

### 5.1 Sidebar 组件
- [x] 5.1.1 替换硬编码尺寸 `width: '44px'` 为 CSS 变量
- [x] 5.1.2 替换内联样式为 Tailwind 类名
- [x] 5.1.3 验证侧边栏布局和响应式

### 5.2 Header 组件
- [x] 5.2.1 替换内联样式为语义化类名
- [x] 5.2.2 验证头部样式

## 6. 迁移业务组件 (P2 优先级)

### 6.1 Rules 相关组件
- [x] 6.1.1 迁移 `RulesPage.tsx`
- [x] 6.1.2 迁移 `RuleCard.tsx`
- [x] 6.1.3 迁移 `RuleList.tsx`
- [x] 6.1.4 迁移 `RuleEditor.tsx`
- [x] 6.1.5 迁移 `RuleListVirtual.tsx`
- [x] 6.1.6 迁移 `HelpTooltip.tsx`

### 6.2 Requests 相关组件
- [x] 6.2.1 迁移 `RequestsPage.tsx`
- [x] 6.2.2 迁移 `RequestList.tsx`
- [x] 6.2.3 迁移 `RequestListVirtual.tsx`
- [x] 6.2.4 迁移 `RequestDetail.tsx`
- [x] 6.2.5 迁移 `DiffViewer.tsx`
- [x] 6.2.6 迁移 `PathAutocomplete.tsx`

### 6.3 Settings 相关组件
- [x] 6.3.1 迁移 `SettingsPanel.tsx`
- [x] 6.3.2 迁移 `SupplierManagement.tsx`

### 6.4 其他组件
- [x] 6.4.1 迁移 `PreviewPanel.tsx`
- [x] 6.4.2 迁移 `Modal.tsx`

### 6.5 Request Viewer 组件
- [x] 6.5.1 迁移 `FileBrowserView.tsx`
- [x] 6.5.2 迁移 `SummaryView.tsx`
- [x] 6.5.3 迁移 `DiffView.tsx`
- [x] 6.5.4 迁移 `RequestDetailPanel.tsx`
- [x] 6.5.5 迁移 `FileTree.tsx`
- [x] 6.5.6 迁移 `FileTreeNode.tsx`
- [x] 6.5.7 迁移 `PathBreadcrumb.tsx`
- [x] 6.5.8 迁移 `FileContentPanel.tsx`
- [x] 6.5.9 迁移 `InlineNodeRenderer.tsx`
- [x] 6.5.10 迁移 `NodeRenderer.tsx`
- [x] 6.5.11 迁移 `PrimitiveRenderer.tsx`
- [x] 6.5.12 迁移 `MarkdownRenderer.tsx`
- [x] 6.5.13 迁移 `JsonRenderer.tsx`
- [x] 6.5.14 迁移 `StringLongRenderer.tsx`
- [x] 6.5.15 迁移 `ArrayRenderer.tsx`

### 6.6 页面组件
- [x] 6.6.1 迁移 `PreviewPage.tsx`
- [x] 6.6.2 迁移 `App.tsx`

## 7. 实现主题切换功能

### 7.1 主题切换逻辑
- [x] 7.1.1 创建主题切换 hook/useTheme.ts
- [x] 7.1.2 实现主题切换函数（toggle/add/remove .dark 类）
- [x] 7.1.3 实现主题持久化到 localStorage
- [x] 7.1.4 实现系统主题检测（prefers-color-scheme）

### 7.2 防止闪烁
- [x] 7.2.1 在 <head> 中添加内联脚本预先检测主题
- [x] 7.2.2 验证页面加载时无主题闪烁

## 8. 验证与测试

### 8.1 视觉验证
- [x] 8.1.1 验证浅色模式下所有组件显示正常
- [x] 8.1.2 验证深色模式下所有组件显示正常
- [x] 8.1.3 验证主题切换流畅无闪烁

### 8.2 HeroUI 组件验证
- [x] 8.2.1 验证 Button 组件样式正确
- [x] 8.2.2 验证 Input 组件样式正确
- [x] 8.2.3 验证 Card 组件样式正确
- [x] 8.2.4 验证 Select 组件样式正确
- [x] 8.2.5 验证 Modal 组件样式正确
- [x] 8.2.6 验证其他 HeroUI 组件样式正确

### 8.3 响应式验证
- [x] 8.3.1 验证不同屏幕尺寸下布局正常
- [x] 8.3.2 验证间距在缩放时表现合理

### 8.4 代码质量
- [x] 8.4.1 运行 TypeScript 类型检查，无错误
- [x] 8.4.2 运行构建，无警告
- [x] 8.4.3 检查控制台无 CSS 相关错误或警告

## 9. 清理与文档

### 9.1 清理冗余代码
- [x] 9.1.1 移除 `globals.css` 中已迁移的重复定义
- [x] 9.1.2 检查并移除未使用的工具类

### 9.2 编写文档
- [x] 9.2.1 在 `frontend/src/styles/README.md` 中说明样式系统架构
- [x] 9.2.2 记录 CSS 变量命名规范
- [x] 9.2.3 记录主题切换使用方法
- [x] 9.2.4 记录组件样式迁移指南

## 10. 添加禁止绕过样式系统注释

### 10.1 组件文件注释
- [x] 10.1.1 在所有迁移完成的组件文件顶部添加样式系统合规注释
- [x] 10.1.2 确保注释包含禁止使用的示例和正确使用的示例

### 10.2 代码验证
- [x] 10.2.1 搜索所有 `style={{` 模式，检查是否使用硬编码值
- [x] 10.2.2 搜索所有 `#` 开头的颜色值，确认已迁移到 CSS 变量
- [x] 10.2.3 搜索所有纯数字尺寸值，确认已迁移到 CSS 变量或 Tailwind 类

### 10.3 删除老旧代码
- [x] 10.3.1 删除 `globals.css` 中的旧颜色变量定义
- [x] 10.3.2 删除 `globals.css` 中的旧动画定义（已迁移到 tokens）
- [x] 10.3.3 删除组件中迁移后遗留的内联样式
- [x] 10.3.4 确认没有 `.backup` 文件存在

## 进度跟踪

- **总任务数**: 106
- **已完成**: 106
- **进行中**: 0
- **待完成**: 0

## 完成总结

✅ **所有任务已完成**

### 新增文件
- `src/styles/README.md` - 样式系统完整文档
- `src/styles/tokens/*.css` - 颜色、间距、字体、效果变量
- `src/styles/themes/*.css` - 浅色/深色主题
- `src/styles/utilities/*.css` - 工具类定义
- `src/styles/index.css` - 样式入口文件

### 修改文件
- **38 个组件文件** - 全部添加样式系统合规注释，迁移硬编码样式
- `tailwind.config.js` - 映射 CSS 变量到 Tailwind 类名
- `src/styles/globals.css` - 重构为模块化导入

### 删除文件
- `src/styles/globals.css.backup` - 已删除
- `tailwind.config.js.backup` - 已删除

### 验证结果
- ✅ 构建成功 (57.85s)
- ✅ 无 TypeScript 错误
- ✅ 无硬编码颜色残留
- ✅ 所有组件已添加合规性注释
