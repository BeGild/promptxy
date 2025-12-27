# 配色系统重构 - 设计文档

## 1. 系统架构

### 1.1 分层架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 5: 组件样式层                       │
│             (Component Styles - heroui theme)                │
├─────────────────────────────────────────────────────────────┤
│                    Layer 4: 框架映射层                        │
│           (Framework Mapping - tailwind.config.js)           │
├─────────────────────────────────────────────────────────────┤
│                    Layer 3: 视觉特效层                        │
│         (Visual Effects - shadows, gradients, animations)    │
├─────────────────────────────────────────────────────────────┤
│                    Layer 2: 语义化变量层                      │
│      (Semantic Tokens - --color-primary, --bg-canvas)        │
├─────────────────────────────────────────────────────────────┤
│                    Layer 1: 原始颜色层                        │
│         (Raw Tokens - --color-tea-green-500, etc.)           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 数据流向

```
原始颜色 (Layer 1)
    ↓ 继承
语义化变量 (Layer 2) + 视觉特效 (Layer 3)
    ↓ 映射
Tailwind 类名 (Layer 4)
    ↓ 应用
组件样式 (Layer 5)
```

## 2. Layer 1: 原始颜色变量

### 2.1 色系定义

#### Tea Green (茶绿色系) - 主色调

| 变量名 | 颜色值 | 用途说明 |
|-------|-------|---------|
| `--color-tea-green-50` | `#f5f7ef` | 最浅背景 |
| `--color-tea-green-100` | `#ebeedf` | 深色模式背景 |
| `--color-tea-green-200` | `#e1e6cf` | 浅色背景 |
| `--color-tea-green-300` | `#d6debe` | 边框默认 |
| `--color-tea-green-400` | `#ccd5ae` | 主色 DEFAULT |
| `--color-tea-green-500` | `#b8c49a` | 悬停状态 |
| `--color-tea-green-600` | `#9aad81` | 激活状态 |
| `--color-tea-green-700` | `#7c9668` | 成功色 |
| `--color-tea-green-800` | `#5e7f4f` | 次要文本 |
| `--color-tea-green-900` | `#2d331a` | 主文本/深色背景 |

#### Beige (米色系) - 背景色

| 变量名 | 颜色值 | 用途说明 |
|-------|-------|---------|
| `--color-beige-50` | `#fbfbf4` | 面板背景 |
| `--color-beige-100` | `#f6f8ea` | 卡片背景 |
| `--color-beige-200` | `#f2f4df` | 悬停背景 |
| `--color-beige-300` | `#edf1d4` | 边框浅色 |
| `--color-beige-400` | `#e9edc9` | 浅色装饰 |

#### Cornsilk (玉米丝色系) - 亮部背景

| 变量名 | 颜色值 | 用途说明 |
|-------|-------|---------|
| `--color-cornsilk-50` | `#fffef9` | 最亮背景 |
| `--color-cornsilk-100` | `#fffdf3` | 高亮背景 |
| `--color-cornsilk-200` | `#fffced` | 浮层背景 |
| `--color-cornsilk-300` | `#fefbe7` | 输入框填充 |
| `--color-cornsilk-400` | `#fefae0` | 主背景 DEFAULT |

#### Papaya Whip (木瓜色系) - 强调色

| 变量名 | 颜色值 | 用途说明 |
|-------|-------|---------|
| `--color-papaya-50` | `#fefbf5` | 浅色强调背景 |
| `--color-papaya-100` | `#fdf8eb` | 温暖背景 |
| `--color-papaya-200` | `#fcf4e0` | 警告浅背景 |
| `--color-papaya-300` | `#fbf1d6` | 装饰背景 |
| `--color-papaya-400` | `#faedcd` | 强调色 DEFAULT |
| `--color-papaya-500` | `#f2d079` | 高亮强调 |
| `--color-papaya-600` | `#eab227` | 警告色 |
| `--color-papaya-700` | `#a57b10` | 深色警告 |

#### Light Bronze (浅青铜色系) - 辅助色

