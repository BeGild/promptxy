## ADDED Requirements

### Requirement: 请求保存错误日志

当请求记录保存失败时，网关 SHALL 使用 error 级别日志记录错误信息，确保生产环境可感知。

#### Scenario: 保存失败输出 error 日志

- **GIVEN** 请求记录保存操作失败（磁盘满、权限错误等）
- **WHEN** `insertRequestRecord` 抛出异常
- **THEN** 网关使用 `logger.error` 记录错误
- **AND THEN** 错误信息包含失败原因（`err?.message`）
- **AND THEN** 错误信息输出到 stderr
- **AND THEN** 不影响请求处理流程（继续响应客户端）

#### Scenario: Error 日志级别不受 debug 配置影响

- **GIVEN** 系统配置 `debug: false`
- **WHEN** 请求保存失败
- **THEN** `logger.error` 仍输出错误日志
- **AND THEN** `logger.debug` 的内容不输出

---

### Requirement: 索引重建 API Handler

网关 SHALL 提供管理员 API handler 用于触发数据库索引重建。

#### Scenario: 处理索引重建请求

- **WHEN** 客户端发送 `POST /_promptxy/rebuild-index`
- **THEN** 网关调用 `db.rebuildIndexPublic()`
- **AND THEN** 根据返回结果设置 HTTP 状态码（成功 200，失败 500）
- **AND THEN** 返回 JSON 响应包含 `success`, `message`, `count` 字段

#### Scenario: 索引重建异常处理

- **WHEN** `rebuildIndexPublic()` 抛出未捕获异常
- **THEN** 网关返回 HTTP 500
- **AND THEN** 响应体包含 `{ "success": false, "message": "<错误信息>" }`

---

## MODIFIED Requirements

### Requirement: 请求头完整存储

网关 SHALL 在保存请求记录时保留完整的 headers 信息，不进行脱敏处理。

#### Scenario: Headers 不调用 sanitizeHeaders（MODIFIED）

- **WHEN** 网关构建 `RequestRecord` 对象
- **THEN** `requestHeaders` 字段直接使用原始 `Record<string, string>` 对象
- **AND THEN** `originalRequestHeaders` 字段直接使用原始对象
- **AND THEN** `responseHeaders` 字段直接使用原始对象
- **AND THEN** 不调用 `sanitizeHeaders()` 函数

---

### Requirement: SSE 响应结构化保存

网关 SHALL 在保存 SSE 流式响应时，将响应体解析为结构化事件数组。

#### Scenario: SSE 内容检测与解析（MODIFIED）

- **GIVEN** 响应 content-type 包含 `text/event-stream`
- **AND GIVEN** 流式响应处理完成，`responseBodyBuffer` 包含完整响应
- **WHEN** 网关构建 `RequestRecord` 对象
- **THEN** 网关调用 `isSSEContent()` 检测响应内容
- **AND THEN** 如果检测为 SSE，调用 `parseSSEToEvents()` 解析为 `ParsedSSEEvent[]`
- **AND THEN** 解析后的事件数组赋值给 `responseBody` 字段
- **AND THEN** 如果非 SSE 格式，保持原始字符串

#### Scenario: SSE 解析器导入

- **WHEN** 网关需要解析 SSE 内容
- **THEN** 动态导入 `./utils/sse-parser.js`
- **AND THEN** 使用解构获取 `parseSSEToEvents` 和 `isSSEContent` 函数

---

### Requirement: Logger Error 方法

Logger SHALL 提供 `error` 方法用于记录错误级别的日志。

#### Scenario: Error 方法始终输出（ADDED）

- **GIVEN** Logger 实例已创建
- **WHEN** 调用 `logger.error(message)`
- **THEN** 消息输出到 stderr（使用 `console.error`）
- **AND THEN** 消息前缀 `[ERROR]` 标识错误级别
- **AND THEN** 输出不受 `debug` 配置影响

#### Scenario: Logger 类型定义更新（MODIFIED）

- **WHEN** `PromptxyLogger` 类型被定义
- **THEN** 类型包含 `error: (message: string) => void` 方法
- **AND THEN** `createLogger` 函数返回包含 `error` 方法的对象

---

### Requirement: 请求详情 API Headers 返回格式

请求详情 API SHALL 返回 headers 为对象格式（而非 JSON 字符串）。

#### Scenario: 请求详情响应中 headers 为对象（MODIFIED）

- **WHEN** 客户端调用 `GET /_promptxy/requests/{id}`
- **THEN** 响应体中 `requestHeaders`, `originalRequestHeaders`, `responseHeaders` 为对象类型
- **AND THEN** 前端可直接使用，无需 `JSON.parse`
- **AND THEN** 兼容旧数据（如果数据库返回字符串，API 层自动解析）
