## ADDED Requirements

### Requirement: 索引手动重建

系统 SHALL 提供管理员 API 用于手动触发索引重建，从 requests/ 目录扫描所有 YAML 文件并重建内存索引。

#### Scenario: 手动触发索引重建

- **WHEN** 管理员调用 `POST /_promptxy/rebuild-index`
- **THEN** 系统扫描 `~/.local/promptxy/requests/` 目录下所有 `.yaml` 文件
- **AND THEN** 系统从每个文件提取索引字段（id, timestamp, client, path, method, requestSize, responseSize, responseStatus, durationMs, error, matchedRulesBrief）
- **AND THEN** 系统重建内存索引并按时间戳倒序排列
- **AND THEN** 系统持久化索引到 `indexes/timestamp.idx`
- **AND THEN** 返回成功响应包含重建的记录数量

#### Scenario: 索引重建成功响应

- **GIVEN** requests/ 目录包含 1234 个 YAML 文件
- **WHEN** 管理员调用 `POST /_promptxy/rebuild-index`
- **THEN** 系统返回 HTTP 200
- **AND THEN** 响应体为 `{ "success": true, "message": "索引重建成功", "count": 1234 }`

#### Scenario: 索引重建失败响应

- **GIVEN** requests/ 目录不存在或无读取权限
- **WHEN** 管理员调用 `POST /_promptxy/rebuild-index`
- **THEN** 系统返回 HTTP 500
- **AND THEN** 响应体包含 `{ "success": false, "message": "索引重建失败: <错误详情>" }`

---

### Requirement: Headers 完整存储

系统 SHALL 完整存储请求/响应 headers，不进行脱敏处理，以便审计时能够还原真实认证信息。

#### Scenario: Headers 存储为 YAML 对象

- **WHEN** 一个请求被持久化到 YAML 文件
- **THEN** `requestHeaders`, `originalRequestHeaders`, `responseHeaders` 字段存储为 YAML 对象（而非 JSON 字符串）
- **AND THEN** 每个 header 键值对独立一行
- **EXAMPLE**:
  ```yaml
  requestHeaders:
    authorization: Bearer sk-ant-test123
    content-type: application/json
  ```

#### Scenario: Headers 保留敏感信息

- **GIVEN** 请求包含 `authorization: Bearer sk-ant-apikey123`
- **WHEN** 请求被保存到 YAML 文件
- **THEN** `authorization` 的完整值被保留
- **AND THEN** 不替换为 `***REDACTED***`

#### Scenario: 兼容旧格式 headers

- **GIVEN** 旧 YAML 文件中 `requestHeaders` 为 JSON 字符串格式
- **WHEN** 系统读取该请求文件
- **THEN** 系统自动检测字段类型
- **AND THEN** 如果是字符串，尝试 `JSON.parse` 解析为对象
- **AND THEN** 如果解析失败，返回 undefined

---

### Requirement: SSE 事件结构化存储

系统 SHALL 将 SSE (Server-Sent Events) 响应解析为结构化事件数组，便于外部工具解析和审计。

#### Scenario: SSE 响应解析为事件数组

- **GIVEN** 响应 content-type 为 `text/event-stream`
- **AND GIVEN** 响应体包含 SSE 格式数据
- **WHEN** 响应被保存到 YAML 文件
- **THEN** `responseBody` 字段存储为事件数组（而非原始字符串）
- **AND THEN** 每个事件包含 `id`, `event`, `data`, `retry` 字段（如果存在）
- **EXAMPLE**:
  ```yaml
  responseBody:
    - event: message
      data: '{"type":"message_start"}'
    - event: content_block_delta
      data: '{"delta":{"text":"Hello"}}'
  ```

#### Scenario: SSE 事件字段解析

- **GIVEN** SSE 响应包含以下内容：
  ```
  id: msg-123
  event: message
  data: {"type":"start"}
  retry: 5000
  ```
- **WHEN** 该 SSE 被解析
- **THEN** 生成的 `ParsedSSEEvent` 对象包含：
  - `id: "msg-123"`
  - `event: "message"`
  - `data: '{"type":"start"}'`
  - `retry: 5000`

#### Scenario: SSE 多行 data 字段合并

- **GIVEN** SSE 响应包含：
  ```
  data: {"type":"start",
  data: "message":"hello"}
  ```
- **WHEN** 该 SSE 被解析
- **THEN** `data` 字段值为两行拼接：`{"type":"start",\n"message":"hello"}`

#### Scenario: 非 SSE 响应保持原样

- **GIVEN** 响应 content-type 为 `application/json`
- **WHEN** 响应被保存
- **THEN** `responseBody` 存储为原始字符串（不进行事件解析）

---

## MODIFIED Requirements

### Requirement: 请求记录文件系统持久化

系统 SHALL 使用文件系统存储请求记录，每个请求存储为独立的 YAML 格式文件。存储时 headers 字段 SHALL 使用 YAML 对象格式（而非 JSON 字符串），SSE 响应的 responseBody SHALL 解析为结构化事件数组。

#### Scenario: 请求文件格式（MODIFIED）

- **WHEN** 一个请求被持久化到文件系统
- **THEN** 文件存储在 `~/.local/promptxy/requests/` 目录下
- **AND THEN** 文件名为 `{id}.yaml`，其中 ID 格式为 `YYYY-MM-DD_HH-mm-ss-SSS_random`
- **AND THEN** 文件内容为 YAML 格式
- **AND THEN** headers 字段（`requestHeaders`, `originalRequestHeaders`, `responseHeaders`）存储为 YAML 对象
- **AND THEN** SSE 响应的 `responseBody` 存储为事件数组
- **AND THEN** 其他大字段使用 YAML 多行字符串语法（`|`）避免转义