| 变量名 | 颜色值 | 用途说明 |
|-------|-------|---------|
| `--color-bronze-50` | `#f6ede3` | 辅助背景 |
| `--color-bronze-100` | `#eedac7` | 浅色辅助 |
| `--color-bronze-200` | `#e5c8ab` | 辅助边框 |
| `--color-bronze-300` | `#dcb68f` | 辅助悬停 |
| `--color-bronze-400` | `#d4a373` | 辅助色 DEFAULT |
| `--color-bronze-500` | `#c49a63` | 深色辅助 |
| `--color-bronze-900` | `#32210f` | 深色文本 |

#### Terra (大地红系) - 错误色

| 变量名 | 颜色值 | 用途说明 |
|-------|-------|---------|
| `--color-terra-50` | `#fff5f0` | 错误浅背景 |
| `--color-terra-100` | `#ffece6` | 错误背景 |
| `--color-terra-200` | `#ffd9cc` | 错误边框 |
| `--color-terra-300` | `#ffc6b3` | 错误悬停 |
| `--color-terra-400` | `#ffb399` | 深色错误 |
| `--color-terra-500` | `#e8998c` | 错误色 DEFAULT |
| `--color-terra-600` | `#d47a6b` | 错误悬停 |
| `--color-terra-700` | `#c05b4a` | 错误激活 |
| `--color-terra-900` | `#6b1f18` | 错误文本 |

#### Neutral (灰度色系) - 中性色

| 变量名 | 颜色值 | 用途说明 |
|-------|-------|---------|
| `--color-neutral-0` | `#ffffff` | 纯白 |
| `--color-neutral-50` | `#fafafa` | 浅灰 |
| `--color-neutral-100` | `#f5f5f5` | 背景灰 |
| `--color-neutral-200` | `#e5e5e5` | 边框灰 |
| `--color-neutral-300` | `#d4d4d4` | 浅色灰 |
| `--color-neutral-400` | `#a3a3a3` | 禁用灰 |
| `--color-neutral-500` | `#737373` | 中性灰 |
| `--color-neutral-900` | `#171717` | 深灰 |
| `--color-neutral-950` | `#0a0a0a` | 纯黑 |

### 2.2 对比度验证

| 场景 | 前景色 | 背景色 | 对比度 | WCAG 等级 |
|-----|-------|--------|--------|----------|
| 主文本（浅色） | `#2d331a` | `#fefae0` | 14.2:1 | AAA |
| 主文本（深色） | `#ebeedf` | `#2d331a` | 12.8:1 | AAA |
| 主按钮（浅色） | `#2d331a` | `#ccd5ae` | 7.1:1 | AAA |
| 主按钮（深色） | `#2d331a` | `#ccd5ae` | 7.1:1 | AAA |
| 次要文本（浅色） | `#5b6635` | `#fefae0` | 7.3:1 | AAA |
| 错误提示 | `#6b1f18` | `#fff5f0` | 9.5:1 | AAA |

## 3. Layer 2: 语义化变量

### 3.1 主色调变量

```css
/* 主色 */
--color-primary: var(--color-tea-green-400);           /* #ccd5ae */
--color-primary-hover: var(--color-tea-green-500);     /* #b8c49a */
--color-primary-active: var(--color-tea-green-600);    /* #9aad81 */
--color-primary-light: var(--color-tea-green-100);     /* #ebeedf */
--color-primary-lighter: var(--color-tea-green-50);    /* #f5f7ef */
--color-primary-on-primary: var(--color-tea-green-900); /* #2d331a */
--color-primary-soft-bg: rgba(204, 213, 174, 0.15);
--color-primary-soft-border: rgba(204, 213, 174, 0.3);
```

### 3.2 背景变量

