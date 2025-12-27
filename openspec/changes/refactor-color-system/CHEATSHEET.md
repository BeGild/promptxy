# 配色系统速查表

## 快速参考

### 原始色系速查

#### Tea Green (茶绿色系) - 主色调

| 变量 | 颜色 | 用途 |
|-----|------|-----|
| `--color-tea-green-50` | `#f5f7ef` | 最浅背景 |
| `--color-tea-green-400` | `#ccd5ae` | **主色 DEFAULT** |
| `--color-tea-green-500` | `#b8c49a` | 悬停 |
| `--color-tea-green-600` | `#9aad81` | 激活/成功 |
| `--color-tea-green-900` | `#2d331a` | **主文本/深色背景** |

#### Cornsilk (玉米丝色系) - 亮部背景

| 变量 | 颜色 | 用途 |
|-----|------|-----|
| `--color-cornsilk-50` | `#fffef9` | 最亮 |
| `--color-cornsilk-400` | `#fefae0` | **主背景** |
| `--color-cornsilk-50` | `#fffef9` | **深色文本** |

#### Light Bronze (浅青铜色系) - 辅助色

| 变量 | 颜色 | 用途 |
|-----|------|-----|
| `--color-bronze-400` | `#d4a373` | **辅助色** |
| `--color-bronze-900` | `#32210f` | 深色文本 |

#### Terra (大地红系) - 错误色

| 变量 | 颜色 | 用途 |
|-----|------|-----|
| `--color-terra-500` | `#e8998c` | **错误** |
| `--color-terra-900` | `#6b1f18` | 错误文本 |

---

### 语义变量速查

#### 常用语义变量

```css
/* 主色 */
--color-primary              /* #ccd5ae - 茶绿色 */
--color-primary-hover        /* #b8c49a */
--color-primary-on-primary   /* #2d331a */

/* 背景 */
--color-bg-base              /* #fefae0 - 米白 */
--color-bg-panel             /* #fbfbf4 - 浅米 */
--color-bg-card              /* #f6f8ea - 卡片 */

/* 文本 */
--color-text-base            /* #2d331a - 主文本 */
--color-text-secondary       /* #5e7f4f - 次要 */
--color-text-disabled        /* #ccd5ae - 禁用 */

/* 边框 */
--color-border-default       /* #d6debe */
--color-border-focused       /* #ccd5ae */

/* 功能色 */
--color-success              /* #7c9668 */
--color-warning              /* #d4a373 */
--color-error                /* #e8998c */
--color-info                 /* #b8c49a */
```

---

### Tailwind 类名速查

#### 颜色类名

```html
<!-- 主色 -->
<div class="bg-primary">           <!-- 背景主色 -->
<div class="text-primary">         <!-- 文本主色 -->
<div class="border-primary">       <!-- 边框主色 -->
<div class="bg-primary/10">        <!-- 主色 10% 透明度 -->

<!-- 功能色 -->
<div class="bg-success">           <!-- 成功背景 -->
<div class="text-error">           <!-- 错误文本 -->
<div class="border-warning">       <!-- 警告边框 -->

<!-- 背景 -->
<div class="bg-background">        <!-- 主背景 -->
<div class="bg-card">              <!-- 卡片背景 -->
<div class="bg-panel">             <!-- 面板背景 -->

<!-- 文本 -->
<div class="text-foreground">      <!-- 主文本 -->
<div class="text-secondary">       <!-- 次要文本 -->
<div class="text-placeholder">     <!-- 占位符 -->
<div class="text-disabled">        <!-- 禁用 -->
```

#### 阴影类名

```html
<div class="shadow-sm">            <!-- 小阴影 -->
<div class="shadow-md">            <!-- 中阴影 -->
<div class="shadow-lg">            <!-- 大阴影 -->
<div class="shadow-card">          <!-- 卡片阴影 -->
<div class="shadow-dropdown">      <!-- 下拉阴影 -->
<div class="shadow-modal">         <!-- 模态框阴影 -->
<div class="shadow-focus-ring">    <!-- 焦点环 -->
```

#### 过渡类名

