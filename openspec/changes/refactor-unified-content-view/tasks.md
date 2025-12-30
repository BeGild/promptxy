## 1. 组件重命名与扩展

- [ ] 1.1 重命名 `FileBrowserView.tsx` 为 `UnifiedContentView.tsx`
- [ ] 1.2 添加 `isDiffMode` state 用于控制差异对比模式
- [ ] 1.3 添加 `originalTree` prop（可选），用于差异对比
- [ ] 1.4 添加差异计算相关 state：`activeHunkIndex`, `hunks`, `rows`

## 2. 工具栏改造

- [ ] 2.1 添加"差异对比"按钮（仅当 `originalTree` 存在时显示）
- [ ] 2.2 添加差异导航按钮：`← 上一个`、`下一个 →`（仅 `isDiffMode=true` 时显示）
- [ ] 2.3 实现按钮状态样式：激活/未激活/禁用
- [ ] 2.4 实现差异块导航逻辑：`handlePrevHunk`, `handleNextHunk`

## 3. 差异计算逻辑迁移

- [ ] 3.1 从 `DiffView.tsx` 迁移 `collectChangedLeafNodes` 函数
- [ ] 3.2 从 `DiffView.tsx` 迁移 `buildHunks`, `diffLines` 相关逻辑
- [ ] 3.3 实现 `originalTree` 查找逻辑：`findNodeByPath`
- [ ] 3.4 默认选中第一个变化节点（差异模式下）

## 4. 内容面板条件渲染

- [ ] 4.1 实现条件渲染：`isDiffMode` 时显示 `DiffContentPanel`，否则显示 `FileContentPanel`
- [ ] 4.2 确保 `FileContentPanel` 的 props 正确传递
- [ ] 4.3 确保 `DiffContentPanel` 的 props 正确传递（`rows`, `hunks`, `activeHunkIndex` 等）

## 5. RequestDetailPanel 简化

- [ ] 5.1 移除 `viewMode` state
- [ ] 5.2 删除视图切换标签区域（第 192-212 行）
- [ ] 5.3 修改渲染逻辑：直接渲染 `UnifiedContentView`，传入 `originalTree`
- [ ] 5.4 删除 `SummaryView` 导入
- [ ] 5.5 删除 `DiffView` 导入

## 6. 删除废弃组件

- [ ] 6.1 删除 `SummaryView.tsx`
- [ ] 6.2 删除 `DiffView.tsx`
- [ ] 6.3 删除 `DiffToolbar.tsx`

## 7. 样式调整

- [ ] 7.1 调整工具栏样式，确保所有按钮布局协调
- [ ] 7.2 确保差异对比模式下的样式与原 `DiffView` 一致
- [ ] 7.3 确保按钮状态（激活/未激活/禁用）视觉区分清晰

## 8. 测试验证

- [ ] 8.1 验证内容详情模式：文件树导航、内容显示、预览切换、复制、全屏
- [ ] 8.2 验证差异对比模式：差异计算、导航按钮、高亮显示
- [ ] 8.3 验证模式切换：点击"差异对比"按钮后的状态切换
- [ ] 8.4 验证边界情况：无 `originalTree` 时按钮隐藏、无差异时导航按钮禁用
- [ ] 8.5 验证响应式布局：不同屏幕尺寸下的显示效果