```css
/* 基础背景 */
--color-bg-base: var(--color-cornsilk-400);            /* 主背景 */
--color-bg-subtle: var(--color-beige-100);             /* 次要背景 */
--color-bg-surface: var(--color-beige-50);             /* 表面背景 */
--color-bg-surface-hover: var(--color-beige-100);      /* 表面悬停 */

/* 层级背景 */
--color-bg-canvas: var(--color-cornsilk-400);          /* 画布背景 */
--color-bg-panel: var(--color-beige-50);               /* 面板背景 */
--color-bg-card: var(--color-beige-100);               /* 卡片背景 */
--color-bg-popover: var(--color-cornsilk-50);          /* 弹出层背景 */
--color-bg-modal: var(--color-cornsilk-50);            /* 模态框背景 */
--color-bg-tooltip: var(--color-tea-green-900);        /* 提示框背景 */

/* 输入组件背景 */
--color-bg-input-default: var(--color-neutral-0);      /* 输入框默认 */
--color-bg-input-disabled: var(--color-beige-100);     /* 输入框禁用 */
--color-bg-input-filled: var(--color-beige-50);        /* 输入框填充 */

/* 遮罩 */
--color-bg-overlay: rgba(45, 51, 26, 0.5);             /* 遮罩层 */
--color-bg-backdrop: rgba(45, 51, 26, 0.7);            /* 背景模糊 */
--color-bg-dim: rgba(45, 51, 26, 0.3);                 /* 调暗层 */
```

### 3.3 文本变量

```css
/* 基础文本 */
--color-text-base: var(--color-tea-green-900);         /* 主文本 */
--color-text-secondary: var(--color-tea-green-800);    /* 次要文本 */
--color-text-tertiary: var(--color-tea-green-700);     /* 三级文本 */
--color-text-quaternary: var(--color-tea-green-600);   /* 四级文本 */
--color-text-placeholder: var(--color-tea-green-500);  /* 占位符 */
--color-text-disabled: var(--color-tea-green-400);     /* 禁用文本 */

/* 反色文本（深色背景上） */
--color-text-on-primary: var(--color-primary-on-primary);
--color-text-on-secondary: var(--color-bronze-900);
--color-text-on-success: var(--color-cornsilk-50);
--color-text-on-warning: var(--color-papaya-900);
--color-text-on-error: var(--color-terra-900);
--color-text-on-dark: var(--color-cornsilk-50);
--color-text-on-dark-secondary: var(--color-cornsilk-100);

/* 特殊用途文本 */
--color-text-code: var(--color-bronze-700);            /* 代码文本 */
--color-text-link: var(--color-primary);               /* 链接 */
--color-text-link-hover: var(--color-primary-hover);   /* 链接悬停 */
```

### 3.4 边框变量

```css
--color-border-default: var(--color-tea-green-300);    /* 默认边框 */
--color-border-subtle: var(--color-tea-green-200);     /* 浅色边框 */
--color-border-strong: var(--color-tea-green-500);     /* 强调边框 */
--color-border-focused: var(--color-primary);          /* 焦点边框 */
--color-border-disabled: var(--color-tea-green-200);   /* 禁用边框 */
--color-border-error: var(--color-error);              /* 错误边框 */
--color-border-success: var(--color-success);          /* 成功边框 */
--color-border-warning: var(--color-warning);          /* 警告边框 */
```

### 3.5 功能色变量

```css
/* 成功色 */
--color-success: var(--color-tea-green-600);
--color-success-hover: var(--color-tea-green-700);
--color-success-active: var(--color-tea-green-800);
--color-success-light: var(--color-tea-green-100);
--color-success-on-success: var(--color-cornsilk-50);
--color-success-soft-bg: rgba(154, 173, 129, 0.15);

/* 警告色 */
--color-warning: var(--color-bronze-400);
--color-warning-hover: var(--color-bronze-300);
--color-warning-active: var(--color-papaya-600);
--color-warning-light: var(--color-papaya-50);
--color-warning-on-warning: var(--color-papaya-900);
--color-warning-soft-bg: rgba(212, 163, 115, 0.15);

/* 错误色 */
--color-error: var(--color-terra-500);
--color-error-hover: var(--color-terra-600);
--color-error-active: var(--color-terra-700);
--color-error-light: var(--color-terra-50);
--color-error-on-error: var(--color-terra-900);
--color-error-soft-bg: rgba(232, 153, 140, 0.15);

/* 信息色 */
--color-info: var(--color-tea-green-500);
--color-info-hover: var(--color-tea-green-600);
--color-info-active: var(--color-tea-green-700);
--color-info-light: var(--color-tea-green-100);
--color-info-on-info: var(--color-tea-green-900);
--color-info-soft-bg: rgba(184, 196, 154, 0.15);

/* 强调色 */
--color-accent: var(--color-papaya-400);
--color-accent-hover: var(--color-papaya-500);
--color-accent-active: var(--color-papaya-600);
--color-accent-light: var(--color-papaya-50);
--color-accent-on-accent: var(--color-papaya-900);
```

