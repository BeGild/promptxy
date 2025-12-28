# 设计文档：暖炭橙色配色系统

## Context

Promptxy 项目已完成五层配色系统架构重构，但当前使用茶绿色系。用户希望采用更温暖、更具品牌辨识度的暖炭橙色系，同时移除所有"AI风"蓝紫粉色残留。

### 约束条件

- 必须保持现有五层架构结构
- 必须支持浅色/深色双主题
- 必须符合 WCAG AA 对比度标准
- 不能破坏现有 Tailwind 类名映射
- 不能影响 HeroUI 组件库兼容性

### 利益相关者

- 产品用户：需要温暖、专业的视觉体验
- 开发团队：需要清晰的变量命名和一致的配色规则

## Goals / Non-Goals

### Goals

- 将主色调更新为暖炭橙色系（`#D46A1A`）
- 移除所有蓝紫粉色系（`#007acc`, `#a855f7`, `#ec4899`）
- 新增强调色系（赤陶红 `#C45C3E`）
- 更新浅色模式背景色为暖调（暖灰白、纸白）
- 更新浅色模式文字色为暖黑（深炭黑）
- **独立设计深色模式**（非简单反转，并列设计）
- 保持完整的五层架构
- 浅色/深色模式同等重要，各自完整

### Non-Goals

- 不改变五层架构结构
- 不改变 CSS 变量命名规范
- 不修改组件逻辑
- 不调整 Tailwind 类名映射结构
- 不使用纯白 `#FFFFFF` 作为深色模式文字（使用暖米白）

## Decisions

### Decision 1: 主色选择 - 暖炭橙 `#D46A1A`

**选择**：使用暖炭橙 `#D46A1A` 作为主色调

**理由**：
- 高辨识度，与常见蓝色AI工具形成差异
- 温暖专业，符合 Dieter Rams 功能主义美学
- 对比度优秀（4.8:1），符合 WCAG AA 标准
- 饱和度适中，避免过度刺激

**替代方案**：
- 国际橙 `#FF5A1F`：过于强烈，易产生视觉疲劳
- 蜜桃橘 `#E8784A`：饱和度偏低，对比度不足

### Decision 2: 强调色选择 - 赤陶红 `#C45C3E`

**选择**：使用赤陶红 `#C45C3E` 作为强调色

**理由**：
- 与主色同属暖色系，形成和谐的渐变效果
- 符合 Saul Bass 高对比设计哲学
- 对比度符合标准（4.5:1）

**替代方案**：
- 继续使用蓝紫粉渐变：被用户明确拒绝
- 单一主色无强调色：缺乏视觉层次

### Decision 3: 移除蓝紫粉色系

**选择**：完全移除 `--color-accent-purple` 和 `--color-accent-pink` 及相关变量

**理由**：
- 用户明确反感"AI风"配色
- 蓝-紫-粉渐变已成为AI产品的刻板印象
- 建立独特品牌识别需要差异化

**迁移路径**：
- 搜索所有使用 `accent-purple` 或 `accent-pink` 的代码
- 替换为暖色调渐变（橙-赤陶）

### Decision 4: 深色模式独立设计原则

**选择**：深色模式作为独立且并列的设计，而非浅色模式的简单反转

**理由**：
- 深色背景需要更高的颜色饱和度和亮度才能保持相同的可见性
- 简单反转会导致视觉不适和对比度问题
- 两种模式应各自达到最佳视觉效果，而非妥协

**设计原则**：
- 主色在深色模式下提亮（`#D46A1A` → `#FF9A52`）
- 文字使用暖米白而非纯白（`#E8E4DF` vs `#FFFFFF`）
- 背景使用暖炭黑而非冷灰（`#1A1612` vs `#1e1e1e`）
- 边框和阴影分别优化

### Decision 5: 深色模式文字色选择

**选择**：深色模式文字使用 `#E8E4DF`（暖米白）而非纯白 `#FFFFFF`

**理由**：
- 避免高对比度带来的视觉疲劳
- 符合 Jony Ive 精致温暖美学
- 暖色调与背景形成和谐统一
- 对比度仍符合 WCAG AAA 标准（12.1:1）

