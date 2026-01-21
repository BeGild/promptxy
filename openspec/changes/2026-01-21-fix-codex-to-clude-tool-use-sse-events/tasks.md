# 实现任务清单

## 阶段 1：类型定义更新

- [x] 添加 `CodexFunctionCallArgumentsDeltaEvent` 类型定义
  - 文件：`backend/src/promptxy/transformers/protocols/codex/types.ts`
  - 在 `CodexSSEEventType` 中添加 `'response.function_call_arguments.delta'`
  - 定义新事件类型

- [x] 更新 `CodexSSEEvent` 联合类型
  - 文件：`backend/src/promptxy/transformers/protocols/codex/types.ts`
  - 添加 `CodexFunctionCallArgumentsDeltaEvent` 到联合类型

## 阶段 2：状态机扩展

- [x] 扩展 State 类型
  - 文件：`backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`
  - 添加 `currentActiveToolIndex?: number`
  - 添加 `currentToolCallStarted: boolean`
  - 更新 `createInitialState()` 函数

## 阶段 3：事件处理实现

- [x] 实现 `response.output_item.added` 处理
  - 文件：`backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`
  - 在 `transformSingleEvent` 中添加 case
  - 设置 `hasToolCall = true`
  - 关闭 text block（如果存在）
  - 发送 `content_block_start`
  - 发送空字符串 `content_block_delta`

- [x] 实现 `response.function_call_arguments.delta` 处理
  - 文件：`backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`
  - 在 `transformSingleEvent` 中添加 case
  - 检查 `currentActiveToolIndex` 是否存在
  - 发送 `content_block_delta(partial_json=delta)`

- [x] 修改 `response.output_item.done` 处理
  - 文件：`backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`
  - 简化为仅发送 `content_block_stop`
  - 清除 `currentActiveToolIndex` 和 `currentToolCallStarted`
  - 递增 `currentToolIndex`

- [x] 移除/重构 `transformToolCall` 函数
  - 文件：`backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`
  - 旧的 `transformToolCall` 逻辑被分散到各事件处理中
  - 已删除不再需要的函数

## 阶段 4：测试

- [x] 更新现有测试
  - 文件：`backend/tests/transformers/protocols/codex/sse.test.ts`
  - 调整依赖旧行为的测试用例
  - 添加 `output_item.added` 和 `function_call_arguments.delta` 事件

- [ ] 集成测试
  - 使用真实 Codex 上游测试
  - 验证 Claude 客户端 tool loop 触发
  - **待用户真实环境验证**

## 阶段 5：验证与文档

- [x] 运行完整测试套件
  ```bash
  npm test
  ```
  - 结果：207 个测试全部通过

- [x] 构建验证
  ```bash
  npm run build:backend
  ```
  - 结果：TypeScript 编译通过

- [ ] 真实环境验证
  - 启动开发服务器
  - 测试 tool use 完整流程
  - 确认客户端行为正常
  - **待用户验证**

## 检查清单

完成前确认：

- [x] 所有代码通过 TypeScript 编译
- [x] 所有单元测试通过
- [x] 与 Go 参考实现的事件序列完全一致
- [ ] 无 console 错误或警告
  - **需用户在真实环境验证**
- [ ] 真实环境 tool use 可用
  - **需用户验证**
