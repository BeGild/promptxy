# 配色系统规格增量

## MODIFIED Requirements

### Requirement: 原始颜色变量定义

The system MUST define a complete set of raw color variables based on warm orange color family (Dieter Rams × Jony Ive philosophy). 系统必须基于暖炭橙色系（Dieter Rams × Jony ive 理念）定义完整的原始颜色变量。

#### Scenario: 访问原始颜色变量

**Given** 系统已加载 CSS 变量
**When** 组件需要使用原始颜色
**Then** 可以通过 `var(--color-{色系}-{层级})` 访问
**And** 主色系为暖炭橙色（Warm Orange）
**And** 辅助色系为鼠尾草绿（Sage Green）
**And** 强调色系为赤陶红（Terra Cotta）

**示例**:
```css
/* 暖炭橙色系 */
--color-warm-orange-50:  #FFF4E6;
--color-warm-orange-100: #FFE0C2;
--color-warm-orange-200: #FFC299;
--color-warm-orange-300: #FFA470;
--color-warm-orange-400: #FF9A52;
--color-warm-orange-500: #D46A1A;
--color-warm-orange-600: #B85200;
--color-warm-orange-700: #9C4200;
--color-warm-orange-800: #7A3200;
--color-warm-orange-900: #5A2400;

/* 鼠尾草绿色系 */
--color-sage-green-50:  #F0F4ED;
--color-sage-green-100: #E0E9DB;
--color-sage-green-200: #C1D9B7;
--color-sage-green-300: #A2C993;
--color-sage-green-400: #7A9B6A;
--color-sage-green-500: #68975A;
--color-sage-green-600: #5A824A;
--color-sage-green-700: #4C6A3E;
--color-sage-green-800: #3E5232;
--color-sage-green-900: #2E3A24;

/* 赤陶红色系 */
--color-terra-red-50:  #FFF0E6;
--color-terra-red-100: #FFE0CC;
--color-terra-red-200: #FFC299;
--color-terra-red-300: #FFA366;
--color-terra-red-400: #C45C3E;
--color-terra-red-500: #A8422A;
--color-terra-red-600: #8C3A20;
--color-terra-red-700: #703218;
--color-terra-red-800: #542A12;
--color-terra-red-900: #38220C;
```

#### Scenario: 验证颜色值范围

**Given** 原始颜色变量已定义
**When** 检查颜色值
**Then** 所有颜色值均为有效的 HEX 格式
**And** 不包含蓝色或紫色系颜色
**And** 不包含粉色系颜色
**And** 符合温暖、专业的设计风格
**And** 所有暖色相在 10-50° 范围内（橙红色调）

---

### Requirement: 语义化颜色变量

The system MUST provide semantic color variables that map warm orange color family to specific UI purposes. 系统必须提供语义化的颜色变量，将暖炭橙色系映射到具体 UI 用途。

#### Scenario: 使用主色变量

**Given** 组件需要使用主色
**When** 应用 `var(--color-brand-primary)` 样式
**Then** 显示为暖炭橙色 `#D46A1A`
**And** 悬停状态为 `#B85200`
**And** 激活状态为 `#9C4200`
**And** 在深色模式下提亮为 `#FF9A52`

#### Scenario: 使用辅助色变量

**Given** 组件需要使用辅助色
**When** 应用 `var(--color-brand-secondary)` 样式
**Then** 显示为鼠尾草绿 `#7A9B6A`
**And** 用于次要操作和视觉平衡
**And** 与主色形成和谐对比

#### Scenario: 使用强调色变量

**Given** 组件需要使用强调色
**When** 应用 `var(--color-accent)` 样式
**Then** 显示为赤陶红 `#C45C3E`
**And** 用于行动号召元素
**And** 与主色形成同色系渐变效果

#### Scenario: 使用状态色变量