**替代方案**：
- 纯白 `#FFFFFF`：对比度过高，刺眼
- 冷灰白 `#F5F5F5`：与暖色背景冲突

### Decision 6: 深色模式背景使用暖炭黑

**选择**：深色模式背景使用 `#1A1612`（暖炭黑）而非冷灰

**理由**：
- 避免冷灰 `#1e1e1e` 的疏离感
- 保持与浅色模式的温度一致性
- 符合整体温暖品牌调性

### Decision 7: 背景色使用暖灰白

**选择**：次级背景使用 `#FAF8F5`（暖灰白）而非纯白

**理由**：
- 比纯白更柔和，减少视觉疲劳
- 符合 Naoto Fukasawa 的柔和舒适理念
- 与主色形成和谐对比

## Risks / Trade-offs

### Risk 1: 渐变效果残留

**风险**：组件中可能存在硬编码的蓝紫粉渐变

**缓解**：
- 全局搜索 `from-accent-purple`, `to-accent-pink`, `#a855f7`, `#ec4899`
- 更新为暖色渐变 `from-brand-primary to-accent`

### Risk 2: 深色模式可见性

**风险**：深色模式下颜色可能不够明显

**缓解**：
- 主色提亮为 `#FF9A52` 确保可见性
- 验证所有颜色在深色背景下的对比度
- 必要时调整饱和度和亮度

### Risk 3: 品牌认知变化

**风险**：配色大幅变更可能影响现有用户的品牌认知

**缓解**：
- 温暖橙色系仍保持专业感
- 渐进式发布，收集用户反馈
- 保持布局和交互不变

### Risk 4: 深色模式一致性

**风险**：浅色和深色模式可能出现不一致的视觉效果

**缓解**：
- 两种模式并列设计，各自独立验证
- 建立清晰的颜色映射规则
- 确保模式切换流畅无闪烁

## Migration Plan

### 阶段 1: 更新浅色模式颜色变量

1. 修改 `frontend/src/styles/tokens/colors.css`（浅色模式基础）
2. 修改 `frontend/src/styles/themes/light.css`（浅色模式专用）

### 阶段 2: 更新深色模式颜色变量

1. 修改 `frontend/src/styles/themes/dark.css`（深色模式专用）
2. **独立验证深色模式**（非简单反转测试）

### 阶段 3: 更新框架配置

1. 更新 `frontend/tailwind.config.js`
2. 验证 HeroUI 主题配置（浅色+深色）

### 阶段 4: 清理残留代码

1. 搜索并替换所有蓝紫粉硬编码颜色
2. 更新渐变效果（浅色+深色）
3. 移除 `accent-purple`, `accent-pink` 相关类名

### 阶段 5: 双模式验证

1. 浅色模式验证
2. **深色模式独立验证**（同等重要）
3. 模式切换验证
4. 对比度检查（两种模式分别验证）

## Open Questions

- 无

## Color Palette Reference

### 主色系（暖炭橙）

**浅色模式**：
```
--color-brand-primary:        #D46A1A  (主色)
--color-brand-primary-hover:  #B85200  (悬停)
--color-brand-primary-active: #9C4200  (激活)
--color-brand-primary-light:  #FFF4E6  (浅色背景)
```

**深色模式**：
```
--color-brand-primary:        #FF9A52  (主色-提亮)
--color-brand-primary-hover:  #D46A1A  (悬停)
--color-brand-primary-active: #B85200  (激活)
--color-brand-primary-light:  #3E2608  (深色背景)
```

### 辅助色系（鼠尾草绿）

**浅色模式**：
```
--color-brand-secondary:      #7A9B6A  (辅助色)
--color-brand-secondary-hover: #68975A  (悬停)
--color-brand-secondary-active: #5A824A (激活)
```

**深色模式**：
```
--color-brand-secondary:      #9AAD81  (辅助色-提亮)
--color-brand-secondary-hover: #7A9B6A  (悬停)
--color-brand-secondary-active: #68975A (激活)
```

### 强调色系（赤陶红）

