# Change: 添加上游供应商配置与路径映射系统

## Why

当前 PromptXY 的上游配置存在以下限制：

1. **固定供应商绑定**：`claude`/`openai`/`gemini` 与特定 API 硬绑定，无法灵活切换
2. **路径直接透传**：上游路径变化会影响 CLI 配置
3. **测试困难**：临时测试新的上游供应商需要修改配置文件，无法快速切换

本变更旨在：
- 将上游配置改为"供应商列表"模式，支持配置多个供应商
- 每个供应商有独立的本地路径前缀（如 `/claude`）、上游地址、路径映射规则
- 通过 `enabled` 字段控制供应商启用状态，实现快速切换
- 路径冲突检测：相同本地路径前缀的供应商不能同时启用

## What Changes

- **BREAKING** 重构配置结构，从 `upstreams: { claude, openai, gemini }` 改为 `suppliers: Supplier[]`
- 每个 Supplier 包含：`id`、`name`、`baseUrl`、`localPrefix`、`pathMappings`、`enabled`
- 路由识别改为基于所有已启用供应商的 `localPrefix` 进行匹配
- UI 添加供应商管理页面，支持增删改查、快速启用/禁用
- 相同 `localPrefix` 的供应商用相同颜色标识，便于识别冲突

## Impact

- Affected specs:
  - `promptxy-gateway` (MODIFIED)
- Affected code:
  - `backend/src/promptxy/types.ts` - Supplier 类型定义
  - `backend/src/promptxy/config.ts` - 默认配置与验证
  - `backend/src/promptxy/gateway.ts` - 路由识别逻辑
  - `backend/src/promptxy/api-server.ts` - 供应商管理 API
  - `frontend/src/components/settings/SettingsPanel.tsx` - 重构为供应商管理 UI
  - `frontend/src/components/settings/SupplierManagement.tsx` - 新增供应商管理组件
  - `promptxy.config.example.json` - 示例配置更新
- Compatibility:
  - **BREAKING** 旧配置格式不再兼容，需要手动迁移
- Security:
  - 无安全影响