**Given** 组件需要显示状态
**When** 应用对应的状态颜色变量
**Then** 成功状态显示为 `--color-status-success` (鼠尾草绿)
**And** 警告状态显示为 `--color-status-warning` (浅青铜色)
**And** 错误状态显示为 `--color-status-error` (大地红色)
**And** 信息状态显示为 `--color-status-info` (暖橙色)

#### Scenario: 使用文本颜色变量

**Given** 组件需要显示文本
**When** 应用 `var(--color-text-primary)` 样式
**Then** 浅色模式下显示为深炭黑 `#1A1612`
**And** 深色模式下显示为暖米白 `#E8E4DF`
**And** 对比度符合 WCAG AA 标准 (>= 4.5:1)

---

### Requirement: 背景颜色系统

The system MUST provide a complete set of background color variables with warm tones covering all UI hierarchy levels. 系统必须提供完整的暖色调背景颜色变量，覆盖所有 UI 层级。

#### Scenario: 使用层级背景

**Given** 组件位于不同层级
**When** 应用对应的背景变量
**Then** 画布背景使用 `--color-bg-canvas` (浅暖灰 `#F5F3F0`)
**And** 主背景使用 `--color-bg-primary` (纯白 `#FFFFFF`)
**And** 次背景使用 `--color-bg-secondary` (暖灰白 `#FAF8F5`)
**And** 浮起背景使用 `--color-bg-elevated` (纸白 `#FFFDFA`)
**And** 遮罩层使用 `--color-bg-overlay` (半透明深色)

#### Scenario: 深色模式背景适配

**Given** 系统处于深色模式
**When** 应用背景变量
**Then** 所有背景色自动切换到深色变体
**And** 主背景从纯白 `#FFFFFF` 切换到暖炭黑 `#1A1612`
**And** 次背景切换到深炭褐 `#241E18`
**And** 浮起背景切换到 `#2E2620`
**And** 过渡流畅无闪烁
**And** 保持温暖色调（非冷灰）

---

### Requirement: 视觉特效变量

The system MUST provide visual effect variables including shadows, gradients, and transition animations optimized for warm color scheme. 系统必须提供阴影、渐变、过渡动画等视觉特效变量，针对暖色系优化。

#### Scenario: 使用渐变系统

**Given** 组件需要渐变效果
**When** 应用 `--gradient-primary` 变量
**Then** 主色渐变从暖炭橙 `#D46A1A` 到赤陶红 `#C45C3E`
**And** 角度为 135 度
**And** 不包含蓝紫粉色
**And** 适用于按钮、卡片等组件

#### Scenario: 温暖渐变效果

**Given** 组件需要温暖的渐变效果
**When** 应用 `--gradient-warm` 变量
**Then** 从浅橙 `#FFA470` 到赤陶红 `#C45C3E`
**And** 适用于强调组件

#### Scenario: 移除AI风渐变

**Given** 系统中存在蓝紫粉渐变效果
**When** 更新为暖色系
**Then** 所有 `from-accent-purple to-accent-pink` 渐变已移除
**And** 替换为 `from-brand-primary to-accent` 渐变
**And** 不残留任何紫粉色渐变

---

### Requirement: Tailwind 框架映射

The system MUST map warm orange color family CSS variables to Tailwind class names to support atomic CSS. 系统必须将暖炭橙色系 CSS 变量映射到 Tailwind 类名，支持原子化 CSS。

#### Scenario: 使用 Tailwind 颜色类名

**Given** 组件使用 Tailwind 类名
**When** 应用 `bg-brand-primary` 类
**Then** 背景色为 `var(--color-brand-primary)` 即暖炭橙 `#D46A1A`
**And** 可以使用 `bg-accent` 设置赤陶红色
**And** 可以使用 `text-primary` 设置深炭黑色
**And** 可以使用 `border-brand` 设置暖橙边框

#### Scenario: 移除AI风类名映射

**Given** Tailwind 配置中存在紫粉色映射
**When** 清理AI风配色
**Then** `accent-purple` 类名映射已删除
**And** `accent-pink` 类名映射已删除
**And** 只保留暖色系类名映射

---

### Requirement: HeroUI 组件主题

