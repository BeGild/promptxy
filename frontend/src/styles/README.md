# 样式系统文档

## 概述

本样式系统采用**语义化 CSS 变量 + Tailwind CSS + HeroUI 主题覆盖**架构，实现统一、可维护的样式管理。

## 目录结构

```
styles/
├── index.css              # 样式入口文件（导入 tokens 和 Tailwind）
├── globals.css            # 全局样式（滚动条、动画、工具类）
├── tokens/                # 设计 tokens（CSS 变量定义）
│   ├── colors.css         # 颜色变量系统
│   ├── spacing.css        # 间距变量系统（4px 网格）
│   ├── typography.css     # 字体变量系统
│   ├── effects.css        # 阴影、圆角等效果变量
│   └── index.css          # 合并所有 tokens
├── themes/                # 主题变量
│   ├── light.css          # 浅色主题
│   └── dark.css           # 深色主题
└── utilities/             # 工具类（可选）
    ├── layout.css         # 布局工具类
    └── components.css     # 组件样式类
```

## CSS 变量命名规范

采用 **语义化 + 分层** 命名格式：

```css
/* 格式: --{分类}-{语义}-{层级} */
```

### 颜色变量

```css
/* 背景色 */
--color-bg-primary      /* 主背景色 */
--color-bg-secondary    /* 次级背景色 */
--color-bg-canvas       /* 画布背景 */
--color-bg-elevated     /* 浮层背景 */

/* 文本色 */
--color-text-primary    /* 主文本 */
--color-text-secondary  /* 次级文本 */
--color-text-tertiary   /* 三级文本 */

/* 品牌色 */
--color-brand-primary   /* 主品牌色 */

/* 强调色 */
--color-accent          /* 强调色（赤陶红） */

/* 状态色 */
--color-status-success  /* 成功状态 */
--color-status-error    /* 错误状态 */
--color-status-warning  /* 警告状态 */

/* 边框色 */
--color-border-subtle   /* 微妙边框 */
--color-border-default  /* 默认边框 */
```

### 间距变量（4px 网格系统）

```css
--spacing-xs   4px   /* 0.25rem */
--spacing-sm   8px   /* 0.5rem */
--spacing-md   16px  /* 1rem */
--spacing-lg   24px  /* 1.5rem */
--spacing-xl   32px  /* 2rem */
--spacing-2xl  48px  /* 3rem */
--spacing-3xl  64px  /* 4rem */
```

### 字体变量

```css
--font-family-base      /* 基础字体 */
--font-family-mono      /* 等宽字体 */
--font-size-xs   12px
--font-size-sm   14px
--font-size-md   16px
--font-size-lg   18px
--font-size-xl   20px
```

### 效果变量

```css
--radius-sm   4px
--radius-md   8px
--radius-lg   12px

--shadow-sm   /* 小阴影 */
--shadow-md   /* 中阴影 */
--shadow-lg   /* 大阴影 */
```

## Tailwind CSS 映射

CSS 变量已映射到 Tailwind 语义类名，优先使用 Tailwind 类名：

| 语义类名              | 对应 CSS 变量            | 示例                                     |
| --------------------- | ------------------------ | ---------------------------------------- |
| `text-primary`        | `--color-text-primary`   | `<h1 className="text-primary">`          |
| `bg-elevated`         | `--color-bg-elevated`    | `<div className="bg-elevated">`          |
| `border-subtle`       | `--color-border-subtle`  | `<div className="border border-subtle">` |
| `p-md`                | `--spacing-md`           | `<div className="p-md">`                 |
| `text-status-success` | `--color-status-success` | `<span className="text-status-success">` |

## 主题切换

### 使用方式

主题通过 `<html>` 标签的 `class` 属性控制：

```tsx
// 浅色模式
document.documentElement.classList.remove('dark');
document.documentElement.classList.add('light');

// 深色模式
document.documentElement.classList.remove('light');
document.documentElement.classList.add('dark');
```

### 主题持久化

主题状态保存在 `localStorage`，键名为 `theme`：

