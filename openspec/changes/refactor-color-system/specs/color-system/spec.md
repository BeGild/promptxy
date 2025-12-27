# 配色系统规格

## ADDED Requirements

### Requirement: 原始颜色变量定义

The system MUST define a complete set of raw color variables including all color families and scale levels. 系统必须定义完整的原始颜色变量，包括所有色系和层级。

#### Scenario: 访问原始颜色变量

**Given** 系统已加载 CSS 变量
**When** 组件需要使用原始颜色
**Then** 可以通过 `var(--color-{色系}-{层级})` 访问
**And** 所有色系包含 50-900 的层级定义

**示例**:
```css
/* 茶绿色系 */
--color-tea-green-50: #f5f7ef;
--color-tea-green-100: #ebeedf;
--color-tea-green-200: #e1e6cf;
--color-tea-green-300: #d6debe;
--color-tea-green-400: #ccd5ae;
--color-tea-green-500: #b8c49a;
--color-tea-green-600: #9aad81;
--color-tea-green-700: #7c9668;
--color-tea-green-800: #5e7f4f;
--color-tea-green-900: #2d331a;
```

#### Scenario: 验证颜色值范围

**Given** 原始颜色变量已定义
**When** 检查颜色值
**Then** 所有颜色值均为有效的 HEX 格式
**And** 不包含蓝色或紫色系颜色
**And** 符合自然温润的设计风格

---

### Requirement: 语义化颜色变量

The system MUST provide semantic color variables that map raw colors to specific UI purposes. 系统必须提供语义化的颜色变量，将原始颜色映射到具体 UI 用途。

#### Scenario: 使用主色变量

**Given** 组件需要使用主色
**When** 应用 `var(--color-primary)` 样式
**Then** 显示为茶绿色 `#ccd5ae`
**And** 在深色模式下保持一致

#### Scenario: 使用状态色变量

**Given** 组件需要显示状态
**When** 应用对应的状态颜色变量
**Then** 成功状态显示为 `--color-success` (茶绿色)
**And** 警告状态显示为 `--color-warning` (青铜色)
**And** 错误状态显示为 `--color-error` (大地红色)

#### Scenario: 使用文本颜色变量

**Given** 组件需要显示文本
**When** 应用 `var(--color-text-base)` 样式
**Then** 浅色模式下显示为深茶绿色 `#2d331a`
**And** 深色模式下显示为米白色 `#ebeedf`
**And** 对比度符合 WCAG AA 标准 (>= 4.5:1)

---

### Requirement: 背景颜色系统

The system MUST provide a complete set of background color variables covering all UI hierarchy levels. 系统必须提供完整的背景颜色变量，覆盖所有 UI 层级。

#### Scenario: 使用层级背景

**Given** 组件位于不同层级
**When** 应用对应的背景变量
**Then** 画布背景使用 `--color-bg-canvas` (米白色)
**And** 面板背景使用 `--color-bg-panel` (浅米色)
**And** 卡片背景使用 `--color-bg-card` (米色)
**And** 遮罩层使用 `--color-bg-overlay` (半透明深色)

#### Scenario: 深色模式背景适配

**Given** 系统处于深色模式
**When** 应用背景变量
**Then** 所有背景色自动切换到深色变体
**And** 背景色从米白 (`#fefae0`) 切换到深茶绿 (`#2d331a`)
**And** 过渡流畅无闪烁

---

### Requirement: 视觉特效变量

The system MUST provide visual effect variables including shadows, gradients, and transition animations. 系统必须提供阴影、渐变、过渡动画等视觉特效变量。

#### Scenario: 使用阴影系统

**Given** 组件需要阴影效果
**When** 应用 `--shadow-{size}` 变量
**Then** 小阴影使用 `--shadow-sm`
**And** 中等阴影使用 `--shadow-md`
**And** 大阴影使用 `--shadow-lg`
**And** 下拉菜单使用 `--shadow-dropdown`
**And** 模态框使用 `--shadow-modal`

#### Scenario: 使用渐变系统

**Given** 组件需要渐变效果
**When** 应用 `--gradient-{type}` 变量
**Then** 主色渐变使用 `--gradient-primary`
**And** 温暖渐变使用 `--gradient-warm`
**And** 柔和渐变使用 `--gradient-subtle`

#### Scenario: 使用过渡动画

**Given** 组件需要过渡效果
**When** 应用过渡变量
**Then** 快速过渡使用 `--transition-fast` (150ms)
**And** 正常过渡使用 `--transition-normal` (200ms)
**And** 缓动函数使用 `--easing-smooth`