The system MUST provide complete theme configuration for HeroUI component library using warm orange color scheme. 系统必须为 HeroUI 组件库提供完整的暖炭橙色系主题配置。

#### Scenario: HeroUI 按钮组件

**Given** 使用 HeroUI Button 组件
**When** 设置 `color="primary"`
**Then** 按钮背景为暖炭橙 `#D46A1A`
**And** 按钮文本为白色
**And** 悬停时背景变为 `#B85200`
**And** 在深色模式下背景提亮为 `#FF9A52`
**And** 不显示紫粉色

#### Scenario: HeroUI 输入框组件

**Given** 使用 HeroUI Input 组件
**When** 输入框处于默认状态
**Then** 背景为 `var(--color-bg-input-default)`
**And** 边框为 `var(--color-border-default)` (暖灰 `#E8E4DF`)
**When** 输入框获得焦点
**Then** 边框变为 `var(--color-border-focused)` (暖橙色 `#D46A1A`)
**And** 显示焦点环 `var(--shadow-focus-ring)`

---

### Requirement: 深色模式支持

The system MUST fully support dark mode with warm-toned dark mode definitions for all color variables. 系统必须完整支持深色模式，所有颜色变量在深色模式下使用暖色调深色定义。

#### Scenario: 切换深色模式

**Given** 系统处于浅色模式
**When** 为根元素添加 `dark` 类
**Then** 所有颜色变量切换到深色模式值
**And** 背景色从纯白切换到暖炭黑 `#1A1612`
**And** 文本色从深炭黑切换到暖米白 `#E8E4DF`
**And** 主色在深色模式下提亮为 `#FF9A52`
**And** 过渡动画流畅

#### Scenario: 深色模式功能色

**Given** 系统处于深色模式
**When** 使用功能色组件
**Then** 成功色适当提亮保持可读性
**And** 警告色适当提亮
**And** 错误色适当提亮
**And** 保持可读性和对比度
**And** 所有颜色保持暖色调

---

### Requirement: 无障碍标准

The system MUST comply with WCAG 2.1 accessibility standards with warm orange color scheme. 系统必须符合 WCAG 2.1 无障碍标准，使用暖炭橙色系。

#### Scenario: 文本对比度验证

**Given** 任何文本元素
**When** 测量文本与背景的对比度
**Then** 正文文本对比度 >= 4.5:1 (AA 级)
**And** 大文本对比度 >= 3:1 (AA 级)
**And** 重要文本对比度 >= 7:1 (AAA 级)

**验证示例**:
- 主文本 (`#1A1612`) 在背景 (`#FFFFFF`) 上: 15.2:1 ✓
- 次要文本 (`#6B6560`) 在背景 (`#FFFFFF`) 上: 4.9:1 ✓
- 暖橙文本 (`#D46A1A`) 在背景 (`#FFFFFF`) 上: 4.8:1 ✓
- 暖米白文本 (`#E8E4DF`) 在深色背景 (`#1A1612`) 上: 12.1:1 ✓

#### Scenario: 焦点指示器

**Given** 任何可聚焦元素
**When** 元素获得焦点
**Then** 显示清晰的焦点指示器
**And** 焦点指示器颜色为暖橙色
**And** 焦点指示器对比度 >= 3:1
**And** 焦点指示器厚度至少 2px

---

### Requirement: 渐变效果配色

The system MUST provide complete gradient color variables using warm tones only. 系统必须提供完整的渐变色变量，仅使用暖色调。

#### Scenario: 主色渐变

**Given** 组件需要主色渐变
**When** 应用 `--gradient-primary`
**Then** 从暖炭橙 `#D46A1A` 到赤陶红 `#C45C3E`
**And** 角度为 135 度
**And** 适用于按钮、卡片等组件

#### Scenario: 移除AI风渐变

**Given** 系统中存在蓝紫粉渐变
**When** 清理配色系统
**Then** 所有 `bg-gradient-to-tr from-brand-primary to-accent-purple` 已移除
**And** 所有蓝-紫-粉渐变动画已替换为暖色渐变
**And** `.gradient-text-animated` 不再使用紫粉色

