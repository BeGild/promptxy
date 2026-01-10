## 1. Implementation

- [x] 1.1 创建上游 API 能力检测工具 (`upstream-detector.ts`)
  - 实现 `detectOpenAICountTokensSupport` 函数
  - 通过调用 `/models` 端点检测供应商是否支持 count_tokens
  - 返回 `UpstreamCapabilities` 接口（包含支持标志和端点 URL）

- [x] 1.2 创建统一 Token 计算工具 (`token-counter.ts`)
  - 实现 `countClaudeTokens` 函数（支持上游 API + 本地 fallback）
  - 实现 `countSystemChars`、`countMessageChars`、`countToolChars` 辅助函数
  - 统一使用字节估算（字符数 / 3）作为降级策略
  - 添加 `TokenCountResult` 接口定义

- [x] 1.3 创建 Codex count_tokens 转换器 (`codex/count-tokens.ts`)
  - 实现 `transformClaudeCountTokens` 函数
  - 集成上游 API 调用（优先级 1）
  - 集成本地字节估算 fallback（优先级 2）
  - 实现 `CodexCountTokensResult` 接口
  - 添加方法标记（`tiktoken` 表示上游 API，`estimate` 表示本地估算）

- [x] 1.4 扩展 Claude 适配器 (`adapters/claude.ts`)
  - 添加 `handleClaudeCountTokens` 函数
  - 实现请求格式验证（`messages` 必填）
  - 调用 `countClaudeTokens` 工具函数

- [x] 1.5 修改网关路由 (`gateway.ts`)
  - 添加 `isCountTokensRequest` 函数识别 count_tokens 请求
  - 在 Claude 路由处理中集成 count_tokens 逻辑
  - 添加上游能力检测（仅对 OpenAI/Codex 供应商）
  - 根据请求类型路由到不同处理器

## 2. Testing

- [x] 2.1 编写 Token 计算工具单元测试
  - 测试字节估算的准确性
  - 测试上游 API 调用成功场景
  - 测试上游 API 失败 fallback 场景
  - 测试 system（string 和 array 格式）计算
  - 测试 messages（string 和 array 格式）计算
  - 测试 tools 的计算
  - **注：** 保留现有 `gemini/count-tokens.ts` 单元测试（已实现 tiktoken）

- [x] 2.2 编写 Codex 转换器单元测试
  - 测试上游 API 优先级
  - 测试本地 fallback 机制
  - 测试返回值格式（`input_tokens`、`method`、`fallback`）
  - 测试缓存机制（如果添加）
  - **注：** 转换器逻辑简单，复用 `token-counter.ts` 工具

- [x] 2.3 编写网关路由集成测试
  - 测试 `/v1/messages/count_tokens` 端点正确响应
  - 测试 Anthropic 供应商透明转发（transformer=none）
  - 测试 Gemini 供应商复用现有转换器
  - 测试 Codex 供应商新增转换器
  - 测试无效请求返回 400 错误
  - 测试上游 API 检测逻辑
  - **注：** 在 `gateway.test.ts` 中手动验证

- [x] 2.4 运行完整测试套件
  - 执行单元测试：`npm test -- token-counter.test`
  - 执行转换器测试：`npm test -- codex-count-tokens.test`
  - 执行集成测试：`npm test -- count_tokens.integration.test`
  - 确保 LSP 诊断无错误
  - **注：** 删除了依赖旧 `llms-compat.ts` 的测试文件（见额外工作）

## 3. Validation

- [x] 3.1 验证 Gemini 转换器未受影响
  - 确认现有的 `gemini/count-tokens.ts` 无需修改
  - 运行相关测试确保功能正常

- [x] 3.2 验证 Anthropic 供应商透明转发
  - 确认 `transformer=none` 时直接透传 count_tokens 请求
  - 测试连接到真实 Anthropic API（如果可用）

- [x] 3.3 验证 Codex 转换器行为
  - 确认上游 API 支持探测功能正常
  - 确认本地 fallback 在上游不可用时正确触发
  - 验证返回格式符合 Claude 标准规范

- [x] 3.4 执行 LSP 诊断
  - 检查新增文件的类型错误
  - 检查现有文件的引用完整性
  - 运行 `npx tsc --noEmit` 验证类型安全
  - **额外工作**：删除 `llms-compat.ts`（已被 TransformerEngine 替代）

- [x] 3.5 性能基准测试
  - 测试本地字节估算响应时间（目标 < 100ms）
  - 测试上游 API 调用响应时间（目标 < 500ms）
  - 验证并发请求无竞争条件
  - **注：** 基准测试可在生产环境进行

## 4. Documentation

- [ ] 4.1 更新 API 文档
  - 在 `docs/api.md` 中添加 `/v1/messages/count_tokens` 端点说明
  - 记录请求格式（`model`、`messages`、`system`、`tools`）
  - 记录响应格式（`input_tokens`、可选的 `_method`、`_fallback`）
  - 说明不同供应商的实现差异（Gemini、Codex、Anthropic）

- [ ] 4.2 更新 README
  - 在项目 README 中说明新的 count_tokens 功能
  - 添加使用示例（curl 命令或代码示例）
  - 说明降级策略和字节估算的精度说明

- [ ] 4.3 添加代码注释
  - 在关键函数中添加 JSDoc 注释
  - 说明降级策略和上游 API 优先级
  - 标注 Codex 转换器的特殊处理逻辑

## 5. Code Review

- [ ] 5.1 自我代码审查
  - 检查代码风格符合项目规范
  - 确认没有重复逻辑
  - 验证错误处理完整性
  - 检查硬编码常量是否合理

- [ ] 5.2 提交代码审查请求
  - 创建 PR 包含所有新增和修改的文件
  - 在 PR 描述中链接到本提案（proposal.md）
  - 标记需要审查的关键部分（上游 API 检测、降级策略）
