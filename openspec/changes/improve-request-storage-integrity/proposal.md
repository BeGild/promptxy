# Change: 请求存储完整性改进

## Why

当前 PromptXY 的请求/响应保存机制存在以下可靠性和可追溯性问题：

1. **索引丢失无恢复机制**：进程崩溃时内存索引可能丢失，虽然有 `rebuildIndex()` 方法，但仅在索引文件损坏时自动触发，用户无法手动触发重建
2. **保存失败静默忽略**：所有 `insertRequestRecord` 失败仅记录 `logger.debug`，生产环境关闭 debug 时完全无感知
3. **Headers 脱敏导致无法复现**：`sanitizeHeaders` 将敏感字段替换为 `***REDACTED***`，导致审计时无法还原真实认证信息
4. **Headers 存储格式不友好**：使用 `JSON.stringify` 存储为单行字符串，YAML 中可读性差
5. **SSE 响应体解析困难**：SSE 流式响应保存为原始字符串，外部工具难以解析事件结构

## What Changes

### 可靠性改进

- **索引重建 API**：新增 `POST /_promptxy/rebuild-index` 手动触发索引重建
- **错误日志升级**：保存失败从 `logger.debug` 改为 `logger.error`，确保生产环境可感知

### 数据完整性改进

- **移除 Headers 脱敏**：删除所有 `sanitizeHeaders()` 调用，保留完整认证信息
- **Headers 存储为 YAML 对象**：从 `Record<string, string>` 对象直接序列化，而非 JSON 字符串

### 可解析性改进

- **SSE 事件解析**：新建 `sse-parser.ts` 工具，将 SSE 文本解析为结构化事件数组
- **SSE 响应体结构化存储**：SSE 响应保存为 `ParsedSSEEvent[]` 数组，每个事件包含 `id`, `event`, `data`, `retry` 字段

### 向后兼容

- 读取时检测 headers 字段类型（字符串或对象），自动兼容旧数据
- 新写入数据使用新格式，旧数据保持原样

## Non-Goals

- 不在 UI 层添加索引重建按钮（仅提供 API）
- 不改变现有 YAML 文件名或目录结构
- 不影响 cURL 预览功能（transform preview 中仍使用脱敏）

## Impact

- Affected specs:
  - `request-viewer`（Headers 存储格式、SSE 解析、索引重建 API）
  - `promptxy-gateway`（移除脱敏、error 日志、SSE 解析集成）
- Affected code:
  - 后端：`logger.ts`, `types.ts`, `database.ts`, `gateway.ts`, `api-handlers.ts`, `utils/sse-parser.ts`（新建）
  - 前端：`types/api.ts`（可能需要更新类型定义）

## Rollout / Compatibility

- 现有 YAML 文件可正常读取（兼容旧 JSON 字符串格式）
- 新写入文件使用新格式（YAML 对象）
- API 接口保持兼容（`RequestRecordResponse` 中 headers 字段类型实际已是对象）