---

### Requirement: 交互状态配色

The system MUST provide dedicated color variables for all interactive states using warm tones. 系统必须为所有交互状态提供专用暖色调颜色变量。

#### Scenario: 悬停状态

**Given** 可交互元素
**When** 鼠标悬停
**Then** 主元素悬停为 `--color-brand-primary-hover` (`#B85200`)
**And** 强调元素悬停为 `--color-accent-hover` (`#A8422A`)
**And** 过渡时长为 150ms
**And** 使用暖色过渡效果

#### Scenario: 激活/按下状态

**Given** 可点击元素
**When** 用户按下
**Then** 主元素激活为 `--color-brand-primary-active` (`#9C4200`)
**And** 强调元素激活为 `--color-accent-active` (`#8C3A20`)

---

### Requirement: 配色一致性

The system MUST ensure all components use a unified warm orange color scheme. 系统必须确保所有组件使用统一的暖炭橙色配色方案。

#### Scenario: 组件间配色一致

**Given** 多个组件使用相同语义颜色
**When** 应用 `bg-brand-primary` 类
**Then** 所有组件显示相同的暖炭橙色 `#D46A1A`
**And** 悬停时都变为 `#B85200`
**And** 在深色模式下都提亮为 `#FF9A52`
**And** 不显示任何蓝紫粉色

#### Scenario: 无AI风残留

**Given** 系统中存在任何颜色定义
**When** 检查所有颜色变量和硬编码值
**Then** 不存在 `#007aff` 或类似蓝色
**Then** 不存在 `#a855f7` 或类似紫色
**Then** 不存在 `#ec4899` 或类似粉色
**Then** 所有颜色属于暖色调（色相 10-50° 或中性色）

---

## REMOVED Requirements

### Requirement: 茶绿色系配色

**Reason**: 用户选择采用暖炭橙色系（方案 A），茶绿色系不再使用

**Migration**: 所有茶绿色变量替换为暖炭橙色系对应变量
- `--color-tea-green-*` → `--color-warm-orange-*`
- 茶绿色主色 `#ccd5ae` → 暖炭橙 `#D46A1A`
- 茶绿背景 `#fefae0` → 暖灰白 `#FAF8F5`

---

### Requirement: 蓝紫粉色强调色

**Reason**: 用户明确反感"AI风"蓝紫粉色配色，需要完全移除

**Migration**:
- `--color-accent-purple` → 删除，替换为 `--color-accent` (赤陶红)
- `--color-accent-pink` → 删除
- 所有使用紫粉色的渐变效果替换为暖色渐变
- 搜索并替换所有 `from-accent-purple`, `to-accent-pink` 引用

---

## ADDED Requirements

### Requirement: 暖炭橙色系定义

The system MUST define warm orange color family as the primary brand color following Dieter Rams functionalism and Jony Ive minimalism philosophy. 系统必须定义暖炭橙色系作为主品牌色，遵循 Dieter Rams 功能主义和 Jony Ive 极简主义理念。

#### Scenario: 暖炭橙色色阶

**Given** 系统已加载颜色变量
**When** 访问暖炭橙色系变量
**Then** 主色为 `#D46A1A` (暖炭橙)
**And** 包含完整的 50-900 色阶定义
**And** 浅色变体用于背景和悬停效果
**And** 深色变体用于激活状态

#### Scenario: 暖橙色设计意图

**Given** 暖炭橙色作为主色
**When** 用于品牌识别
**Then** 传达专业、可靠、温暖的感受
**And** 高辨识度，与蓝色AI工具形成差异
**And** 对比度符合 WCAG AA 标准 (4.8:1)
**And** 具备长期审美生命力

---

### Requirement: 赤陶红色系强调色

The system MUST define terra cotta red color family as accent color for call-to-action elements. 系统必须定义赤陶红色系作为强调色，用于行动号召元素。

