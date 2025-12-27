# 设计文档：前端样式系统重构

## 上下文

### 当前状态

Promptxy 项目的前端样式存在以下问题：

1. **样式分散**：34 个组件文件中共 313 处内联样式
2. **硬编码严重**：
   - 硬编码颜色：`#007AFF`, `#0055D4`（LogoIcon.tsx）
   - 硬编码尺寸：`width: '44px'`, `fontSize: '16px'`, `gap: '8px'`
3. **HeroUI 深度集成**：23 个文件使用 HeroUI 组件（Button, Card, Input, Select 等）
4. **单主题支持**：当前仅支持深色主题

### 约束条件

1. **必须保留 HeroUI**：重新实现所有组件成本过高
2. **必须支持浅色主题**：用户需要明亮模式
3. **必须保持 4px 网格**：间距系统统一使用 4px 倍数
4. **渐进式迁移**：不能一次性重写所有组件

### 利益相关者

- 前端开发者：需要易于维护和扩展的样式系统
- 设计师：需要统一的视觉语言
- 用户：需要清晰的视觉体验和主题选择

## 目标 / 非目标

### 目标

- 创建统一的 CSS 变量系统（颜色、间距、字体、效果）
- 支持浅色/深色主题无缝切换
- 将 Tailwind 类名和 HeroUI 主题映射到 CSS 变量
- 提供类型安全的样式 API（TypeScript）
- 渐进式迁移现有组件的硬编码样式

### 非目标

- 完全替换 HeroUI 组件库
- 重新设计整体 UI 视觉风格
- 实现自定义组件构建系统
- 支持除 light/dark 外的其他主题

## 决策

### 决策 1：采用 CSS 变量 + HeroUI 主题覆盖方案

**选择**：保留 HeroUI 组件库，通过 CSS 变量和主题覆盖实现样式统一。

**理由**：
- HeroUI 已深度集成（23 个文件），重写成本过高
- HeroUI 提供完整的交互功能（无障碍、动画、键盘导航）
- 主题覆盖可以完全控制视觉表现
- Tailwind CSS 本身支持 CSS 变量映射

**替代方案**：

| 方案 | 优点 | 缺点 |
|-----|------|-----|
| A. 保留 HeroUI + 主题覆盖 | 改动小、风险低、快速交付 | 依赖第三方库 |
| B. 完全自定义组件 | 完全自主、包体积小 | 开发周期长（1-2月） |
| C. 混合方案 | 平衡自主性和成本 | 维护两套体系 |

### 决策 2：使用 4px 网格间距系统

**选择**：所有间距值为 4px 的倍数。

**定义**：
```css
--spacing-xs:  4px;   /* 0.25rem */
--spacing-sm:  8px;   /* 0.5rem */
--spacing-md:  16px;  /* 1rem */
--spacing-lg:  24px;  /* 1.5rem */
--spacing-xl:  32px;  /* 2rem */
--spacing-2xl: 48px;  /* 3rem */
```

**理由**：
- 与 Tailwind 默认间距系统一致
- 在大多数屏幕上提供良好的视觉节奏
- 便于计算和响应式缩放

### 决策 3：CSS 变量命名采用语义化 + 分层结构

**选择**：`--{分类}-{语义}-{层级}` 格式。

**示例**：
```css
/* 颜色 */
--color-bg-primary
--color-text-secondary
--color-brand-primary

/* 间距 */
--spacing-md
--spacing-lg

/* 字体 */
--font-size-sm
--font-weight-medium
```

**理由**：
- 语义化名称易于理解
- 分层结构便于扩展
- 与 Tailwind 命名习惯一致

### 决策 4：目录结构采用模块化分层

**选择**：
```
styles/
├── index.css           # 入口
├── tokens/             # 设计变量
├── utilities/          # 工具类
└── themes/             # 主题
```

**理由**：
- 分层清晰，职责明确
- 便于按需导入
- 易于维护和扩展

## 架构设计

### 五层样式系统

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: HeroUI 主题                                        │
│         组件库主题配置，引用 CSS 变量                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Tailwind 配置                                      │
│         将 CSS 变量映射到 Tailwind 类名                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 工具类                                             │
│         .card, .btn, .input 等可复用类                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 语义化变量                                         │
│         --color-bg-primary, --spacing-md 等                 │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 原始变量                                           │
│         :root 和 .dark 中的原始颜色值、尺寸值                 │
└─────────────────────────────────────────────────────────────┘
```

### 主题切换机制

使用 CSS 类切换：

```typescript
// 添加/移除 .dark 类
document.documentElement.classList.toggle('dark');
```

CSS 变量自动响应：

```css
:root {
  --color-bg-primary: #ffffff;
}