---

### Requirement: Tailwind 框架映射

The system MUST map CSS variables to Tailwind class names to support atomic CSS. 系统必须将 CSS 变量映射到 Tailwind 类名，支持原子化 CSS。

#### Scenario: 使用 Tailwind 颜色类名

**Given** 组件使用 Tailwind 类名
**When** 应用 `bg-primary` 类
**Then** 背景色为 `var(--color-primary)`
**And** 可以使用 `bg-primary-{50-900}` 访问不同层级
**And** 可以使用 `text-primary` 设置文本色
**And** 可以使用 `border-primary` 设置边框色

#### Scenario: 使用 Tailwind 阴影类名

**Given** 组件需要阴影
**When** 应用 `shadow-card` 类
**Then** 阴影为 `var(--shadow-card)`
**And** 可以使用 `shadow-sm/md/lg/xl/2xl` 等预设
**And** 可以使用 `shadow-focus-ring` 实现焦点效果

#### Scenario: 使用 Tailwind 过渡类名

**Given** 组件需要过渡
**When** 应用 `transition-colors` 类
**Then** 使用 `var(--transition-colors)` 定义的过渡
**And** 时长为 150ms
**And** 缓动为 cubic-bezier(0.4, 0, 0.2, 1)

---

### Requirement: HeroUI 组件主题

The system MUST provide complete theme configuration for HeroUI component library. 系统必须为 HeroUI 组件库提供完整的主题配置。

#### Scenario: HeroUI 按钮组件

**Given** 使用 HeroUI Button 组件
**When** 设置 `color="primary"`
**Then** 按钮背景为茶绿色 `#ccd5ae`
**And** 按钮文本为深茶绿色 `#2d331a`
**And** 悬停时背景变为 `#b8c49a`
**And** 在深色模式下保持一致

#### Scenario: HeroUI 输入框组件

**Given** 使用 HeroUI Input 组件
**When** 输入框处于默认状态
**Then** 背景为 `var(--color-bg-input-default)`
**And** 边框为 `var(--color-border-default)`
**When** 输入框获得焦点
**Then** 边框变为 `var(--color-border-focused)`
**And** 显示焦点环 `var(--shadow-focus-ring)`

#### Scenario: HeroUI 模态框组件

**Given** 使用 HeroUI Modal 组件
**When** 模态框打开
**Then** 背景遮罩使用 `var(--color-bg-overlay)`
**And** 模态框背景使用 `var(--color-bg-modal)`
**And** 模态框阴影使用 `var(--shadow-modal)`

---

### Requirement: 深色模式支持

The system MUST fully support dark mode with corresponding dark mode definitions for all color variables. 系统必须完整支持深色模式，所有颜色变量在深色模式下有对应定义。

#### Scenario: 切换深色模式

**Given** 系统处于浅色模式
**When** 为根元素添加 `dark` 类
**Then** 所有颜色变量切换到深色模式值
**And** 背景色从米白变为深茶绿
**And** 文本色从深茶绿变为米白
**And** 过渡动画流畅

#### Scenario: 深色模式功能色

**Given** 系统处于深色模式
**When** 使用功能色组件
**Then** 成功色适当提亮 (从 `#7c9668` 到 `#9aad81`)
**And** 警告色适当提亮 (从 `#d4a373` 到 `#faedcd`)
**And** 错误色适当提亮 (从 `#e8998c` 到 `#ffb399`)
**And** 保持可读性和对比度

#### Scenario: 深色模式阴影

**Given** 系统处于深色模式
**When** 组件使用阴影
**Then** 阴影颜色切换到黑色半透明
**And** 小阴影为 `rgba(0, 0, 0, 0.3)`
**And** 大阴影为 `rgba(0, 0, 0, 0.6)`
**And** 增强深度感

---

### Requirement: 无障碍标准

The system MUST comply with WCAG 2.1 accessibility standards. 系统必须符合 WCAG 2.1 无障碍标准。

#### Scenario: 文本对比度验证

**Given** 任何文本元素
**When** 测量文本与背景的对比度
**Then** 正文文本对比度 >= 4.5:1 (AA 级)
**And** 大文本对比度 >= 3:1 (AA 级)
**And** 重要文本对比度 >= 7:1 (AAA 级)

**验证示例**:
- 主文本 (`#2d331a`) 在背景 (`#fefae0`) 上: 14.2:1 ✓
- 次要文本 (`#5b6635`) 在背景 (`#fefae0`) 上: 7.3:1 ✓

#### Scenario: 组件对比度验证