```typescript
// 保存主题
localStorage.setItem('theme', 'dark');

// 读取主题
const theme = localStorage.getItem('theme') || 'system';
```

### 系统主题检测

```typescript
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
```

## 组件样式迁移指南

### ⚠️ 样式系统合规性要求

**禁止使用硬编码样式值！** 所有样式必须使用：

1. **Tailwind 语义类名**（如 `p-md`, `bg-elevated`, `text-primary`）
2. **CSS 变量**（如 `var(--spacing-md)`, `var(--color-bg-primary)`）
3. **语义化工具类**（如 `.card`, `.btn`）

### ❌ 禁止的写法

```tsx
// 硬编码颜色
className="text-gray-500"
className="from-green-600 to-blue-600"
style={{ color: '#D46A1A' }}

// 硬编码背景
className="bg-white dark:bg-gray-900"
className="bg-blue-50/30"
style={{ backgroundColor: '#f5f5f5' }}
```

### ✅ 正确的写法

```tsx
// 使用语义类名
className="text-secondary"
className="from-status-success to-brand-primary"
className="bg-elevated dark:bg-secondary"

// 使用 CSS 变量
style={{ color: 'var(--color-text-primary)' }}
style={{ padding: 'var(--spacing-md)' }}
```

### 迁移步骤

1. **添加合规性注释**：在组件文件顶部添加样式系统合规注释
2. **替换颜色类**：将 `text-gray-*` / `bg-gray-*` 替换为语义类名
3. **替换品牌色**：将 `blue/green/red/yellow/purple/orange` 替换为对应语义色
4. **替换边框色**：将 `border-gray-*` 替换为 `border-subtle` 等
5. **验证效果**：检查浅色/深色模式下的显示效果

### 样式映射参考

| 原硬编码值              | 语义化替代              |
| ----------------------- | ----------------------- |
| `text-gray-900/100`     | `text-primary`          |
| `text-gray-700/300`     | `text-secondary`        |
| `text-gray-600/400/500` | `text-tertiary`         |
| `bg-white/gray-50/100`  | `bg-elevated/bg-canvas` |
| `bg-gray-800/900/950`   | `bg-secondary` (dark)   |
| `border-gray-200/700`   | `border-subtle`         |
| `text-green-700/600`    | `text-status-success`   |
| `text-red-700/600`      | `text-status-error`     |
| `text-yellow-700/600`   | `text-status-warning`   |
| `text-blue-700/600`     | `text-brand-primary`    |
| `bg-blue-50/100`        | `bg-brand-primary/10`   |
| `text-purple-700/600`   | `text-accent`           |
| `text-pink-700/600`     | `text-accent`           |
| `text-orange-700/600`   | `text-status-warning`   |

## HeroUI 主题配置

HeroUI 组件通过主题配置继承 CSS 变量，配置位于 `tailwind.config.js`：

```javascript
theme: {
  colors: {
    background: 'var(--color-bg-primary)',
    foreground: 'var(--color-text-primary)',
    primary: {
      DEFAULT: 'var(--color-brand-primary)',
      // ...
    },
    // ...
  }
}
```

## 常见问题

### Q: 如何添加新的颜色变量？

1. 在 `tokens/colors.css` 中定义变量
2. 在 `tailwind.config.js` 中映射到类名
3. 在浅色/深色主题中分别定义值

### Q: 如何自定义组件样式？

优先使用 Tailwind 类名组合。复杂组件可创建语义化工具类：

```css
/* utilities/components.css */
.card {
  @apply bg-elevated border border-subtle rounded-lg p-md;
}

.btn {
  @apply px-md py-sm rounded-md bg-brand-primary text-white;
}
```

### Q: 深色模式样式不生效？

确保：

1. Tailwind 配置中设置了 `darkMode: 'class'`
2. 组件类名中使用了 `dark:` 前缀（如 `dark:bg-secondary`）
3. 主题切换正确添加/移除了 `dark` class

## 相关资源

- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [HeroUI 主题定制](https://heroui.com/docs/customization/theme)
- [CSS 变量规范](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
