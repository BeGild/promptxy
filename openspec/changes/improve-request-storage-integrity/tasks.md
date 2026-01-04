# Tasks: 请求存储完整性改进

## 0. 基线确认

- [ ] 0.1 验证现有 `rebuildIndex()` 方法可用性
- [ ] 0.2 确认当前 `sanitizeHeaders` 调用位置（3处：gateway.ts）
- [ ] 0.3 回归测试：确认当前 YAML 格式（JSON 字符串 headers）

## 1. 后端：Logger 扩展

- [ ] 1.1 扩展 `PromptxyLogger` 类型：新增 `error` 方法
- [ ] 1.2 实现 `logger.error`：始终输出到 stderr

## 2. 后端：SSE 解析器

- [ ] 2.1 新建 `utils/sse-parser.ts`：
  - `parseSSEToEvents()`: 解析 SSE 文本为事件数组
  - `isSSEContent()`: 检测内容是否为 SSE 格式
- [ ] 2.2 新增 `ParsedSSEEvent` 类型到 `types.ts`

## 3. 后端：类型定义更新

- [ ] 3.1 修改 `RequestRecord` 接口：
  - `requestHeaders`/`originalRequestHeaders`/`responseHeaders` 改为 `Record<string, string> | undefined`
  - `responseBody` 改为 `string | ParsedSSEEvent[] | undefined`

## 4. 后端：Database 层

- [ ] 4.1 修改 `RequestFile` 接口（database.ts 内部）：headers 改为对象类型
- [ ] 4.2 修改 `writeRequestFile()`：headers 直接使用对象，YAML 自动格式化
- [ ] 4.3 修改 `loadRequestFile()`：添加 headers 兼容性解析（字符串自动 JSON.parse）
- [ ] 4.4 暴露 `rebuildIndexPublic()` 方法：返回 `{ success, message, count }`

## 5. 后端：Gateway 层

- [ ] 5.1 移除 `sanitizeHeaders` import
- [ ] 5.2 修改非流式响应保存（约850行）：
  - headers 直接使用对象
  - `logger.debug` → `logger.error`
- [ ] 5.3 修改流式响应保存（约941行）：
  - headers 直接使用对象
  - SSE 内容检测并解析为 `ParsedSSEEvent[]`
  - `logger.debug` → `logger.error`
- [ ] 5.4 修改错误保存（约1028行）：
  - headers 直接使用对象
  - `logger.debug` → `logger.error`

## 6. 后端：API Handlers

- [ ] 6.1 新增 `RebuildIndexResponse` 类型
- [ ] 6.2 新增 `handleRebuildIndex()` handler
- [ ] 6.3 在 gateway.ts 中注册 `POST /_promptxy/rebuild-index` 路由
- [ ] 6.4 修改 `handleGetRequest()`：headers 字段已是对象，无需 JSON.parse

## 7. 测试与验证

- [ ] 7.1 单测：SSE 解析器（标准格式、多行 data、retry 字段）
- [ ] 7.2 单测：headers 兼容性（JSON 字符串 → 对象）
- [ ] 7.3 端到端验证：
  - 发起请求，检查新 YAML 格式（headers 为对象、SSE 为数组）
  - 调用重建 API，验证索引重建成功
  - 模拟保存失败，确认 error 日志输出

## 8. 文档

- [ ] 8.1 更新 README：说明索引重建 API、YAML 格式变更
- [ ] 8.2 更新排障指南：索引损坏时如何调用重建 API