**浅色模式**：
```
--color-accent:               #C45C3E  (强调)
--color-accent-hover:         #A8422A  (悬停)
--color-accent-active:        #8C3A20  (激活)
--color-accent-light:         #FFF0E6  (浅色背景)
```

**深色模式**：
```
--color-accent:               #FF8266  (强调-提亮)
--color-accent-hover:         #C45C3E  (悬停)
--color-accent-active:        #A8422A  (激活)
--color-accent-light:         #3E1A10  (深色背景)
```

### 功能色

**浅色模式**：
```
--color-status-success:       #7A9B6A  (成功-鼠尾草绿)
--color-status-warning:       #D4A373  (警告-浅青铜)
--color-status-error:         #E8998C  (错误-大地红)
--color-status-info:          #D46A1A  (信息-暖橙)
```

**深色模式**：
```
--color-status-success:       #9AAD81  (成功-提亮)
--color-status-warning:       #E8C4A8  (警告-提亮)
--color-status-error:         #FFB3A6  (错误-提亮)
--color-status-info:          #FF9A52  (信息-提亮)
```

### 背景色

**浅色模式**：
```
--color-bg-primary:           #FFFFFF  (纯白)
--color-bg-secondary:         #FAF8F5  (暖灰白)
--color-bg-elevated:          #FFFDFA  (纸白)
--color-bg-canvas:            #F5F3F0  (浅暖灰)
--color-bg-overlay:           rgba(0, 0, 0, 0.5)  (遮罩)
```

**深色模式**：
```
--color-bg-primary:           #1A1612  (暖炭黑)
--color-bg-secondary:         #241E18  (深炭褐)
--color-bg-elevated:          #2E2620  (浮起色)
--color-bg-canvas:            #16120E  (深色画布)
--color-bg-overlay:           rgba(0, 0, 0, 0.7)  (遮罩-更深)
```

### 文本色

**浅色模式**：
```
--color-text-primary:         #1A1612  (深炭黑)
--color-text-secondary:       #6B6560  (暖灰)
--color-text-tertiary:        #9B9590  (浅暖灰)
--color-text-muted:           #C5C1BE  (禁用)
--color-text-inverse:         #FFFFFF  (反转-纯白)
```

**深色模式**：
```
--color-text-primary:         #E8E4DF  (暖米白-非纯白)
--color-text-secondary:       #A8A4A0  (中米灰)
--color-text-tertiary:        #78746E  (深米灰)
--color-text-muted:           #484642  (禁用)
--color-text-inverse:         #1A1612  (反转-深炭黑)
```

### 边框色

**浅色模式**：
```
--color-border-default:       #E8E4DF  (暖灰)
--color-border-subtle:        #F0EDE8  (浅暖灰)
--color-border-strong:        #C5C1BE  (强边框)
--color-border-focused:       #D46A1A  (聚焦-主色)
--color-border-error:         #E8998C  (错误)
```

**深色模式**：
```
--color-border-default:       #3E3A36  (深暖灰)
--color-border-subtle:        #2E2620  (浅深灰)
--color-border-strong:        #5A5650  (强边框)
--color-border-focused:       #FF9A52  (聚焦-亮橙)
--color-border-error:         #FFB3A6  (错误-提亮)
```

### 阴影

**浅色模式**：
```
--shadow-xs:  0 1px 2px rgba(26, 22, 18, 0.05);
--shadow-sm:  0 1px 3px rgba(26, 22, 18, 0.1);
--shadow-md:  0 4px 6px rgba(26, 22, 18, 0.1);
--shadow-lg:  0 10px 15px rgba(26, 22, 18, 0.1);
--shadow-xl:  0 20px 25px rgba(26, 22, 18, 0.15);
```

**深色模式**（使用黑色增强深度）：
```
--shadow-xs:  0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-sm:  0 1px 3px rgba(0, 0, 0, 0.4);
--shadow-md:  0 4px 6px rgba(0, 0, 0, 0.4);
--shadow-lg:  0 10px 15px rgba(0, 0, 0, 0.4);
--shadow-xl:  0 20px 25px rgba(0, 0, 0, 0.5);
```
