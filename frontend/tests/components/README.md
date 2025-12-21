# 组件测试文档

## 概述

这个目录包含了 PromptXY 前端所有组件的单元测试，使用 Vitest + React Testing Library + user-event 进行测试。

## 测试文件结构

```
tests/components/
├── common.test.tsx      # 通用组件测试
├── layout.test.tsx      # 布局组件测试
├── rules.test.tsx       # 规则组件测试
├── requests.test.tsx    # 请求组件测试
├── preview.test.tsx     # 预览组件测试
└── settings.test.tsx    # 设置组件测试
```

## 测试覆盖范围

### 1. 通用组件 (`common.test.tsx`)

- **StatusIndicator**: 连接状态显示测试
  - 已连接状态显示
  - 未连接状态显示
  - 错误状态显示
  - 文本隐藏功能
  - 错误信息显示逻辑

- **Modal**: 可复用模态框测试
  - 开/关状态渲染
  - 自定义页脚
  - 不同尺寸和背景
  - 多子元素渲染

- **EmptyState**: 空状态占位符测试
  - 基本渲染
  - 自定义图标
  - 操作按钮逻辑
  - 样式应用

### 2. 布局组件 (`layout.test.tsx`)

- **Header**: 导航栏和状态指示器测试
  - 应用名称和版本显示
  - 活动标签翻译
  - 侧边栏切换按钮
  - 双状态指示器 (API + SSE)
  - 状态传递逻辑

- **Sidebar**: 页面导航和快速统计测试
  - 展开/折叠状态
  - 菜单项渲染
  - 活动项标记
  - 菜单点击处理
  - 提示信息显示

### 3. 规则组件 (`rules.test.tsx`)

- **RuleList**: 虚拟滚动列表、搜索过滤测试
  - 加载状态
  - 空状态
  - 规则卡片渲染
  - 搜索过滤功能
  - 客户端筛选
  - 分页逻辑

- **RuleCard**: 规则摘要卡片、启用/禁用切换测试
  - 规则信息显示
  - 匹配条件标签
  - 正则信息显示
  - 启用/禁用状态
  - 操作按钮处理
  - 工具提示

- **RuleEditor**: 动态表单、验证、预览测试
  - 新建/编辑模式
  - 表单输入处理
  - UUID 生成
  - 操作添加/删除
  - 动态字段显示
  - 验证逻辑
  - 预览功能

### 4. 请求组件 (`requests.test.tsx`)

- **RequestList**: 实时列表、过滤、分页测试
  - 加载状态
  - 空状态
  - 表格渲染
  - 搜索和筛选
  - 行操作 (查看/删除)
  - 分页逻辑
  - 数据格式化

- **RequestDetail**: 模态视图、原始/修改对比测试
  - 加载状态
  - 基本信息显示
  - 匹配规则显示
  - 差异对比
  - 响应头显示
  - 错误信息处理
  - 操作按钮

- **DiffViewer**: 侧边对比、语法高亮测试
  - 无变化状态
  - 对比视图切换
  - JSON 格式化
  - 不同数据类型处理
  - 复杂结构处理

### 5. 预览组件 (`preview.test.tsx`)

- **PreviewPanel**: 测试输入、规则应用、前后对比测试
  - 初始渲染
  - 输入交互
  - 预览操作
  - 加载状态
  - 错误处理
  - 结果渲染
  - 边缘情况

### 6. 设置组件 (`settings.test.tsx`)

- **SettingsPanel**: 配置管理、导出/导入、数据清理测试
  - 加载状态
  - 统计信息显示
  - 配置导出/导入
  - 数据清理
  - 关于信息
  - UI 结构
  - 边缘情况

## 运行测试

### 运行所有测试

```bash
npm test
# 或
vitest
```

### 运行特定组件测试

```bash
# 运行通用组件测试
vitest run tests/components/common.test.tsx

# 运行布局组件测试
vitest run tests/components/layout.test.tsx

# 运行规则组件测试
vitest run tests/components/rules.test.tsx

# 运行请求组件测试
vitest run tests/components/requests.test.tsx

# 运行预览组件测试
vitest run tests/components/preview.test.tsx

# 运行设置组件测试
vitest run tests/components/settings.test.tsx
```

### 运行测试并监视

```bash
vitest watch
```

### 生成覆盖率报告

```bash
npm run test:coverage
```

## 测试特点

### 1. 用户交互模拟

- 使用 `@testing-library/user-event` 模拟真实用户行为
- 测试表单输入、按钮点击、选择操作等
- 验证事件处理函数的正确调用

### 2. 状态管理测试

- 模拟 React hooks (useUIStore, usePreviewRule 等)
- 测试组件在不同状态下的渲染
- 验证状态变化的正确性

### 3. 边缘情况覆盖

- 空数据、加载状态、错误处理
- 边界值、特殊字符、长文本
- 异步操作、并发请求

### 4. UI 验证

- 验证组件结构和布局
- 检查文本内容和属性
- 确认样式类名应用

### 5. Mock 策略

- 外部依赖完全 mock
- 保持测试隔离性
- 模拟 API 响应和工具函数

## 最佳实践

1. **测试描述清晰**: 使用中文描述测试目的
2. **独立测试**: 每个测试用例独立运行，不依赖其他测试
3. **用户视角**: 从用户角度测试组件行为
4. **完整覆盖**: 覆盖主要功能和边缘情况
5. **维护性**: 保持测试代码简洁易读

## 依赖说明

- **Vitest**: 测试运行器
- **React Testing Library**: React 组件测试工具
- **User Event**: 用户交互模拟
- **Jest DOM**: DOM 断言扩展

## 注意事项

1. 所有测试文件使用 `.tsx` 扩展名以支持 TypeScript
2. 使用中文 commit message 和测试描述
3. 遵循项目代码规范和架构设计
4. 定期更新测试以匹配组件变更