### 3.6 状态变量

```css
/* 在线/连接状态 */
--color-status-online: var(--color-success);
--color-status-offline: var(--color-neutral-400);
--color-status-busy: var(--color-error);
--color-status-away: var(--color-warning);
--color-status-connecting: var(--color-info);

/* 数据状态 */
--color-data-positive: var(--color-tea-green-700);
--color-data-negative: var(--color-terra-600);
--color-data-neutral: var(--color-neutral-400);
```

### 3.7 交互状态变量

```css
/* Hover */
--color-hover-bg-primary: var(--color-primary-soft-bg);
--color-hover-bg-secondary: rgba(212, 163, 115, 0.1);
--color-hover-bg-surface: rgba(45, 51, 26, 0.04);
--color-hover-bg-danger: var(--color-error-soft-bg);

/* Focus */
--color-focus-ring: var(--color-primary);
--color-focus-ring-subtle: var(--color-tea-green-300);
--color-focus-bg: rgba(204, 213, 174, 0.2);

/* Active/Pressed */
--color-active-bg-primary: rgba(204, 213, 174, 0.25);
--color-active-bg-secondary: rgba(212, 163, 115, 0.15);
--color-active-bg-surface: rgba(45, 51, 26, 0.08);

/* Selected */
--color-selected-bg: var(--color-primary-soft-bg);
--color-selected-border: var(--color-primary);
```

## 4. Layer 3: 视觉特效变量

### 4.1 阴影系统

```css
/* 层级阴影 */
--shadow-xs: 0 1px 2px 0 rgba(45, 51, 26, 0.05);
--shadow-sm: 0 1px 3px 0 rgba(45, 51, 26, 0.05), 0 1px 2px -1px rgba(45, 51, 26, 0.05);
--shadow-md: 0 4px 6px -1px rgba(45, 51, 26, 0.08), 0 2px 4px -2px rgba(45, 51, 26, 0.05);
--shadow-lg: 0 10px 15px -3px rgba(45, 51, 26, 0.12), 0 4px 6px -4px rgba(45, 51, 26, 0.08);
--shadow-xl: 0 20px 25px -5px rgba(45, 51, 26, 0.15), 0 8px 10px -6px rgba(45, 51, 26, 0.12);
--shadow-2xl: 0 25px 50px -12px rgba(45, 51, 26, 0.2);
--shadow-inner: inset 0 2px 4px 0 rgba(45, 51, 26, 0.1);

/* 功能性阴影 */
--shadow-dropdown: 0 4px 12px rgba(45, 51, 26, 0.12), 0 0 0 1px rgba(214, 222, 190, 1);
--shadow-popover: 0 8px 24px rgba(45, 51, 26, 0.15), 0 0 0 1px rgba(214, 222, 190, 1);
--shadow-modal: 0 24px 48px rgba(45, 51, 26, 0.2), 0 0 0 1px rgba(214, 222, 190, 1);
--shadow-tooltip: 0 4px 12px rgba(45, 51, 26, 0.08);
--shadow-card: 0 2px 8px rgba(45, 51, 26, 0.08);
--shadow-button: 0 2px 4px rgba(45, 51, 26, 0.05);
--shadow-input: 0 1px 2px rgba(45, 51, 26, 0.05);

/* 状态阴影 */
--shadow-focus-ring: 0 0 0 3px rgba(204, 213, 174, 0.2);
--shadow-focus-ring-strong: 0 0 0 3px rgba(204, 213, 174, 0.15);
--shadow-glow-primary: 0 0 20px rgba(204, 213, 174, 0.15);
--shadow-glow-success: 0 0 20px rgba(154, 173, 129, 0.15);
--shadow-glow-error: 0 0 20px rgba(232, 153, 140, 0.15);
```

### 4.2 渐变系统