```html
<div class="transition-colors">    <!-- 颜色过渡 -->
<div class="transition-all">       <!-- 全部过渡 -->
<div class="duration-fast">        <!-- 快速 -->
<div class="duration-normal">      <!-- 正常 -->
<div class="ease-smooth">          <!-- 平滑缓动 -->
```

---

### 常用组合速查

#### 按钮样式

```html
<!-- 主要按钮 -->
<button class="
  bg-primary text-primary-on-primary
  hover:bg-primary-hover
  active:bg-primary-active
  disabled:bg-primary-light disabled:text-disabled
  transition-colors
">
  主要按钮
</button>

<!-- 次要按钮 -->
<button class="
  bg-secondary text-secondary-on-secondary
  hover:bg-secondary-hover
  transition-colors
">
  次要按钮
</button>

<!-- 错误按钮 -->
<button class="
  bg-error text-error-on-error
  hover:bg-error-hover
  transition-colors
">
  删除
</button>
```

#### 输入框样式

```html
<input class="
  bg-input
  border border-default
  text-foreground
  placeholder:text-placeholder
  focus:border-focused
  focus:shadow-focus-ring
  disabled:bg-input-disabled
  disabled:text-disabled
  transition-colors
" />
```

#### 卡片样式

```html
<div class="
  bg-card
  border border-default
  rounded-xl
  p-6
  card-hover
">
  <h3 class="text-foreground">标题</h3>
  <p class="text-secondary">内容</p>
</div>
```

---

### 深色模式速查

#### 深色模式颜色变化

| 变量 | 浅色模式 | 深色模式 |
|-----|---------|---------|
| `--color-bg-base` | `#fefae0` | `#2d331a` |
| `--color-text-base` | `#2d331a` | `#ebeedf` |
| `--color-primary` | `#ccd5ae` | `#ccd5ae` (不变) |
| `--color-success` | `#7c9668` | `#9aad81` (提亮) |
| `--color-error` | `#e8998c` | `#ffb399` (提亮) |

#### 深色模式切换

```tsx
// 切换深色模式
const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark');
};

// 检测当前模式
const isDarkMode = () => {
  return document.documentElement.classList.contains('dark');
};
```

---

### 状态指示器速查

```html
<!-- 在线状态 -->
<span class="inline-flex items-center gap-2">
  <span class="status-indicator status-connected"></span>
  已连接
</span>

<!-- 离线状态 -->
<span class="inline-flex items-center gap-2">
  <span class="status-indicator status-disconnected"></span>
  已断开
</span>

<!-- 连接中 -->
<span class="inline-flex items-center gap-2">
  <span class="status-indicator status-connecting"></span>
  连接中
</span>
```

---

### 差异显示速查

```html
<!-- 添加 -->
<div class="diff-added">
  添加的内容
</div>

<!-- 删除 -->
<div class="diff-removed">
  删除的内容
</div>

<!-- 修改 -->
<div class="diff-modified">
  修改的内容
</div>
```

---

### 代码样式速查

```html
<!-- 代码块 -->
<pre class="bg-code text-code">
  <code>
    <!-- 语法高亮自动应用 -->
  </code>
</pre>

<!-- 行内代码 -->
<code class="bg-code text-code px-1 rounded">
  code
</code>
```

---

### 工具类速查

```html
<!-- 玻璃拟态 -->
<div class="glass">
  内容
</div>

<!-- 悬停提升 -->
<div class="hover-lift">
  悬停时提升
</div>

<!-- 脉冲动画 -->
<div class="status-pulse">
  脉冲效果
</div>

<!-- 骨架屏 -->
<div class="skeleton">
  加载中...
</div>

<!-- 渐变文字 -->
<div class="gradient-text-animated">
  渐变文字
</div>
```

---

### 常见问题速查

#### Q: 如何自定义组件颜色？

```tsx
// 使用 CSS 变量
const style = {
  color: 'var(--color-primary)',
  backgroundColor: 'var(--color-bg-card)',
};

// 或使用 Tailwind 类名
<div className="text-primary bg-card">
```

#### Q: 如何添加悬停效果？

