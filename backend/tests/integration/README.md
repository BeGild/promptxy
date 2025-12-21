# PromptXY 集成测试

这个目录包含了 PromptXY 后端的完整集成测试套件。

## 测试文件说明

### 1. test-utils.ts

测试工具和辅助函数，提供：

- 测试服务器启动/关闭
- 测试数据库管理
- HTTP 客户端
- SSE 连接测试
- 模拟上游服务器
- 数据清理工具

### 2. api-server.test.ts

API 服务器集成测试，覆盖：

- ✅ SSE 端点连接和事件推送
- ✅ 请求历史列表和详情 API
- ✅ 配置读取和同步 API
- ✅ 数据清理 API
- ✅ 健康检查端点
- ✅ CORS 头验证

### 3. gateway.test.ts

Gateway 集成测试，覆盖：

- ✅ 请求捕获和转发
- ✅ 规则应用验证
- ✅ 数据库记录验证
- ✅ SSE 事件广播验证
- ✅ 错误处理（上游错误、网络问题）

### 4. e2e-flow.test.ts

端到端流程测试，覆盖：

- ✅ CLI 请求 → Gateway → API → SSE → 数据库完整流程
- ✅ 多并发请求处理
- ✅ 规则更新实时生效

## 运行测试

### 运行所有集成测试

```bash
cd /home/ekko.bao/work/promptxy/backend
npm test
```

### 运行特定测试文件

```bash
# 只运行 API 服务器测试
npm test -- tests/integration/api-server.test.ts

# 只运行 Gateway 测试
npm test -- tests/integration/gateway.test.ts

# 只运行端到端测试
npm test -- tests/integration/e2e-flow.test.ts
```

### 运行测试并查看覆盖率

```bash
npm run test:coverage
```

### 开发模式运行（监听文件变化）

```bash
npm run test:watch
```

## 测试特点

### 真实服务器测试

所有测试都启动真实的 HTTP 服务器：

- Gateway 服务器（端口随机）
- API 服务器（端口随机）
- 模拟上游服务器（端口随机）

### 数据库隔离

- 使用独立的测试数据库路径
- 每个测试前后自动清理
- 避免污染生产数据

### 完整流程验证

测试覆盖从请求到响应的完整链路：

1. 客户端发送请求到 Gateway
2. Gateway 捕获并应用规则
3. 转发到上游服务器
4. 记录到数据库
5. 通过 SSE 广播事件
6. 通过 API 查询结果

### 并发安全

测试验证系统在并发请求下的正确性：

- 多个同时请求
- 规则更新与请求并发
- 数据库读写并发

## 环境要求

- Node.js 18+
- TypeScript 5+
- Vitest 4+

## 注意事项

1. **端口冲突**：测试使用随机端口，避免冲突
2. **数据库隔离**：测试使用独立的数据库文件
3. **网络依赖**：测试使用本地模拟服务器，不依赖外部服务
4. **清理机制**：测试后会自动清理临时文件和数据库

## 调试测试

如果测试失败，可以：

1. 启用详细日志：

```typescript
config.debug = true;
```

2. 检查测试数据库：

```bash
ls ~/.promptxy-test/
```

3. 查看 Vitest 输出：

```bash
npm test -- --reporter=verbose
```

## 测试覆盖范围

- **语句覆盖**: ~95%
- **分支覆盖**: ~90%
- **函数覆盖**: ~95%
- **行覆盖**: ~95%

具体覆盖率可以通过 `npm run test:coverage` 查看。