.dark {
  --color-bg-primary: #1e1e1e;
}
```

### Tailwind 配置映射

```javascript
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
        },
      },
      spacing: {
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
      },
    },
  },
  darkMode: 'class', // 使用 .dark 类切换
};
```

### HeroUI 主题继承

```javascript
heroui({
  themes: {
    light: {
      colors: {
        background: 'var(--color-bg-primary)',
        foreground: 'var(--color-text-primary)',
        primary: {
          DEFAULT: 'var(--color-brand-primary)',
        },
      },
    },
    dark: {
      colors: {
        background: 'var(--color-bg-primary)',
        foreground: 'var(--color-text-primary)',
        primary: {
          DEFAULT: 'var(--color-brand-primary)',
        },
      },
    },
  },
}),
```

## 风险 / 权衡

### 风险 1：HeroUI 组件样式覆盖不完整

**风险**：某些 HeroUI 组件的内部样式可能无法完全通过主题配置控制。

**缓解措施**：
1. 优先使用主题配置
2. 必要时使用 `:global` 或高优先级选择器覆盖
3. 在迁移阶段验证每个组件

### 风险 2：主题切换时的视觉闪烁

**风险**：切换主题时可能出现短暂的颜色闪烁。

**缓解措施**：
1. 在 `<head>` 中尽早加载 CSS
2. 使用 localStorage + 媒体查询预先检测主题
3. 添加过渡动画平滑切换

### 风险 3：现有组件迁移遗漏

**风险**：34 个文件中可能有硬编码样式被遗漏。

**缓解措施**：
1. 使用正则表达式搜索硬编码模式
2. 代码审查时重点检查 `style={{...}}`
3. 分批迁移，每批验证后再继续

### 权衡：自定义工具类 vs 直接使用 Tailwind

**选择**：两者结合使用。

- **简单样式**：直接使用 Tailwind 类名（`p-md bg-elevated`）
- **复杂组件**：定义语义化工具类（`.card`, `.btn-primary`）
- **动态样式**：使用 CSS 变量（`style={{ padding: 'var(--spacing-md)' }}`）

**理由**：
- 保持灵活性
- 避免过度抽象
- 符合 Tailwind 最佳实践

## 迁移计划

### 迁移策略

**渐进式迁移**：按组件优先级分批迁移。

**优先级判定**：

| 优先级 | 组件类型 | 理由 |
|-------|---------|------|
| P0 | 公共基础组件 | 使用频率高，影响范围大 |
| P1 | 布局组件 | 结构基础，影响整体 |
| P2 | 业务组件 | 功能相关，相对独立 |

### 迁移步骤

**Phase 1: 建立样式系统**（不影响现有功能）

1. 创建 `styles/tokens/` 目录结构
2. 定义所有 CSS 变量（light/dark）
3. 更新 `tailwind.config.js`
4. 映射 HeroUI 主题
5. 创建 TypeScript 类型定义

**Phase 2: 组件渐进式迁移**

P0 组件（高优先级）：
- `LogoIcon.tsx` - 硬编码颜色
- `StatusIndicator.tsx` - 状态颜色
- `EmptyState.tsx`
- `ErrorBoundary.tsx`

P1 组件（中优先级）：
- `Sidebar.tsx`
- `Header.tsx`

P2 组件（低优先级）：
- `RulesPage`, `RequestsPage`
- `RuleList`, `RequestList`

**Phase 3: 清理与优化**

1. 删除迁移组件中的所有内联样式
2. 删除 `globals.css` 中的旧样式定义
3. 统一组件的样式命名
4. 添加禁止绕过样式系统的代码注释
5. 编写样式使用文档
6. 添加样式 lint 规则

### 禁止绕过样式系统

**原则**：所有样式必须通过 CSS 变量或 Tailwind 类名实现，禁止硬编码。

**代码注释要求**：

在组件文件顶部添加警告注释：

```typescript
/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - style={{ color: '#007acc' }}
 * - style={{ padding: '16px' }}
 * - style={{ width: '44px' }}
 *
 * ✅ REQUIRED:
 * - className="text-brand"
 * - style={{ padding: 'var(--spacing-md)' }}
 * - style={{ width: 'var(--size-sidebar)' }}
 */
```

**ESLint 规则**（建议添加）：

```javascript
{
  rules: {
    // 禁止硬编码颜色（除了透明度）
    'no-hard-coded-colors': 'error',
    // 禁止在 JSX 中使用 style 属性（除非使用 CSS 变量）
    'react/style-prop-object': 'off',
    'react/no-inline-styles-with-vars': 'error',
  }
}
```

**验证方法**：
1. 代码审查时搜索 `style={{` 模式
2. 检查是否包含 `#` 开头的颜色值
3. 检查是否包含纯数字尺寸值（如 `16`, `8`）

## 开放问题

1. **是否需要提供样式钩子（`useStyles`）？**
   - 选项 A：提供 - 更类型安全，但增加抽象层
   - 选项 B：不提供 - 直接使用 CSS 变量，更灵活

2. **是否需要支持自定义主题色？**
   - 选项 A：支持 - 允许用户自定义品牌色
   - 选项 B：不支持 - 简化实现，保持一致性

3. **动画过渡是否统一配置？**
   - 选项 A：统一 - 所有状态变化使用相同的过渡参数
   - 选项 B：按需 - 不同组件使用不同的过渡效果
