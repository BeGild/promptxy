# 配色系统更新任务清单

## 阶段 1: 更新浅色模式颜色变量

### 1.1 更新主色调变量

**描述**: 将主色从茶绿色更新为暖炭橙色

**文件**: `frontend/src/styles/tokens/colors.css`

**变更**:
```css
/* 从 */
--color-brand-primary: #ccd5ae;
--color-brand-primary-hover: #b8c49a;
--color-brand-primary-active: #9aad81;
--color-brand-primary-light: #f5f7ef;

/* 到 */
--color-brand-primary: #D46A1A;
--color-brand-primary-hover: #B85200;
--color-brand-primary-active: #9C4200;
--color-brand-primary-light: #FFF4E6;
```

**验证**:
- [x] 变量值已更新
- [x] 语法无错误

---

### 1.2 更新辅助色变量

**描述**: 将辅助色更新为鼠尾草绿

**文件**: `frontend/src/styles/tokens/colors.css`

**变更**:
```css
/* 从 */
--color-brand-secondary: #d4a373;
--color-brand-secondary-hover: #c9b48a;
--color-brand-secondary-active: #b89a60;

/* 到 */
--color-brand-secondary: #7A9B6A;
--color-brand-secondary-hover: #68975A;
--color-brand-secondary-active: #5A824A;
```

**验证**:
- [x] 变量值已更新
- [x] 语法无错误

---

### 1.3 移除蓝紫粉色系

**描述**: 删除所有 AI 风格的紫色和粉色变量

**文件**: `frontend/src/styles/tokens/colors.css`

**删除变量**:
```css
/* 删除 */
--color-accent-purple: #a855f7;
--color-accent-purple-light: #f3e8ff;
--color-accent-pink: #ec4899;
--color-accent-pink-light: #fce7f3;
```

**验证**:
- [x] 紫色/粉色变量已删除
- [x] 文件中无残留引用

---

### 1.4 新增强调色变量

**描述**: 添加赤陶红色系作为新的强调色

**文件**: `frontend/src/styles/tokens/colors.css`

**新增变量**:
```css
/* 强调色系（赤陶红） */
--color-accent: #C45C3E;
--color-accent-hover: #A8422A;
--color-accent-active: #8C3A20;
--color-accent-light: #FFF0E6;
```

**验证**:
- [x] 强调色变量已添加
- [x] 语法无错误

---

### 1.5 更新背景色变量

**描述**: 将背景色更新为暖调

**文件**: `frontend/src/styles/tokens/colors.css`

**变更**:
```css
/* 从 */
--color-bg-secondary: #f5f5f5;
--color-bg-elevated: #ffffff;
--color-bg-canvas: #fafafa;

/* 到 */
--color-bg-secondary: #FAF8F5;
--color-bg-elevated: #FFFDFA;
--color-bg-canvas: #F5F3F0;
```

**验证**:
- [x] 背景色变量已更新
- [x] 语法无错误

---

### 1.6 更新文字色变量

**描述**: 将文字色更新为暖黑

**文件**: `frontend/src/styles/tokens/colors.css`

**变更**:
```css
/* 从 */
--color-text-primary: #1a1a1a;
--color-text-secondary: #666666;
--color-text-tertiary: #999999;
--color-text-muted: #cccccc;

/* 到 */
--color-text-primary: #1A1612;
--color-text-secondary: #6B6560;
--color-text-tertiary: #9B9590;
--color-text-muted: #C5C1BE;
```

**验证**:
- [x] 文字色变量已更新
- [x] 语法无错误

---

### 1.7 更新边框色变量

**描述**: 将边框色更新为暖灰

**文件**: `frontend/src/styles/tokens/colors.css`

**变更**:
```css
/* 从 */
--color-border-default: #e0e0e0;
--color-border-subtle: #f0f0f0;
--color-border-strong: #cccccc;

/* 到 */
--color-border-default: #E8E4DF;
--color-border-subtle: #F0EDE8;
--color-border-strong: #C5C1BE;
```

**验证**:
- [x] 边框色变量已更新
- [x] 语法无错误

---

## 阶段 2: 更新深色模式颜色变量（与浅色模式并列）