```html
<!-- 使用 Tailwind 类名 -->
<div class="hover:bg-primary-hover transition-colors">

<!-- 或使用 CSS -->
<div style={{ '--hover-bg': 'var(--color-primary-hover)' }}>
```

#### Q: 深色模式不生效？

```tsx
// 确保根元素有 dark 类
document.documentElement.classList.add('dark');

// 或使用媒体查询
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark');
}
```

---

### 对比度速查

| 场景 | 对比度 | 等级 |
|-----|-------|------|
| 主文本 | 14.2:1 | AAA |
| 次要文本 | 7.3:1 | AAA |
| 主按钮 | 7.1:1 | AAA |
| 错误提示 | 9.5:1 | AAA |

---

### 完整色卡

#### 浅色模式

```
茶绿色系 (Tea Green)
50:  #f5f7ef  ━━━━━━━━━━━━━ 最浅背景
100: #ebeedf  ━━━━━━━━━━━━ 深色模式背景
200: #e1e6cf  ━━━━━━━━━━━━ 浅色背景
300: #d6debe  ━━━━━━━━━━━━ 边框默认
400: #ccd5ae  ━━━━━━━━━━━━ 主色 DEFAULT ★
500: #b8c49a  ━━━━━━━━━━━━ 悬停状态
600: #9aad81  ━━━━━━━━━━━━ 激活/成功
700: #7c9668  ━━━━━━━━━━━━ 深色成功
800: #5e7f4f  ━━━━━━━━━━━━ 次要文本
900: #2d331a  ━━━━━━━━━━━━ 主文本 ★

米色系 (Beige)
50:  #fbfbf4  ━━━━━━━━━━━━━ 面板背景
100: #f6f8ea  ━━━━━━━━━━━━ 卡片背景
400: #e9edc9  ━━━━━━━━━━━━ 浅色装饰

玉米丝色系 (Cornsilk)
50:  #fffef9  ━━━━━━━━━━━━━ 最亮
400: #fefae0  ━━━━━━━━━━━━ 主背景 ★

木瓜色系 (Papaya)
400: #faedcd  ━━━━━━━━━━━━ 强调色
500: #f2d079  ━━━━━━━━━━━━ 高亮强调
600: #eab227  ━━━━━━━━━━━━ 警告色

青铜色系 (Bronze)
400: #d4a373  ━━━━━━━━━━━━ 辅助色 ★
900: #32210f  ━━━━━━━━━━━━ 深色文本

大地红系 (Terra)
500: #e8998c  ━━━━━━━━━━━━ 错误色 ★
900: #6b1f18  ━━━━━━━━━━━━ 错误文本

★ 最常用颜色
```

#### 深色模式

```
背景色反转
主背景:     #fefae0 → #2d331a
面板背景:   #fbfbf4 → #2d331a
卡片背景:   #f6f8ea → #454f35

文本色反转
主文本:     #2d331a → #ebeedf
次要文本:   #5e7f4f → #d6debe
三级文本:   #7c9668 → #ccd5ae

功能色调整
主色:       #ccd5ae → #ccd5ae (不变)
成功色:     #7c9668 → #9aad81 (提亮)
警告色:     #d4a373 → #faedcd (提亮)
错误色:     #e8998c → #ffb399 (提亮)

阴影调整
小阴影:     rgba(45,51,26,0.05) → rgba(0,0,0,0.3)
大阴影:     rgba(45,51,26,0.12) → rgba(0,0,0,0.5)
```

---

### 设计理念回顾

- **自然共鸣**: 茶绿、米色、暖木等自然元素
- **层次分明**: 明度阶梯确保视觉平衡
- **温润克制**: 柔和渐变，避免刺眼
- **可读性优先**: 对比度符合 WCAG AA/AAA
- **无蓝紫**: 完全避免蓝色和紫色系

---

### 更新日志

- 2024-12: 创建配色系统速查表
- 基于 Tea Green + Beige + Cornsilk + Papaya + Bronze + Terra 色系
- 完整的浅色/深色模式支持
- WCAG 2.1 无障碍合规