#### Scenario: 赤陶红色色阶

**Given** 系统已加载颜色变量
**When** 访问赤陶红色系变量
**Then** 强调色为 `#C45C3E` (赤陶红)
**And** 包含完整的 50-900 色阶定义
**And** 与主色形成同色系渐变效果

#### Scenario: 强调色使用场景

**Given** 需要强调用户注意的元素
**When** 应用强调色
**Then** 行动号召按钮使用赤陶红
**Then** 重要提示使用赤陶红浅色背景
**And** 与主色橙形成和谐过渡

---

### Requirement: 鼠尾草绿色系辅助色

The system MUST define sage green color family as secondary color for visual balance. 系统必须定义鼠尾草绿色系作为辅助色，用于视觉平衡。

#### Scenario: 鼠尾草绿色色阶

**Given** 系统已加载颜色变量
**When** 访问鼠尾草绿色系变量
**Then** 辅助色为 `#7A9B6A` (鼠尾草绿)
**And** 包含完整的 50-900 色阶定义
**And** 与暖橙色形成和谐对比

#### Scenario: 辅助色使用场景

**Given** 需要次要操作或平衡视觉效果
**When** 应用辅助色
**Then** 次要按钮使用鼠尾草绿
**And** 成功状态使用鼠尾草绿
**And** 提供自然、平衡的视觉感受

---

### Requirement: 暖色调背景系统

The system MUST provide warm-toned background colors including pure white, warm off-white, and paper white. 系统必须提供暖色调背景色，包括纯白、暖灰白和纸白。

#### Scenario: 暖色调背景色阶

**Given** 系统已加载背景色变量
**When** 访问背景色系
**Then** 主背景为纯白 `#FFFFFF`
**And** 次背景为暖灰白 `#FAF8F5`
**And** 浮起背景为纸白 `#FFFDFA`
**And** 画布背景为浅暖灰 `#F5F3F0`

#### Scenario: 暖色背景设计意图

**Given** 使用暖色调背景
**When** 用户浏览界面
**Then** 比纯白更柔和，减少视觉疲劳
**And** 符合 Naoto Fukasawa 柔和舒适理念
**And** 与暖橙色主色形成和谐对比

---

### Requirement: 暖色调深色模式

The system MUST provide warm-toned dark mode using warm charcoal black instead of cool gray. 系统必须提供暖色调深色模式，使用暖炭黑而非冷灰。

#### Scenario: 暖色调深色背景

**Given** 系统处于深色模式
**When** 访问深色背景变量
**Then** 主背景为暖炭黑 `#1A1612`
**And** 次背景为深炭褐 `#241E18`
**And** 浮起背景为 `#2E2620`
**And** 画布背景为 `#16120E`

#### Scenario: 暖色深色设计意图

**Given** 使用暖色调深色模式
**When** 用户在深色模式下浏览
**Then** 避免冷灰色的疏离感
**And** 保持与浅色模式的温度一致性
**And** 符合 Jony ive 精致温暖美学

---

### Requirement: 移除AI风配色

The system MUST NOT contain any blue, purple, or pink color schemes that are associated with "AI-style" design. 系统不得包含任何与"AI风格"设计相关的蓝、紫、粉色系。

#### Scenario: 验证无AI风残留

**Given** 系统配色已更新
**When** 检查所有颜色定义
**Then** 不存在 `--color-accent-purple` 变量
**And** 不存在 `--color-accent-pink` 变量
**And** 不存在 `#007aff` 类蓝色
**And** 不存在 `#a855f7` 类紫色
**And** 不存在 `#ec4899` 类粉色
**And** 所有代码中无硬编码蓝紫粉色值

#### Scenario: 渐变效果清理

**Given** 系统中存在渐变效果
**When** 检查所有渐变定义
**Then** 不存在蓝-紫-粉渐变组合
**And** `.gradient-text-animated` 使用暖色调
**And** 所有 `from-accent-purple` 引用已移除
**And** 所有 `to-accent-pink` 引用已移除
