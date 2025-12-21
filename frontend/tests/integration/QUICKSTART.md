# 集成测试快速开始

## 🚀 5分钟快速上手

### 1. 验证测试文件

```bash
cd /home/ekko.bao/work/promptxy/frontend
node tests/integration/validate-integration-tests.mjs
```

### 2. 运行所有集成测试

```bash
npm test -- tests/integration/
```

### 3. 查看测试结果

测试将显示：

- 每个测试用例的通过/失败状态
- 详细的错误信息（如果失败）
- 执行时间

## 📖 理解测试结构

### 文件组织

```
tests/integration/
├── pages.test.tsx          # 页面级测试
├── user-flows.test.tsx     # 用户流程测试
├── data-flow.test.tsx      # 数据流测试
├── README.md               # 详细文档
├── QUICKSTART.md           # 快速开始（本文件）
├── INTEGRATION_SUMMARY.md  # 总结报告
└── validate-integration-tests.mjs  # 验证脚本
```

### 测试类型说明

#### pages.test.tsx - 页面级测试

**目的**: 验证单个页面的完整功能

**测试场景**:

- RulesPage: 规则的增删改查
- RequestsPage: 请求的查看、过滤、分页
- PreviewPage: 预览功能
- SettingsPage: 设置管理

**运行**: `npm test -- tests/integration/pages.test.tsx`

#### user-flows.test.tsx - 用户流程测试

**目的**: 验证跨页面的完整工作流

**测试场景**:

- 完整工作流: 创建规则 → 发送请求 → 查看历史
- SSE 实时更新流程
- 错误处理流程
- 复杂用户场景

**运行**: `npm test -- tests/integration/user-flows.test.tsx`

#### data-flow.test.tsx - 数据流测试

**目的**: 验证数据从 API 到 UI 的完整链条

**测试场景**:

- API → Store → Hooks → UI
- 用户操作 → API → 状态 → UI
- Hook 层数据流
- Store 层数据流
- 端到端数据验证

**运行**: `npm test -- tests/integration/data-flow.test.tsx`

## 🔍 调试测试

### 运行单个测试

```bash
npm test -- tests/integration/pages.test.tsx -t "应该处理创建新规则"
```

### 观察模式（自动重跑）

```bash
npm run test:watch -- tests/integration/
```

### 详细输出

```bash
npm test -- tests/integration/ --reporter=verbose
```

## 📊 查看覆盖率

```bash
npm run test:coverage
```

这将生成：

- 终端报告
- `coverage/` 目录下的 HTML 报告
- JSON 格式的数据

## 🛠️ 常见问题

### Q: 测试运行超时？

A: 集成测试默认超时 10 秒，如果需要可以调整 `vitest.config.ts`

### Q: Mock 数据在哪里？

A: 在每个测试文件的顶部，使用 `vi.mock()` 定义

### Q: 如何添加新测试？

A:

1. 选择合适的测试文件类型
2. 参考现有测试结构
3. 使用 `data-testid` 查询元素
4. 使用 `userEvent` 模拟交互

### Q: 测试失败如何排查？

A:

1. 查看错误信息
2. 检查 Mock 是否正确
3. 验证 `data-testid` 是否存在
4. 使用 `console.log` 调试（在测试代码中）

## 🎯 最佳实践

### 1. 测试命名

```typescript
// ✅ 好的命名
it('应该处理创建新规则的完整流程', async () => { ... })

// ❌ 避免
it('test1', async () => { ... })
```

### 2. 使用 userEvent

```typescript
// ✅ 推荐
await user.click(button);
await user.type(input, 'text');

// ❌ 避免
fireEvent.click(button);
```

### 3. 等待异步操作

```typescript
// ✅ 推荐
await waitFor(() => {
  expect(screen.getByText('成功')).toBeInTheDocument();
});

// ❌ 避免
await new Promise(resolve => setTimeout(resolve, 1000));
```

### 4. 清理和重置

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.getState().reset();
});
```

## 📞 获取帮助

如果遇到问题：

1. 查看 `README.md` 详细文档
2. 检查 `INTEGRATION_SUMMARY.md` 了解覆盖范围
3. 运行验证脚本检查文件完整性
4. 查看 Vitest 官方文档

## ✅ 验证清单

在运行测试前，确保：

- [ ] Node.js 已安装（推荐 18+）
- [ ] 依赖已安装（`npm install`）
- [ ] 测试文件存在（运行验证脚本）
- [ ] 配置文件正确（`vitest.config.ts`）

---

**准备好了吗？** 运行 `npm test -- tests/integration/` 开始测试！