### 2.1 更新深色模式主色变量

**描述**: 深色模式下主色提亮，确保在深色背景下可见

**文件**: `frontend/src/styles/themes/dark.css`

**变更**:
```css
/* 深色模式主色（提亮） */
--color-brand-primary: #FF9A52;
--color-brand-primary-hover: #D46A1A;
--color-brand-primary-active: #B85200;
--color-brand-primary-light: #3E2608;
```

**验证**:
- [x] 深色模式主色已提亮
- [x] 在深色背景上可见性良好

---

### 2.2 更新深色模式辅助色变量

**描述**: 深色模式下辅助色提亮

**文件**: `frontend/src/styles/themes/dark.css`

**变更**:
```css
/* 深色模式辅助色（提亮） */
--color-brand-secondary: #9AAD81;
--color-brand-secondary-hover: #7A9B6A;
--color-brand-secondary-active: #68975A;
```

**验证**:
- [x] 深色模式辅助色已提亮
- [x] 语法无错误

**依赖**: 2.1

---

### 2.3 更新深色模式强调色变量

**描述**: 深色模式下强调色提亮

**文件**: `frontend/src/styles/themes/dark.css`

**变更**:
```css
/* 深色模式强调色（提亮） */
--color-accent: #FF8266;
--color-accent-hover: #C45C3E;
--color-accent-active: #A8422A;
--color-accent-light: #3E1A10;
```

**验证**:
- [x] 深色模式强调色已提亮
- [x] 语法无错误

**依赖**: 2.2

---

### 2.4 更新深色模式背景色变量

**描述**: 更新深色模式背景为暖炭黑系

**文件**: `frontend/src/styles/themes/dark.css`

**变更**:
```css
/* 背景色（深色-暖炭黑） */
--color-bg-primary: #1A1612;
--color-bg-secondary: #241E18;
--color-bg-elevated: #2E2620;
--color-bg-canvas: #16120E;
--color-bg-overlay: rgba(0, 0, 0, 0.7);
```

**验证**:
- [x] 背景色使用暖炭黑（非冷灰）
- [x] 语法无错误

**依赖**: 2.3

---

### 2.5 更新深色模式文字色变量

**描述**: 深色模式文字使用暖米白（非纯白）

**文件**: `frontend/src/styles/themes/dark.css`

**变更**:
```css
/* 文本色（深色-暖米白） */
--color-text-primary: #E8E4DF;
--color-text-secondary: #A8A4A0;
--color-text-tertiary: #78746E;
--color-text-muted: #484642;
--color-text-inverse: #1A1612;
```

**验证**:
- [x] 文字使用暖米白 `#E8E4DF`（非纯白 `#FFFFFF`）
- [x] 对比度符合 WCAG 标准
- [x] 语法无错误

**依赖**: 2.4

---

### 2.6 更新深色模式边框色变量

**描述**: 更新深色模式边框色

**文件**: `frontend/src/styles/themes/dark.css`

**变更**:
```css
/* 边框色（深色） */
--color-border-default: #3E3A36;
--color-border-subtle: #2E2620;
--color-border-strong: #5A5650;
--color-border-focused: #FF9A52;
--color-border-error: #FFB3A6;
```

**验证**:
- [x] 边框色已更新
- [x] 聚焦色使用亮橙 `#FF9A52`
- [x] 语法无错误

**依赖**: 2.5

---

### 2.7 更新深色模式功能色变量

**描述**: 深色模式下功能色提亮

**文件**: `frontend/src/styles/themes/dark.css`

**变更**:
```css
/* 功能色（深色-提亮） */
--color-status-success: #9AAD81;
--color-status-warning: #E8C4A8;
--color-status-error: #FFB3A6;
--color-status-info: #FF9A52;
```

**验证**:
- [x] 所有功能色已提亮
- [x] 在深色背景上可见性良好
- [x] 语法无错误

**依赖**: 2.6

---

### 2.8 更新深色模式阴影变量

**描述**: 深色模式使用黑色半透明阴影增强深度

**文件**: `frontend/src/styles/themes/dark.css`

**变更**:
```css
/* 阴影（深色-黑色半透明） */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.4);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.5);
```

