# 集成测试文档

## 概述

这些集成测试覆盖了 PromptXY 前端的完整用户流程和数据流，使用 Vitest + React Testing Library + MSW（模拟 API）来验证系统在真实场景下的行为。

## 测试文件说明

### 1. pages.test.tsx - 页面级集成测试

**覆盖范围：**

- **RulesPage**: 规则管理完整流程
  - 创建规则（新建 → 填写 → 保存）
  - 编辑规则（选择 → 修改 → 保存）
  - 删除规则（确认 → 删除 → 刷新）
  - 启用/禁用切换
  - 统计卡片显示

- **RequestsPage**: 请求历史完整流程
  - 请求列表显示
  - 搜索和过滤（客户端、关键词）
  - 查看详情（点击 → 加载 → 显示）
  - 删除请求
  - 分页操作

- **PreviewPage**: 规则预览流程
  - 预览面板显示
  - 输入参数配置

- **SettingsPage**: 设置管理流程
  - 配置查看
  - 导出/导入
  - 数据清理

### 2. user-flows.test.tsx - 用户流程测试

**覆盖范围：**

#### 完整工作流测试

```
创建规则 → 发送请求 → 查看历史 → 验证规则应用
```

- 从零开始创建规则
- 模拟请求到达（SSE 事件）
- 在历史中查看请求
- 验证规则对请求的修改效果

#### SSE 实时更新流程

- SSE 连接建立
- 实时事件接收
- 新请求自动添加到列表
- 连接断开和自动重连
- 错误状态显示

#### 错误处理流程

- **API 断开**: 网络错误处理
- **无效数据**: 数据验证失败
- **网络错误**: 重试机制
- **用户取消**: 确认对话框取消
- **预览错误**: 错误状态显示

#### 复杂场景

- **批量操作**: 同时操作多个规则
- **组合过滤**: 搜索 + 过滤 + 分页
- **配置管理**: 导出/导入/清理完整流程

### 3. data-flow.test.tsx - 数据流集成测试

**覆盖范围：**

#### API → 状态 → UI 数据链条

- 规则数据从 API 到 UI 的传递
- 请求数据从 API 到 UI 的传递
- 统计数据在 Store 中的更新
- 配置数据的完整链条

#### 用户操作 → API 调用 → 状态更新 → UI 响应

- **创建规则**: 完整数据流验证
- **删除规则**: 数据流验证
- **搜索过滤**: 参数传递验证
- **分页**: Offset/limit 验证

#### Hook 层数据流

- `useRules`: 规则管理 Hook
- `useSaveRules`: 保存规则 Hook
- `useDeleteRule`: 删除规则 Hook
- `useRequests`: 请求列表 Hook
- `useRequestDetail`: 请求详情 Hook
- `useConfig`: 配置管理 Hook
- `useExportConfig`: 导出配置 Hook
- `useImportConfig`: 导入配置 Hook

#### Store 层数据流

- 规则状态管理
- 请求状态管理
- SSE 状态更新
- 新请求添加（SSE）
- 保存规则并更新
- 错误处理
- 状态重置

#### 端到端数据流验证

- **完整链条**: API → Store → Hooks → UI
- **用户操作触发**: 验证操作触发完整数据流

## 运行测试

### 运行所有集成测试

```bash
cd /home/ekko.bao/work/promptxy/frontend
npm test -- tests/integration/
```

### 运行特定测试文件

```bash
# 页面级测试
npm test -- tests/integration/pages.test.tsx

# 用户流程测试
npm test -- tests/integration/user-flows.test.tsx

# 数据流测试
npm test -- tests/integration/data-flow.test.tsx
```

### 运行并观察

```bash
npm run test:watch -- tests/integration/
```

### 生成覆盖率报告

```bash
npm run test:coverage
```

## 测试特点

### 1. 真实场景模拟

- 使用 React Testing Library 模拟真实用户交互
- Mock API 调用模拟后端响应
- 模拟 SSE 事件处理实时更新

### 2. 完整流程覆盖

- **页面级**: 单个页面的完整功能
- **用户级**: 跨页面的用户工作流
- **数据级**: 数据流动的完整链条

### 3. 错误处理验证

- 网络错误
- API 错误
- 用户取消
- 数据验证失败

### 4. 状态管理验证

- Zustand Store 状态更新
- React Query 缓存和更新
- UI 状态同步

## 关键测试场景

### 场景 1: 完整工作流

```
1. 用户打开规则页面
2. 创建新规则 "test-rule"
3. 触发 SSE 事件（新请求）
4. 打开请求历史页面
5. 查看请求详情
6. 验证规则应用效果
```

### 场景 2: SSE 实时更新

```
1. 打开请求页面
2. SSE 连接建立
3. 接收新请求事件
4. UI 自动更新
5. 连接断开重连
```

### 场景 3: 错误恢复

```
1. API 断开连接
2. 显示错误状态
3. 自动重试机制
4. 恢复后继续工作
```

## Mock 说明

### API Mock

- `apiClient.get`: GET 请求
- `apiClient.post`: POST 请求
- `apiClient.put`: PUT 请求
- `apiClient.delete`: DELETE 请求

### SSE Mock

- `EventSource`: 模拟 SSE 连接
- `connect()`: 建立连接
- `disconnect()`: 断开连接
- 事件回调模拟

### HeroUI 组件 Mock

- 简化版组件，支持测试交互
- 提供 data-testid 用于查询
- 模拟表单输入和按钮点击

## 测试最佳实践

1. **使用 data-testid**: 便于在测试中查询元素
2. **异步等待**: 使用 `waitFor` 等待状态更新
3. **用户事件**: 使用 `userEvent` 模拟真实交互
4. **清理状态**: 每个测试前重置 store 和 mock
5. **断言完整**: 验证 API 调用、状态更新、UI 变化

## 维护指南

### 添加新功能测试

1. 确定测试类型（页面/流程/数据）
2. 添加对应的 mock
3. 编写测试用例
4. 验证完整数据流

### 更新现有测试

1. 检查 mock 是否需要更新
2. 验证测试是否仍然通过
3. 更新测试文档

### 调试测试

```bash
# 使用 verbose 模式
npm test -- --reporter=verbose

# 调试特定测试
npm test -- --inspect
```

## 性能考虑

- 测试使用 fake timers 加速异步操作
- Mock 数据最小化，只包含必要字段
- 使用 `beforeEach` 清理，避免测试间干扰

## 未来扩展

### 可添加的测试

- 性能测试（加载时间、渲染性能）
- 可访问性测试（ARIA 标签、键盘导航）
- 视觉回归测试（截图对比）
- E2E 测试（使用 Playwright/Cypress）

### 测试覆盖率目标

- 页面级: 90%+
- 用户流程: 85%+
- 数据流: 95%+

## 相关文档

- [项目架构](/docs/ARCHITECTURE.md)
- [API 文档](/docs/API.md)
- [组件文档](/docs/COMPONENTS.md)