**Given** 任何交互组件（按钮、输入框等）
**When** 测量组件边框与背景的对比度
**Then** 对比度 >= 3:1 (AA 级)

#### Scenario: 焦点指示器

**Given** 任何可聚焦元素
**When** 元素获得焦点
**Then** 显示清晰的焦点指示器
**And** 焦点指示器对比度 >= 3:1
**And** 焦点指示器厚度至少 2px

**实现**:
```css
:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

---

### Requirement: 代码高亮配色

The system MUST provide dedicated color scheme for code display. 系统必须为代码显示提供专用配色方案。

#### Scenario: 代码语法高亮

**Given** 显示代码内容
**When** 应用代码高亮样式
**Then** 关键字使用 `--color-code-keyword` (青铜色)
**And** 字符串使用 `--color-code-string` (茶绿色)
**And** 注释使用 `--color-code-comment` (浅茶绿)
**And** 函数使用 `--color-code-function` (木瓜色)
**And** 背景使用 `--color-code-background` (浅米色)

#### Scenario: 代码选中效果

**Given** 用户选中代码
**When** 应用选中样式
**Then** 选中背景为 `--color-code-selection`
**And** 为茶绿色的半透明效果
**And** 保持文本可读性

---

### Requirement: 滚动条样式

The system MUST provide custom scrollbar styles consistent with application color scheme. 系统必须提供自定义滚动条样式，与应用配色一致。

#### Scenario: 浅色模式滚动条

**Given** 系统处于浅色模式
**When** 元素可滚动
**Then** 滚动条轨道为 `--color-scrollbar-track` (浅米色)
**And** 滚动条滑块为 `--color-scrollbar-thumb` (茶绿色)
**And** 悬停时滑块变为 `--color-scrollbar-thumb-hover` (深茶绿)

#### Scenario: 深色模式滚动条

**Given** 系统处于深色模式
**When** 元素可滚动
**Then** 滚动条轨道为 `--color-scrollbar-track` (深茶绿)
**And** 滚动条滑块为 `--color-scrollbar-thumb` (茶绿 600)
**And** 与深色背景协调

---

### Requirement: 状态指示器配色

The system MUST provide dedicated colors for various status indicators. 系统必须为各种状态指示器提供专用颜色。

#### Scenario: 连接状态指示器

**Given** 显示连接状态
**When** 状态为在线
**Then** 指示器为 `--color-status-online` (成功绿色)
**And** 带有脉冲动画
**When** 状态为离线
**Then** 指示器为 `--color-status-offline` (灰色)
**When** 状态为连接中
**Then** 指示器为 `--color-status-connecting` (信息色)
**And** 带有脉冲动画

#### Scenario: 数据趋势指示器

**Given** 显示数据变化
**When** 数据为正向增长
**Then** 使用 `--color-data-positive` (深茶绿色)
**When** 数据为负向变化
**Then** 使用 `--color-data-negative` (大地红色)
**When** 数据无变化
**Then** 使用 `--color-data-neutral` (灰色)

---

### Requirement: 交互状态配色

The system MUST provide dedicated color variables for all interactive states. 系统必须为所有交互状态提供专用颜色变量。

#### Scenario: 悬停状态

**Given** 可交互元素
**When** 鼠标悬停
**Then** 主元素背景为 `--color-hover-bg-primary`
**And** 次要元素背景为 `--color-hover-bg-secondary`
**And** 表面元素背景为 `--color-hover-bg-surface`
**And** 过渡时长为 150ms

#### Scenario: 焦点状态

**Given** 可聚焦元素
**When** 元素获得焦点
**Then** 显示焦点环 `--shadow-focus-ring`
**And** 焦点环颜色为 `--color-focus-ring`
**And** 焦点环厚度为 3px

#### Scenario: 激活/按下状态

**Given** 可点击元素
**When** 用户按下
**Then** 主元素背景为 `--color-active-bg-primary`
**And** 次要元素背景为 `--color-active-bg-secondary`
**And** 表面元素背景为 `--color-active-bg-surface`

#### Scenario: 选中状态

**Given** 可选择元素
**When** 元素被选中
**Then** 背景为 `--color-selected-bg`
**And** 边框为 `--color-selected-border`
**And** 清晰表示选中状态

---

### Requirement: 渐变效果配色

The system MUST provide complete gradient color variables. 系统必须提供完整的渐变色变量。

#### Scenario: 主色渐变

**Given** 组件需要主色渐变
**When** 应用 `--gradient-primary`
**Then** 从茶绿色 400 (`#ccd5ae`) 到茶绿色 600 (`#7c9668`)
**And** 角度为 135 度
**And** 适用于按钮、卡片等组件