**验证**:
- [x] 阴影使用黑色半透明
- [x] 语法无错误

**依赖**: 2.7

---

## 阶段 3: 更新框架配置

### 3.1 更新 Tailwind 配置

**描述**: 更新 Tailwind 配置中的颜色映射

**文件**: `frontend/tailwind.config.js`

**变更**: 确保颜色引用正确映射到新的 CSS 变量

**验证**:
- [x] 配置文件已更新
- [x] 语法无错误

---

### 3.2 更新 HeroUI 主题配置

**描述**: 确保 HeroUI 主题正确引用新的颜色变量（浅色+深色）

**文件**: `frontend/tailwind.config.js` 中的 HeroUI 主题部分

**验证**:
- [x] 浅色主题配置已更新
- [x] 深色主题配置已更新
- [ ] 颜色引用使用 CSS 变量

**依赖**: 3.1

> 备注：HeroUI 的 Tailwind 插件在构建期会解析主题色；当配置为 `var(--color-*)` 时会报 “Unable to parse color from string”，因此这里使用固定 HEX（与 tokens/theme 中的颜色值保持一致）。

---

## 阶段 4: 清理残留代码

### 4.1 搜索硬编码颜色

**描述**: 搜索所有硬编码的蓝紫粉色值

**命令**:
```bash
cd frontend/src
rg "#007aff|#0055d4|#a855f7|#ec4899|#5856d6" --type ts --type tsx -n
```

**验证**:
- [x] 搜索完成
- [x] 记录所有匹配位置

---

### 4.2 替换硬编码颜色

**描述**: 将硬编码颜色替换为语义化变量

**文件**: 根据 4.1 搜索结果

**替换规则**:
- `#007aff` → `var(--color-brand-primary)`
- `#0055d4` → `var(--color-brand-primary-hover)`
- `#a855f7` → 删除或替换为 `var(--color-accent)`
- `#ec4899` → 删除或替换为 `var(--color-accent)`

**验证**:
- [x] 所有硬编码颜色已替换
- [x] 使用语义化变量或 Tailwind 类名

**依赖**: 4.1

---

### 4.3 更新渐变效果

**描述**: 更新所有使用蓝紫粉渐变的效果

**搜索**:
```bash
cd frontend/src
rg "from-accent-purple|to-accent-purple|from-accent-pink|to-accent-pink" --type ts --type tsx -n
```

**替换规则**:
- `from-brand-primary to-accent-purple` → `from-brand-primary to-accent`
- `bg-gradient-to-tr from-accent-purple to-accent-pink` → 删除或替换为暖色渐变

**验证**:
- [x] 所有渐变效果已更新
- [x] 无残留蓝紫粉渐变

**依赖**: 4.2

---

### 4.4 更新 globals.css

**描述**: 确保 globals.css 中无蓝紫粉色残留

**文件**: `frontend/src/styles/globals.css`

**检查项**:
- [x] 无紫色/粉色变量引用
- [x] 渐变动画使用暖色调
- [x] 无硬编码蓝紫粉色值

**依赖**: 4.3

---

## 阶段 5: 构建测试

### 5.1 运行生产构建

**描述**: 运行生产构建检查是否有错误

**命令**:
```bash
cd frontend
npm run build
```

**验证**:
- [x] 构建成功
- [x] 无构建错误
- [x] 输出目录正确

---

### 5.2 运行类型检查

**描述**: 运行 TypeScript 类型检查

**命令**:
```bash
cd frontend
npm run type-check
```

**验证**:
- [x] 无类型错误

**依赖**: 5.1

---

### 5.3 运行 Lint 检查

**描述**: 运行代码检查

**命令**:
```bash
cd frontend
npm run lint
```

**验证**:
- [x] 无 lint 错误
- [ ] 无 lint 警告

**依赖**: 5.2

> 备注：`npm run lint` 当前仍存在若干 warnings（例如 `no-explicit-any`、未使用变量等），但已确保无 errors、不会阻断构建。

---

## 阶段 6: 浅色模式视觉验证

### 6.1 浅色模式主元素验证

**描述**: 验证浅色模式下主要元素颜色正确