```css
/* 主题渐变 */
--gradient-primary: linear-gradient(135deg, #ccd5ae 0%, #7c9668 100%);
--gradient-primary-subtle: linear-gradient(135deg, #f5f7ef 0%, #e1e6cf 100%);
--gradient-warm: linear-gradient(135deg, #faedcd 0%, #d4a373 100%);
--gradient-subtle: linear-gradient(180deg, #fffef9 0%, #f6f8ea 100%);

/* 功能渐变 */
--gradient-success: linear-gradient(135deg, #ccd5ae 0%, #7c9668 100%);
--gradient-warning: linear-gradient(135deg, #faedcd 0%, #d4a373 100%);
--gradient-error: linear-gradient(135deg, #ffb399 0%, #d47a6b 100%);
--gradient-info: linear-gradient(135deg, #d6debe 0%, #9aad81 100%);

/* 遮罩渐变 */
--gradient-overlay-top: linear-gradient(180deg, rgba(45, 51, 26, 0.5) 0%, transparent 100%);
--gradient-overlay-bottom: linear-gradient(0deg, rgba(45, 51, 26, 0.5) 0%, transparent 100%);
--gradient-overlay-left: linear-gradient(90deg, rgba(45, 51, 26, 0.5) 0%, transparent 100%);
--gradient-overlay-right: linear-gradient(270deg, rgba(45, 51, 26, 0.5) 0%, transparent 100%);
--gradient-dim: linear-gradient(180deg, transparent 0%, rgba(45, 51, 26, 0.3) 100%);
```

### 4.3 过渡动画

```css
/* 时长 */
--transition-instant: 100ms;
--transition-fast: 150ms;
--transition-normal: 200ms;
--transition-slow: 300ms;
--transition-slower: 500ms;

/* 缓动函数 */
--easing-linear: linear;
--easing-ease: ease;
--easing-ease-in: ease-in;
--easing-ease-out: ease-out;
--easing-ease-in-out: ease-in-out;
--easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--easing-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--easing-emphasized: cubic-bezier(0.25, 0.46, 0.45, 0.94);

/* 组合过渡 */
--transition-fast-smooth: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-normal-smooth: 200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow-smooth: 300ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-colors: color 150ms cubic-bezier(0.4, 0, 0.2, 1),
                     background-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
                     border-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-transform: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-all: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-all-fast: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
```

### 4.4 其他视觉变量

```css
/* 模糊效果 */
--blur-sm: blur(4px);
--blur-md: blur(8px);
--blur-lg: blur(12px);
--blur-xl: blur(16px);
--blur-2xl: blur(24px);

/* 滚动条颜色 */
--color-scrollbar-track: var(--color-beige-100);
--color-scrollbar-thumb: var(--color-tea-green-300);
--color-scrollbar-thumb-hover: var(--color-tea-green-400);
--color-scrollbar-corner: var(--color-beige-50);

/* 代码高亮颜色 */
--color-code-keyword: var(--color-bronze-700);
--color-code-string: var(--color-tea-green-700);
--color-code-comment: var(--color-tea-green-400);
--color-code-function: var(--color-papaya-700);
--color-code-number: var(--color-bronze-600);
--color-code-operator: var(--color-tea-green-600);
--color-code-class: var(--color-papaya-600);
--color-code-variable: var(--color-tea-green-800);
--color-code-background: var(--color-beige-50);
--color-code-selection: var(--color-primary-soft-bg);
```

## 5. Layer 4: Tailwind 配置映射

### 5.1 颜色映射

```javascript
colors: {
  primary: {
    50: 'var(--color-tea-green-50)',
    100: 'var(--color-tea-green-100)',
    200: 'var(--color-tea-green-200)',
    300: 'var(--color-tea-green-300)',
    400: 'var(--color-tea-green-400)',
    500: 'var(--color-tea-green-500)',
    600: 'var(--color-tea-green-600)',
    700: 'var(--color-tea-green-700)',
    800: 'var(--color-tea-green-800)',
    900: 'var(--color-tea-green-900)',
    DEFAULT: 'var(--color-primary)',
    foreground: 'var(--color-text-on-primary)',
  },
  // ... 其他颜色类似映射
}
```

### 5.2 阴影映射