#### Scenario: 温暖渐变

**Given** 组件需要温暖渐变
**When** 应用 `--gradient-warm`
**Then** 从木瓜色 (`#faedcd`) 到青铜色 (`#d4a373`)
**And** 适用于强调组件

#### Scenario: 遮罩渐变

**Given** 需要渐变遮罩效果
**When** 应用遮罩渐变变量
**Then** 顶部遮罩使用 `--gradient-overlay-top`
**And** 底部遮罩使用 `--gradient-overlay-bottom`
**And** 左侧遮罩使用 `--gradient-overlay-left`
**And** 右侧遮罩使用 `--gradient-overlay-right`

---

### Requirement: 玻璃拟态效果

The system MUST support glassmorphism effects. 系统必须支持玻璃拟态（Glassmorphism）效果。

#### Scenario: 浅色模式玻璃拟态

**Given** 系统处于浅色模式
**When** 应用 `.glass` 类
**Then** 背景为半透明白色
**And** 应用 10px 模糊效果
**And** 边框为半透明白色

#### Scenario: 深色模式玻璃拟态

**Given** 系统处于深色模式
**When** 应用 `.glass` 类
**Then** 背景为半透明黑色
**And** 应用 10px 模糊效果
**And** 边框为半透明白色

---

### Requirement: 动画效果配色

The system MUST provide color support for various animations. 系统必须为各种动画提供配色支持。

#### Scenario: 脉冲动画

**Given** 状态指示器组件
**When** 应用 `.status-pulse` 类
**Then** 透明度在 1 到 0.5 之间循环
**And** 动画时长为 2 秒
**And** 使用缓动函数

#### Scenario: 加载动画

**Given** 需要显示加载状态
**When** 应用 `.skeleton` 类
**Then** 背景为渐变动画
**And** 从浅色到深色循环
**And** 动画时长为 2 秒

#### Scenario: 渐变文字动画

**Given** 需要渐变文字效果
**When** 应用 `.gradient-text-animated` 类
**Then** 背景为茶绿、青铜、木瓜渐变
**And** 渐变位置动画循环
**And** 文字为透明以显示背景

---

### Requirement: 图标颜色

The system MUST provide complete color variables for icons. 系统必须为图标提供完整的颜色变量。

#### Scenario: 默认图标颜色

**Given** 显示图标
**When** 应用 `--color-icon-default`
**Then** 浅色模式下为次要文本色
**And** 深色模式下为浅米色
**And** 保持适当的对比度

#### Scenario: 语义化图标颜色

**Given** 图标需要表示特定状态
**When** 应用对应的颜色变量
**Then** 成功图标使用 `--color-icon-success`
**And** 警告图标使用 `--color-icon-warning`
**And** 错误图标使用 `--color-icon-error`
**And** 信息图标使用 `--color-icon-info`

---

### Requirement: 边框和分割线

The system MUST provide dedicated colors for borders and dividers. 系统必须为边框和分割线提供专用颜色。

#### Scenario: 默认边框

**Given** 组件需要边框
**When** 应用 `--color-border-default`
**Then** 浅色模式下为浅茶绿色
**And** 深色模式下为深茶绿色
**And** 1px 宽度

#### Scenario: 状态边框

**Given** 输入框或表单组件
**When** 处于不同状态
**Then** 默认边框为 `--color-border-default`
**And** 焦点边框为 `--color-border-focused`
**And** 错误边框为 `--color-border-error`
**And** 成功边框为 `--color-border-success`

#### Scenario: 分割线

**Given** 需要分割内容
**When** 应用分割线样式
**Then** 默认分割线为 `--color-divider-default`
**And** 强调分割线为 `--color-divider-strong`
**And** 浅色分割线为 `--color-divider-subtle`

---

### Requirement: 配色一致性

The system MUST ensure all components use a unified color scheme. 系统必须确保所有组件使用统一的配色方案。

#### Scenario: 组件间配色一致

**Given** 多个组件使用相同语义颜色
**When** 应用 `bg-primary` 类
**Then** 所有组件显示相同的茶绿色
**And** 悬停时都变为相同的深茶绿色
**And** 在深色模式下保持一致

#### Scenario: 配色变量优先级

**Given** 组件有多个颜色来源
**When** 应用样式
**Then** CSS 变量优先级最高
**And** Tailwind 类名次之
**And** 默认样式最低

**优先级示例**:
1. `style={{ color: 'var(--color-primary)' }}`
2. `className="text-primary"`
3. 默认组件样式