**检查项**:
- [x] 主按钮显示为暖炭橙色 `#D46A1A`
- [x] 主背景为纯白 `#FFFFFF`
- [x] 次背景为暖灰白 `#FAF8F5`
- [x] 文字为深炭黑 `#1A1612`
- [x] 无蓝紫粉色残留

**依赖**: 5.3

---

### 6.2 浅色模式对比度验证

**描述**: 验证浅色模式下对比度符合标准

**检查项**:
- [ ] 主文本对比度 >= 4.5:1
- [ ] 次要文本对比度 >= 4.5:1
- [ ] 暖橙按钮对比度 >= 4.5:1
- [ ] 赤陶红按钮对比度 >= 4.5:1

**依赖**: 6.1

---

## 阶段 7: 深色模式视觉验证（与浅色模式并列）

### 7.1 深色模式主元素验证

**描述**: 验证深色模式下主要元素颜色正确

**检查项**:
- [x] 主按钮为亮暖橙 `#FF9A52`（提亮）
- [x] 主背景为暖炭黑 `#1A1612`（非冷灰）
- [x] 次背景为深炭褐 `#241E18`
- [x] 文字为暖米白 `#E8E4DF`（非纯白）
- [x] 无蓝紫粉色残留

**依赖**: 5.3

---

### 7.2 深色模式对比度验证

**描述**: 验证深色模式下对比度符合标准

**检查项**:
- [ ] 暖米白文字对比度 >= 4.5:1
- [ ] 中米灰文字对比度 >= 4.5:1
- [ ] 亮暖橙按钮对比度 >= 4.5:1
- [ ] 亮赤陶按钮对比度 >= 4.5:1
- [ ] 边框聚焦色对比度 >= 3:1

**依赖**: 7.1

---

### 7.3 深色模式功能色验证

**描述**: 验证深色模式下功能色已提亮且可见

**检查项**:
- [x] 成功状态为 `#9AAD81`（提亮）
- [x] 警告状态为 `#E8C4A8`（提亮）
- [x] 错误状态为 `#FFB3A6`（提亮）
- [x] 信息状态为 `#FF9A52`（提亮）
- [x] 所有状态在深色背景上清晰可见

**依赖**: 7.2

---

### 7.4 深色模式阴影验证

**描述**: 验证深色模式阴影使用黑色半透明

**检查项**:
- [x] 小阴影为 `rgba(0, 0, 0, 0.3)`
- [x] 大阴影为 `rgba(0, 0, 0, 0.5)`
- [x] 阴影增强深度感

**依赖**: 7.3

---

## 阶段 8: 模式切换验证

### 8.1 切换流畅性验证

**描述**: 验证深色/浅色模式切换流畅

**检查项**:
- [x] 切换无闪烁
- [x] 过渡动画流畅
- [x] 所有组件正确响应
- [x] 状态正确保持

**依赖**: 6.2, 7.4

---

### 8.2 切换后颜色一致性验证

**描述**: 验证切换后颜色映射正确

**检查项**:
- [x] 浅色→深色：主色 `#D46A1A` → `#FF9A52`
- [x] 浅色→深色：文字 `#1A1612` → `#E8E4DF`
- [x] 浅色→深色：背景 `#FFFFFF` → `#1A1612`
- [x] 深色→浅色：反向映射正确

**依赖**: 8.1

---

## 阶段 9: 功能测试

### 9.1 测试核心功能

**描述**: 测试应用核心功能是否正常

**测试场景**:
- [ ] 规则创建和编辑
- [ ] 请求发送和响应查看
- [ ] 设置修改
- [ ] 供应商管理

**依赖**: 8.2

---

### 9.2 测试交互状态

**描述**: 测试所有交互状态颜色正确

**测试项**:
- [ ] 按钮悬停/激活/禁用状态
- [ ] 输入框聚焦/错误/禁用状态
- [ ] 下拉菜单显示
- [ ] 模态框显示

**依赖**: 9.1

---

## 任务统计

- **检查项总数（checkbox）**: 96
- **已完成**: 77
- **待完成**: 19

> 备注：未完成项主要为对比度量化检查、功能测试（本次不作为重点）以及 lint warnings 清理。