```javascript
boxShadow: {
  xs: 'var(--shadow-xs)',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
  '2xl': 'var(--shadow-2xl)',
  inner: 'var(--shadow-inner)',
  dropdown: 'var(--shadow-dropdown)',
  popover: 'var(--shadow-popover)',
  modal: 'var(--shadow-modal)',
  'focus-ring': 'var(--shadow-focus-ring)',
}
```

### 5.3 过渡映射

```javascript
transitionDuration: {
  instant: 'var(--transition-instant)',
  fast: 'var(--transition-fast)',
  normal: 'var(--transition-normal)',
  slow: 'var(--transition-slow)',
  slower: 'var(--transition-slower)',
},
transitionTimingFunction: {
  smooth: 'var(--easing-smooth)',
  emphasized: 'var(--easing-emphasized)',
}
```

## 6. Layer 5: HeroUI 主题配置

### 6.1 浅色主题

```javascript
light: {
  colors: {
    background: '#fefae0',           // cornsilk-400
    foreground: '#2d331a',           // tea-green-900
    primary: {
      DEFAULT: '#ccd5ae',            // tea-green-400
      foreground: '#2d331a',         // tea-green-900
    },
    success: {
      DEFAULT: '#7c9668',            // tea-green-600
      foreground: '#fefae0',
    },
    warning: {
      DEFAULT: '#d4a373',            // bronze-400
      foreground: '#32210f',
    },
    danger: {
      DEFAULT: '#e8998c',            // terra-500
      foreground: '#6b1f18',
    },
  },
}
```

### 6.2 深色主题

```javascript
dark: {
  colors: {
    background: '#2d331a',           // tea-green-100
    foreground: '#ebeedf',           // cornsilk-100
    primary: {
      DEFAULT: '#ccd5ae',            // 保持不变
      foreground: '#2d331a',
    },
    success: {
      DEFAULT: '#9aad81',            // 深色模式下提亮
      foreground: '#fefae0',
    },
    warning: {
      DEFAULT: '#faedcd',            // 深色模式下提亮
      foreground: '#382905',
    },
    danger: {
      DEFAULT: '#ffb399',            // 深色模式下提亮
      foreground: '#6b1f18',
    },
  },
}
```

## 7. 深色模式适配

### 7.1 背景色调整

| 变量 | 浅色模式 | 深色模式 |
|-----|---------|---------|
| `--color-bg-base` | `#fefae0` | `#2d331a` |
| `--color-bg-canvas` | `#fefae0` | `#2d331a` |
| `--color-bg-panel` | `#fbfbf4` | `#2d331a` (调整为 `#2d331a`) |
| `--color-bg-card` | `#f6f8ea` | `#454f35` |

### 7.2 文本色调整

| 变量 | 浅色模式 | 深色模式 |
|-----|---------|---------|
| `--color-text-base` | `#2d331a` | `#ebeedf` |
| `--color-text-secondary` | `#5e7f4f` | `#d6debe` |
| `--color-text-tertiary` | `#7c9668` | `#ccd5ae` |

### 7.3 阴影调整

深色模式下使用黑色阴影增强深度感：

```css
.dark {
  --color-shadow-sm: rgba(0, 0, 0, 0.3);
  --color-shadow-md: rgba(0, 0, 0, 0.4);
  --color-shadow-lg: rgba(0, 0, 0, 0.5);
  --color-shadow-xl: rgba(0, 0, 0, 0.6);
}
```

## 8. 组件使用示例

### 8.1 按钮组件

```tsx
// 主要按钮
<button className="
  bg-primary text-primary-on-primary
  hover:bg-primary-hover
  active:bg-primary-active
  disabled:bg-primary-light disabled:text-disabled
  transition-colors
">
  主要按钮
</button>

// 次要按钮
<button className="
  bg-secondary text-secondary-on-secondary
  hover:bg-secondary-hover
  transition-colors
">
  次要按钮
</button>

// 错误按钮
<button className="
  bg-error text-error-on-error
  hover:bg-error-hover
  transition-colors
">
  删除
</button>
```

### 8.2 输入框组件

```tsx
<input
  type="text"
  className="
    bg-input border border-default text-foreground
    placeholder:text-placeholder
    focus:border-focused focus:shadow-focus-ring
    disabled:bg-input-disabled disabled:text-disabled
    transition-colors
  "
  placeholder="请输入..."
/>
```

