# Change: 优化差异计算以支持转换器分离

## Why

当前请求详情页面的差异对比功能存在以下问题：

1. **协议转换干扰差异识别**：当请求经过协议转换器（如 Claude→Codex）时，即使没有应用任何规则，差异对比也会显示大量变更，因为这些差异来自协议转换而非规则修改
2. **无法准确反映规则效果**：用户无法区分"协议转换导致的差异"和"规则修改导致的差异"，导致无法准确评估规则引擎的实际效果
3. **用户体验混淆**：用户期望看到的是规则的修改效果，但看到的是协议转换的差异

## What Changes

- 在 `RequestRecord` 类型中新增 `transformedBody` 字段，用于存储转换器处理后的请求
- 在网关中保存转换器处理后的请求状态（`transformedBody`）
- 修改前端差异对比逻辑：
  - 当存在 `transformedBody` 时：对比 `transformedBody` vs `modifiedBody`
  - 当不存在 `transformedBody` 时（无转换器）：对比 `originalBody` vs `modifiedBody`
- 优化差异展示的标签文案，更准确反映左右两侧的含义
- 保持向后兼容，`transformedBody` 为可选字段，老数据自动 fallback 到 `originalBody`

## Impact

- **Affected specs**:
  - `request-viewer` - 修改差异对比逻辑和展示
  - `promptxy-gateway` - 修改请求记录存储，添加 `transformedBody` 字段

- **Affected code**:
  - `backend/src/promptxy/types.ts` - 添加 `transformedBody` 字段定义
  - `backend/src/promptxy/database.ts` - 支持存储和读取 `transformedBody`
  - `backend/src/promptxy/gateway.ts` - 在转换器处理后保存 `transformedBody`
  - `backend/src/promptxy/api-handlers.ts` - API 返回时解析 `transformedBody`
  - `frontend/src/types/request.ts` - 添加 `transformedBody` 字段
  - `frontend/src/components/requests/RequestDetail.tsx` - 传递正确的对比基准
  - `frontend/src/components/requests/DiffViewer.tsx` - 优化标签文案

## Migration Strategy

1. **数据库迁移**：`transformedBody` 为可选字段，老数据没有该字段时自动兼容
2. **API 兼容性**：保持 API 响应格式不变，新增字段不影响现有功能
3. **前端渐进适配**：使用 `request.transformedBody || request.originalBody` 确保向后兼容
