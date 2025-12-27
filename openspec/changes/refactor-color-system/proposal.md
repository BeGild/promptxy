# 提案：重构 Promptxy 配色系统

## 概述

本提案旨在重构 Promptxy 项目的整体配色体系，创建一套从底层到顶层、完整无遗漏的颜色系统架构，替换当前基于蓝色系的设计，转向自然温润的茶绿-米色-暖木色系。

## 背景

### 当前问题

1. **蓝色系限制**: 当前项目使用蓝色系 (`#007acc`) 作为主色调，需要完全替换
2. **配色系统不完整**: 缺少统一的颜色变量管理，部分组件存在硬编码颜色
3. **语义化不足**: 颜色定义缺少清晰的语义层，难以维护和扩展
4. **深色模式覆盖不全**: 深色模式下的颜色变量存在遗漏

### 设计目标

1. **自然温润风格**: 基于茶绿、米色、暖木、玉米丝、木瓜等自然色系
2. **五层架构**: 从原始变量到组件主题，逐层覆盖，无遗漏
3. **完全语义化**: 清晰的变量命名和用途定义
4. **双模式支持**: 完整的浅色/深色模式变量覆盖
5. **无障碍标准**: 符合 WCAG AA/AAA 对比度要求

## 设计理念

### 核心设计哲学

- **自然共鸣**: 从茶绿、米色、暖木等自然元素提取灵感，营造温润、舒适的视觉体验
- **层次分明**: 通过明度阶梯确保各层级视觉重量平衡
- **温润克制**: 避免高饱和度刺眼色彩，采用柔和渐变实现优雅过渡
- **可读性优先**: 文本颜色与背景色保持 4.5:1 以上对比度 (WCAG AA 标准)

### 色彩角色分配

| 色彩角色 | 推荐色系 | 设计意图 |
|---------|---------|---------|
| Primary (主色) | Tea Green | 代表自然、生长、稳定，用于主要操作和品牌识别 |
| Secondary (辅色) | Light Bronze | 温润大地色系，用于次要操作和视觉平衡 |
| Background (背景) | Beige + Cornsilk | 柔和米白底色，减少视觉疲劳 |
| Accent (强调) | Papaya Whip | 温暖提示色，用于信息高亮 |
| Success (成功) | Tea Green (lighter) | 自然绿色，传达积极完成状态 |
| Warning (警告) | Light Bronze (warmer) | 温暖橙调，提示注意但不刺眼 |
| Error (错误) | Warm Terra | 大地红调，清晰传达错误状态 |

## 架构设计

### 五层配色系统架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: 原始颜色变量 (Raw Tokens)                         │
│         定义所有原始颜色值，无语义关联                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 语义化变量 (Semantic Tokens)                      │
│         将原始颜色映射到具体 UI 用途                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 视觉特效变量 (Visual Effects)                     │
│         阴影、渐变、过渡动画等                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Tailwind 配置 (Framework Mapping)                 │
│         将 CSS 变量映射到 Tailwind 类名                     │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: HeroUI 主题覆盖 (Component Theme)                 │
│         组件库主题完整配置                                  │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1: 原始颜色变量

定义所有原始颜色值，包含以下色系：

- **Tea Green (茶绿色系)**: `#f5f7ef` - `#2d331a` (50-900)
- **Beige (米色系)**: `#fbfbf4` - `#272c0e` (50-900)
- **Cornsilk (玉米丝色系)**: `#fffef9` - `#3d3602` (50-900)
- **Papaya Whip (木瓜色系)**: `#fefbf5` - `#382905` (50-900)
- **Light Bronze (浅青铜色系)**: `#f6ede3` - `#32210f` (50-900)
- **Terra (大地红/错误色系)**: `#fff5f0` - `#6b1f18` (50-900)
- **Neutral (灰度色系)**: `#ffffff` - `#0a0a0a` (0-950)

### Layer 2: 语义化变量

将原始颜色映射到具体 UI 用途：

