# 提案：重构前端样式系统

## 概述

本提案旨在创建一套语义化、可维护、统一配置的前端样式系统，解决当前样式混杂在各处、存在大量硬编码的问题。

## 背景

### 当前问题

1. **样式分散**：34 个组件文件中共 313 处内联样式（`style={{...}}`）
2. **硬编码严重**：存在硬编码颜色（`#007AFF`, `#0055D4`）、硬编码尺寸（`width: '44px'`, `fontSize: '16px'`）、硬编码间距（`gap: '8px'`）
3. **缺乏语义化**：样式命名不统一，混用 Tailwind 类名、内联样式、CSS 变量
4. **主题切换不完整**：当前只支持深色主题，缺少浅色主题
5. **维护成本高**：修改样式需要在多处修改，容易出现遗漏

### 设计目标

1. **语义化命名**：所有样式使用语义化变量名，避免魔法数字
2. **统一配置中心**：所有样式值集中在 CSS 变量中管理
3. **双主题支持**：完整支持浅色/深色主题切换
4. **类型安全**：提供 TypeScript 类型定义，确保样式使用正确
5. **渐进式迁移**：保留 HeroUI 组件库，通过主题覆盖实现样式统一
6. **禁止绕过**：代码层面禁止绕过样式系统，强制使用语义化变量

### 重构原则

1. **坚决清除**：迁移后的老旧代码（硬编码样式、旧的全局样式）必须删除
2. **禁止回滚**：不保留备份文件，不提供回滚路径
3. **强制合规**：通过注释和 ESLint 规则禁止绕过样式系统
4. **一次性迁移**：每个组件迁移完成后，立即清理所有遗留样式

## 解决方案

### 架构设计

采用**保留 HeroUI + 主题覆盖**方案（方案 A）：

```
CSS 变量系统 (统一定义)
    ↓
映射到 Tailwind
    ↓
HeroUI 主题配置继承 CSS 变量
    ↓
组件样式统一由变量控制
```

### 目录结构

```
frontend/src/styles/
├── index.css                 # 入口文件
├── tokens/
│   ├── colors.css            # 颜色变量系统
│   ├── spacing.css           # 间距变量系统（4px 网格）
│   ├── typography.css        # 字体变量系统
│   ├── effects.css           # 阴影、圆角等效果
│   └── index.css             # 合并所有 tokens
├── utilities/
│   ├── layout.css            # 布局工具类
│   └── components.css        # 组件样式类
└── themes/
    ├── light.css             # 浅色主题变量
    └── dark.css              # 深色主题变量
```

### CSS 变量命名规范

采用 **语义化 + 分层** 命名：

```css
/* 格式: --{分类}-{语义}-{层级} */
:root {
  /* 颜色系统 */
  --color-bg-primary:      #ffffff;
  --color-bg-secondary:    #f5f5f5;
  --color-bg-elevated:     #ffffff;
  --color-text-primary:    #1a1a1a;
  --color-brand-primary:   #007acc;

  /* 间距系统（基于 4px 网格） */
  --spacing-xs:  4px;
  --spacing-sm:  8px;
  --spacing-md:  16px;
  --spacing-lg:  24px;
  --spacing-xl:  32px;

  /* 字体系统 */
  --font-size-xs:   12px;
  --font-size-sm:   14px;
  --font-size-md:   16px;

  /* 效果系统 */
  --radius-sm:  4px;
  --shadow-md:  0 4px 6px rgba(0, 0, 0, 0.15);
}
```

## 变更内容

- 创建完整的 CSS 变量系统（颜色、间距、字体、效果）
- 配置 Tailwind 将 CSS 变量映射到类名
- 更新 HeroUI 主题配置继承 CSS 变量
- 添加 TypeScript 类型定义
- 创建 React 样式钩子（可选）
- 渐进式迁移组件内联样式

## 影响范围

### 受影响的规格

- 新增 `theme-framework` 规格 - 主题框架配置

### 受影响的代码

**新增文件：**
- `frontend/src/styles/tokens/*.css` - 样式变量定义
- `frontend/src/styles/utilities/*.css` - 工具类定义
- `frontend/src/styles/themes/*.css` - 主题变量
- `frontend/src/styles/tokens.ts` - TypeScript 类型定义（可选）

**修改文件：**
- `frontend/tailwind.config.js` - 映射 CSS 变量
- `frontend/src/styles/globals.css` - 重构为模块化导入

**迁移文件（渐进式）：**
- `frontend/src/components/common/LogoIcon.tsx` - 硬编码颜色
- `frontend/src/components/layout/Sidebar.tsx` - 内联样式
- `frontend/src/components/layout/Header.tsx` - 内联样式
- 其他 20+ 个组件文件

## 迁移步骤

### Phase 1: 建立样式系统（1-2 天）
- 创建 tokens 目录结构
- 定义 CSS 变量（支持 light/dark）
- 更新 Tailwind 配置
- 映射 HeroUI 主题

### Phase 2: 组件迁移（1 周）
- 优先迁移高频组件（LogoIcon, StatusIndicator, Button 相关）
- 替换硬编码样式
- 验证主题切换

### Phase 3: 清理老旧代码（2-3 天）
- 删除迁移组件中的所有内联样式
- 删除 `globals.css` 中的旧样式定义
- 添加禁止绕过样式系统的代码注释
- 编写使用文档

## 验证清单

实施后需要验证：

- [ ] 浅色模式下所有组件正常显示
- [ ] 深色模式下所有组件正常显示
- [ ] 主题切换流畅无闪烁
- [ ] 所有 HeroUI 组件样式正确
- [ ] 内联样式已替换为语义化类名/变量
- [ ] 无硬编码颜色、尺寸
- [ ] TypeScript 类型检查通过
- [ ] 无控制台错误或警告

## 风险评估

### 低风险

- CSS 变量替换不影响现有组件逻辑
- Tailwind 配置更新向后兼容

### 中风险

- HeroUI 组件可能需要额外的样式覆盖
- 深色/浅色模式切换可能需要调试

### 质量保证

1. 分步骤验证，每步确认后再继续
2. 迁移完成后立即删除老旧代码
3. 代码审查时检查是否有绕过样式系统的情况

## 为什么选择方案 A（保留 HeroUI）

| 对比项 | 方案 A（保留 HeroUI） | 方案 B（完全自定义） | 方案 C（混合） |
|-------|---------------------|-------------------|--------------|
| 改动量 | 小 🟢 | 大 🔴 | 中 🟡 |
| 风险 | 低 🟢 | 高 🔴 | 中 🟡 |
| 开发周期 | 1-2 周 | 1-2 个月 | 3-4 周 |
| 自主性 | 中 | 高 | 中高 |
| 维护成本 | 低 | 高 | 中 |

**推荐理由：**
1. HeroUI 集成深度高：23 个文件依赖，重构成本太高
2. 功能完整性好：Autocomplete、Modal、Tooltip 等复杂组件重新实现成本高
3. 风险可控：主题覆盖可以完全统一样式
4. 快速交付：1-2 周完成 vs 1-2 个月

## 相关规格

本变更将创建以下新规格：

- `theme-framework` - 主题框架配置

## 参考资料

- OpenSpec 指南：`openspec/AGENTS.md`
- HeroUI 主题定制：https://heroui.com/docs/customization/theme
- Tailwind CSS 自定义配置：https://tailwindcss.com/docs/configuration
