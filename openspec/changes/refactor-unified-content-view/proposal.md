# Change: 重构详情页面为统一内容视图

## Why

当前详情页面采用三个独立视图（结构概览、内容详情、差异对比）通过标签切换的设计，存在以下问题：

1. **界面层级过多**：三个视图标签占据额外空间，增加视觉复杂度
2. **默认体验不佳**：用户打开详情页首先看到"结构概览"，而非最常用的"内容详情"
3. **功能分散**：差异对比作为独立视图，与内容详情割裂，切换成本高
4. **代码冗余**：三个视图组件（`SummaryView`、`FileBrowserView`、`DiffView`）维护成本高

## What Changes

- **移除视图切换标签区域**：删除 RequestDetailPanel 中的三个视图切换按钮
- **合并视图组件**：将 `FileBrowserView` 扩展为 `UnifiedContentView`，整合差异对比功能
- **新增差异对比按钮**：在工具栏添加"差异对比"切换按钮（仅当有原始请求时显示）
- **整合工具栏**：差异对比模式的导航按钮整合到统一工具栏中
- **废弃冗余组件**：删除 `SummaryView`、`DiffView`、`DiffToolbar` 组件

## Impact

- Affected specs: `request-viewer`
- Affected code:
  - `frontend/src/components/request-viewer/components/RequestDetailPanel.tsx`
  - `frontend/src/components/request-viewer/components/views/FileBrowserView.tsx` → 改名为 `UnifiedContentView.tsx`
  - `frontend/src/components/request-viewer/components/views/SummaryView.tsx` → 删除
  - `frontend/src/components/request-viewer/components/views/DiffView.tsx` → 删除
  - `frontend/src/components/request-viewer/components/diff/DiffToolbar.tsx` → 删除