- **主色调**: `--color-primary`, `--color-primary-hover`, `--color-primary-active`, `--color-primary-light`, `--color-primary-on-primary`
- **功能色**: `--color-success`, `--color-warning`, `--color-error`, `--color-info`, `--color-accent`
- **背景色**: `--color-bg-base`, `--color-bg-canvas`, `--color-bg-panel`, `--color-bg-card`, `--color-bg-overlay`
- **文本色**: `--color-text-base`, `--color-text-secondary`, `--color-text-tertiary`, `--color-text-disabled`
- **边框色**: `--color-border-default`, `--color-border-subtle`, `--color-border-strong`, `--color-border-focused`
- **图标色**: `--color-icon-default`, `--color-icon-subtle`, `--color-icon-primary`
- **状态色**: `--color-status-online`, `--color-status-offline`, `--color-status-busy`

### Layer 3: 视觉特效变量

- **阴影系统**: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-dropdown`, `--shadow-modal`
- **渐变系统**: `--gradient-primary`, `--gradient-warm`, `--gradient-subtle`
- **过渡动画**: `--transition-fast`, `--transition-normal`, `--transition-slow`, `--easing-smooth`

### Layer 4: Tailwind 配置

将 CSS 变量映射到 Tailwind 类名，支持：
- `bg-primary`, `text-primary`, `border-primary`
- `bg-success`, `text-error`, `text-warning`
- `shadow-card`, `shadow-dropdown`, `shadow-modal`
- `transition-colors`, `transition-all`

### Layer 5: HeroUI 主题覆盖

为所有 HeroUI 组件配置新配色：
- Button, Input, Card, Modal, Dropdown, Table
-浅色/深色主题完整配置

## 深色模式支持

完整的深色模式变量覆盖，包括：
- 背景色反转：从米白 (`#fefae0`) 到深茶绿 (`#2d331a`)
- 文本色反转：从深茶绿 (`#2d331a`) 到米白 (`#ebeedf`)
- 功能色调整：在深色背景下适当提亮，保持可读性
- 阴影调整：使用黑色阴影增强深度感

## 受影响的文件

### 需要修改的文件

1. `frontend/src/styles/globals.css` - 完整替换为新的 CSS 变量系统
2. `frontend/tailwind.config.js` - 完整替换为新的 Tailwind 配置

### 可能需要检查的组件

以下组件可能包含硬编码颜色，需要审查：
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/rules/RuleCard.tsx`
- `frontend/src/components/requests/RequestList.tsx`
- `frontend/src/components/preview/PreviewPanel.tsx`

## 验证清单

实施后需要验证：

- [ ] 浅色模式下所有组件正常显示
- [ ] 深色模式下所有组件正常显示
- [ ] 深色/浅色模式切换流畅
- [ ] 所有按钮状态（默认、悬停、激活、禁用）正确
- [ ] 所有输入框状态（默认、聚焦、错误、禁用）正确
- [ ] 模态框、下拉菜单等浮层正确显示
- [ ] 滚动条颜色正确
- [ ] 表格行悬停效果正确
- [ ] 动画效果流畅
- [ ] 无控制台错误或警告

## 实施风险

### 低风险

- CSS 变量替换不影响现有组件逻辑
- Tailwind 配置更新向后兼容

### 中风险

- HeroUI 组件可能需要额外的样式覆盖
- 深色模式切换可能需要调试

### 缓解措施

1. 实施前完整备份现有配置
2. 分步骤验证，每步确认后再继续
3. 保留回滚方案

## 相关规格

本变更将创建以下新规格：

- `color-system` - 颜色系统基础架构
- `theme-framework` - 主题框架配置

## 时间估算

- 配置文件替换: 30 分钟
- 组件检查与修复: 1-2 小时
- 测试与验证: 30 分钟
- 总计: 约 2-3 小时

## 参考资料

- WCAG 2.1 对比度标准: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- Tailwind CSS 自定义配置: https://tailwindcss.com/docs/configuration
- HeroUI 主题定制: https://heroui.com/docs/customization/theme
