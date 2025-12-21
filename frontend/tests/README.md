# PromptXY 前端单元测试

这个目录包含了 PromptXY 前端应用的完整单元测试套件，使用 Vitest + React Testing Library 构建。

## 测试覆盖范围

### 1. 工具函数测试 (`utils.test.ts`)

覆盖 `frontend/src/utils/` 目录下的所有工具函数：

- **formatter.ts**:
  - `formatTime` - 时间格式化
  - `formatRelativeTime` - 相对时间格式化
  - `formatBytes` - 字节大小格式化
  - `formatJSON` - JSON 美化
  - `formatDuration` - 持续时间格式化
  - `truncate` - 字符串截断
  - `formatClient` - 客户端名称格式化
  - `formatStatus` - 状态码格式化
  - `getStatusColor` - 状态颜色获取
  - `generateUUID` - UUID 生成

- **validator.ts**:
  - `validateRule` - 规则格式验证
  - `validateRegex` - 正则表达式验证
  - `checkRuleConflicts` - 规则冲突检测
  - `createDefaultRule` - 默认规则生成

- **diff.ts**:
  - `generateJSONDiff` - JSON 差异对比算法
  - `generateLineDiff` - 行级差异比较
  - `highlightDiff` - 差异高亮显示
  - `formatJSONWithPath` - 带路径的 JSON 格式化

### 2. API 客户端测试 (`api.test.ts`)

覆盖 `frontend/src/api/` 目录下的所有 API 客户端：

- **client.ts**:
  - Axios 实例配置
  - 请求/响应拦截器
  - 错误处理
  - 健康检查

- **sse.ts**:
  - SSE 连接管理
  - 自动重连逻辑
  - 事件解析
  - 连接状态管理

- **rules.ts**:
  - 获取规则列表
  - 同步规则
  - 创建/更新/删除规则
  - 批量更新
  - 规则预览

- **requests.ts**:
  - 获取请求列表（支持过滤和分页）
  - 获取请求详情
  - 删除请求
  - 清理旧数据
  - 获取统计信息
  - 获取数据库信息

- **config.ts**:
  - 导出配置
  - 导入配置
  - 下载配置文件
  - 上传配置文件

### 3. Hooks 测试 (`hooks.test.ts`)

覆盖 `frontend/src/hooks/` 目录下的所有 React Hooks：

- **useRules.ts**:
  - `useRules` - 获取规则列表
  - `useSaveRules` - 保存规则
  - `useCreateRule` - 创建规则
  - `useUpdateRule` - 更新规则
  - `useDeleteRule` - 删除规则
  - `useBatchUpdateRules` - 批量更新
  - `usePreviewRule` - 预览规则
  - `useRule` - 获取单个规则
  - 增量 API hooks

- **useRequests.ts**:
  - `useRequests` - 获取请求列表
  - `useRequestDetail` - 获取请求详情
  - `useDeleteRequest` - 删除请求
  - `useCleanupRequests` - 清理请求
  - `useStats` - 获取统计信息
  - `useDatabaseInfo` - 获取数据库信息

- **useSSE.ts**:
  - `useSSE` - SSE 连接管理
  - 重连功能
  - 断开连接

- **useConfig.ts**:
  - `useExportConfig` - 导出配置
  - `useImportConfig` - 导入配置
  - `useDownloadConfig` - 下载配置
  - `useUploadConfig` - 上传配置
  - `useConfig` - 获取配置

### 4. Store 测试 (`store.test.ts`)

覆盖 `frontend/src/store/` 目录下的所有状态管理：

- **app-store.ts**:
  - 全局应用状态
  - 规则管理
  - 请求管理
  - 统计信息
  - SSE 状态
  - API 连接状态
  - 错误处理
  - 加载状态

- **ui-store.ts**:
  - 模态框状态
  - 当前选中项
  - UI 状态（侧边栏、活动标签）
  - UI 操作方法

## 运行测试

### 安装依赖

```bash
cd frontend
npm install
```

### 运行所有测试

```bash
npm run test:run
```

### 运行测试并监视文件变化

```bash
npm run test:watch
```

### 运行测试并生成覆盖率报告

```bash
npm run test:coverage
```

### 运行特定测试文件

```bash
npx vitest run tests/unit/utils.test.ts
```

### 使用测试脚本

```bash
./tests/run-all-tests.sh
```

## 测试配置

### Vitest 配置

配置文件位于 `frontend/vitest.config.ts`，包含：

- 测试环境：jsdom
- 全局导入
- 路径别名
- 覆盖率配置

### 测试设置

设置文件位于 `frontend/tests/setup.ts`，包含：

- DOM 清理
- 全局模拟（EventSource, localStorage, FileReader）
- 类型定义

## 模拟策略

### API 调用模拟

- 使用 `vi.mock()` 模拟所有 API 模块
- 模拟 axios 实例和方法
- 支持成功和失败场景

### SSE 连接模拟

- 模拟 EventSource 类
- 支持连接、断开、事件触发
- 模拟自动重连逻辑

### Store 模拟

- 模拟 zustand middleware
- 提供独立的 store 实例
- 支持状态重置

## 测试最佳实践

1. **独立性**: 每个测试都是独立的，可以单独运行
2. **清理**: 使用 afterEach 清理 DOM 和模拟
3. **异步处理**: 使用 waitFor 处理异步操作
4. **状态管理**: 使用 act 包装状态更新
5. **错误场景**: 覆盖成功和失败两种情况
6. **边界条件**: 测试空值、无效输入等边界情况

## 测试覆盖率目标

- **语句覆盖率**: > 90%
- **分支覆盖率**: > 85%
- **函数覆盖率**: > 90%
- **行覆盖率**: > 90%

## 持续集成

在 CI/CD 流程中，建议：

1. 运行 `npm run test:run` 确保所有测试通过
2. 运行 `npm run test:coverage` 检查覆盖率
3. 如果覆盖率低于目标，阻止合并

## 故障排除

### 常见问题

1. **测试超时**
   - 检查异步操作是否正确使用 waitFor
   - 确保模拟函数返回 Promise

2. **模拟不生效**
   - 确保在导入前调用 vi.mock()
   - 检查路径别名配置

3. **类型错误**
   - 确保 tsconfig.test.json 包含正确类型
   - 检查 @types/node 和 vitest 类型

4. **DOM 相关错误**
   - 确保在 setup.ts 中配置了必要的模拟
   - 检查 @testing-library/jest-dom 导入

## 维护指南

### 添加新功能时的步骤

1. 编写源代码
2. 编写对应的单元测试
3. 确保覆盖所有分支和边界情况
4. 运行测试验证
5. 更新覆盖率报告

### 更新现有测试时的注意事项

1. 保持测试的独立性
2. 不要过度依赖实现细节
3. 优先测试公共 API
4. 保持测试的可读性
