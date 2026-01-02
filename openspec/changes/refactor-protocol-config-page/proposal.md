# Change: 重构协议转换配置页面

## Why

当前 PromptXY 项目存在严重的配置可见性问题，用户无法理解和使用协议转换配置。

**核心问题**:

1. **配置可见性缺失**:
   - 用户在"供应商管理"页面配置了多个供应商（如 supply1, supply2）
   - 但用户根本不知道当前使用的 `/claude` 路径实际对应的是哪个供应商
   - 无法快速查看和切换当前激活的供应商

2. **测试页面脱节**:
   - `ProtocolLabPage` 仅仅是做一个测试功能
   - 用户在测试页面选择的供应商和配置，与实际使用的配置没有关联
   - 测试结果无法反映真实的配置状态

3. **监控页面信息缺失**:
   - `RequestsPage` 显示请求历史，但详情页面完全没有显示：
     - 请求发送给了哪个供应商
     - 协议转换的具体情况
     - 转换链的执行过程
   - 用户无法从监控页面了解请求的实际路由和转换情况

4. **配置入口不明确**:
   - 用户不知道从哪里配置协议转换
   - "供应商管理"和"协议转换实验室"两个页面功能重叠，容易混淆
   - 缺少统一的配置入口和清晰的操作流程

**根本原因**:
- 页面之间缺乏关联和数据同步
- 配置状态和实际使用状态没有明确映射
- 缺少配置的实时可见性和透明度

**解决方案**:
创建一个统一的协议配置页面，让用户能够：
- 清晰看到当前 `/claude` 路径对应的供应商
- 快速切换供应商
- 实时预览转换链
- 测试验证配置

## What Changes

- **合并页面**: 将 `ProtocolLabPage` 和 `SupplierManagement` 合并为一个统一的 `ProtocolConfigPage`
- **简化 UI**: 移除企业级复杂功能，保留核心的配置、切换、测试功能
- **新增组件**:
  - 工具选择器（claude_code, codex, gemini）
  - 简化的供应商列表（按协议分组）
  - 转换链可视化（简化版）
  - 测试验证组件
- **增强监控页面**: 在 RequestsPage 详情中显示供应商和转换信息
  - 新增"路由信息"区域
  - 显示供应商名称和地址
  - 显示转换链可视化
  - 显示转换追踪信息
  - 提供跳转到配置页面的链接
- **全局配置状态**: 在 Header 中添加配置状态指示器
  - 显示每个路径（/claude, /openai, /gemini）对应的供应商
  - 实时更新
  - 点击跳转到配置页面
- **增强数据存储**: 在 RequestRecord 中新增字段
  - `supplierId`: 供应商 ID
  - `supplierName`: 供应商名称
  - `transformerChain`: 使用的转换链
  - `transformTrace`: 转换追踪信息
- **移除功能**:
  - 智能推荐系统
  - 并行预览
  - 性能分析面板
  - 历史记录
  - 导出功能
- **优化交互**:
  - 一键切换供应商
  - 实时预览转换链
  - 快速测试验证

## Impact

- **Affected specs**:
  - 新增: `protocol-config` (协议配置管理能力)
  - 修改: `request-viewer` (增强请求详情显示)
- **Affected code**:
  - `frontend/src/pages/ProtocolLabPage.tsx` - 将被删除
  - `frontend/src/components/settings/SupplierManagement.tsx` - 将被删除
  - `frontend/src/App.tsx` - 更新路由配置和 Header
  - `frontend/src/pages/RequestsPage.tsx` - 增强请求详情显示
  - 新增: `frontend/src/pages/ProtocolConfigPage.tsx`
  - 新增: `frontend/src/components/protocol-config/` (子组件目录)
  - 新增: `frontend/src/components/request-detail/` (请求详情子组件)
  - `backend/src/promptxy/types.ts` - 扩展 RequestRecord 类型
  - `backend/src/promptxy/gateway.ts` - 记录供应商和转换信息
- **Breaking changes**:
  - 原 `ProtocolLabPage` 和 `SupplierManagement` 页面将被删除
  - 导航菜单中的"协议转换实验室"和"供应商管理"将合并为"协议配置"
  - RequestRecord 类型新增字段（向后兼容，可选字段）