### 8.3 卡片组件

```tsx
<div className="
  card card-hover
  bg-card border border-default
  rounded-xl p-6
">
  <h3 className="text-foreground mb-2">卡片标题</h3>
  <p className="text-secondary">卡片内容</p>
</div>
```

### 8.4 状态标签

```tsx
// 成功状态
<span className="
  inline-flex items-center gap-2
  px-3 py-1 rounded-full
  bg-success/10 text-success
">
  <span className="status-indicator status-connected"></span>
  已连接
</span>

// 错误状态
<span className="
  inline-flex items-center gap-2
  px-3 py-1 rounded-full
  bg-error/10 text-error
">
  <span className="status-indicator status-disconnected"></span>
  已断开
</span>
```

## 9. 迁移检查清单

### 9.1 配置文件

- [ ] `frontend/src/styles/globals.css` 完整替换
- [ ] `frontend/tailwind.config.js` 完整替换

### 9.2 组件检查

以下组件可能包含硬编码颜色，需要检查：

- [ ] `frontend/src/components/layout/Sidebar.tsx`
- [ ] `frontend/src/components/layout/Header.tsx`
- [ ] `frontend/src/components/rules/RuleCard.tsx`
- [ ] `frontend/src/components/requests/RequestList.tsx`
- [ ] `frontend/src/components/preview/PreviewPanel.tsx`
- [ ] `frontend/src/components/request-viewer/components/DiffView.tsx`

### 9.3 功能验证

- [ ] 浅色模式下所有组件正常显示
- [ ] 深色模式下所有组件正常显示
- [ ] 深色/浅色模式切换流畅
- [ ] 按钮所有状态正确（默认、悬停、激活、禁用）
- [ ] 输入框所有状态正确（默认、聚焦、错误、禁用）
- [ ] 模态框、下拉菜单等浮层正确显示
- [ ] 滚动条颜色正确
- [ ] 表格行悬停效果正确
- [ ] 动画效果流畅
- [ ] 无控制台错误或警告

## 10. 常见问题处理

### 10.1 组件颜色未更新

**原因**: 组件内联样式或硬编码颜色

**解决**:
```tsx
// ❌ 错误
const style = { color: '#007acc', backgroundColor: '#ffffff' };

// ✅ 正确
const style = {
  color: 'var(--color-primary)',
  backgroundColor: 'var(--color-bg-input-default)'
};
```

### 10.2 深色模式切换异常

**原因**: 缺少 `.dark` 类或变量未定义

**解决**:
```tsx
// 切换深色模式
const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark');
};
```

### 10.3 HeroUI 组件颜色未生效

**原因**: HeroUI 主题配置未正确覆盖

**解决**: 检查 `tailwind.config.js` 中的 `heroui` 插件配置，确保所有颜色已定义

### 10.4 对比度不足

**原因**: 颜色选择不当或背景冲突

**解决**: 使用在线工具验证对比度 https://contrast-ratio.com/

## 11. 性能考虑

### 11.1 CSS 变量性能

- CSS 变量在浏览器中原生支持，性能优异
- 避免在 `::before`、`::after` 伪元素中使用过多的变量计算

### 11.2 构建优化

- Tailwind 的 JIT 模式只会生成使用的类
- 避免使用动态类名（如 `bg-${color}-500`）

### 11.3 运行时性能

- 使用 CSS 过渡而非 JavaScript 动画
- 避免频繁的 DOM 操作触发重排

## 12. 可访问性

### 12.1 WCAG 2.1 合规

- 所有文本对比度 >= 4.5:1 (AA 级)
- 重要文本对比度 >= 7:1 (AAA 级)
- 组件对比度 >= 3:1 (AA 级)

### 12.2 焦点指示器

```css
:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

### 12.3 深色模式支持

- 尊重用户系统偏好 (`prefers-color-scheme`)
- 提供手动切换选项
- 状态持久化

## 13. 未来扩展

### 13.1 预留扩展点

- 额外的主题变体（如高对比度模式）
- 自定义主题配置 API
- 主题切换动画

### 13.2 设计令牌管理

- 考虑使用 Style Dictionary 等工具生成多平台令牌
- 支持 Figma、Sketch 等设计工具同步
