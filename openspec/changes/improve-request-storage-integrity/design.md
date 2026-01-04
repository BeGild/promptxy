# Design: 请求存储完整性改进

## 概述

本文档说明请求存储完整性改进的技术设计决策，包括索引恢复、错误日志、headers 脱敏移除、YAML 格式优化和 SSE 解析。

---

## 1. 索引恢复机制

### 现状

- `database.ts` 已有 `rebuildIndex()` 私有方法
- 仅在 `loadIndex()` 失败时自动触发
- 用户无法手动触发

### 设计决策

**方案 A：启动时自动校验 + 手动 API**
- 启动时对比索引数量与实际文件数，不一致自动重建
- 提供 `POST /_promptxy/rebuild-index` 手动触发

**方案 B：仅手动 API**（选用）
- 不在启动时自动校验（避免启动延迟）
- 仅提供手动 API，让用户按需触发

### 理由

- 索引损坏是低频事件，启动时自动校验增加开销
- 手动 API 足够应对恢复场景
- 保持启动速度快（< 1 秒）

### API 设计

```
POST /_promptxy/rebuild-index

Response:
{
  "success": true,
  "message": "索引重建成功",
  "count": 1234
}
```

---

## 2. Headers 脱敏移除

### 现状

- `sanitizeHeaders()` 将敏感字段（`authorization`, `x-api-key`, `cookie` 等）替换为 `***REDACTED***`
- 问题：审计时无法还原真实认证信息，排查 401 问题困难

### 设计决策

**完全移除 `sanitizeHeaders` 调用**

### 理由

1. **可复现性优先**：存储目的是问题排查，需要完整信息
2. **本地存储**：YAML 文件存储在 `~/.local/promptxy/`，用户本地环境
3. **cURL 预览保留脱敏**：`transformers/llms-compat.ts` 中的 `generateCurlCommand()` 仍保留脱敏，用于 UI 展示

### 安全考虑

- YAML 文件权限由用户文件系统控制
- 如需分享日志，用户可手动编辑

---

## 3. Headers 存储格式

### 现状

```yaml
requestHeaders: '{"authorization":"Bearer sk-***","content-type":"application/json"}'
```

### 新格式

```yaml
requestHeaders:
  authorization: Bearer sk-ant-test123
  content-type: application/json
```

### 设计决策

**从 JSON 字符串改为 YAML 对象**

### 实现细节

- **写入**：`requestHeaders` 字段类型改为 `Record<string, string>`，YAML 序列化器自动格式化
- **读取**：添加兼容逻辑，检测字段类型：
  ```typescript
  const parseHeaders = (headers: any): Record<string, string> | undefined => {
    if (!headers) return undefined;
    if (typeof headers === 'string') {
      try { return JSON.parse(headers); }
      catch { return undefined; }
    }
    return headers;
  };
  ```

### 类型变更

```typescript
// Before
export interface RequestRecord {
  requestHeaders?: string;  // JSON 字符串
  responseHeaders?: string;
}

// After
export interface RequestRecord {
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}
```

---

## 4. SSE 解析器

### 现状

SSE 响应保存为原始字符串：

```yaml
responseBody: |
  event: message
  data: {"type":"message_start"}

  event: content_block_delta
  data: {"delta":{"text":"Hello"}}
```

### 新格式

SSE 解析为事件数组：

```yaml
responseBody:
  - event: message
    data: '{"type":"message_start"}'
  - event: content_block_delta
    data: '{"delta":{"text":"Hello"}}'
```

### 设计决策

**新增 SSE 解析工具，结构化存储**

### SSE 事件结构

```typescript
export interface ParsedSSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}
```

### 解析逻辑

1. 按行分割 SSE 文本
2. 解析 `id:`, `event:`, `data:`, `retry:` 字段
3. 空行分隔事件
4. 多行 `data:` 字段用 `\n` 拼接

### 集成位置

在 `gateway.ts` 流式响应处理中：

```typescript
const { parseSSEToEvents, isSSEContent } = await import('./utils/sse-parser.js');

if (isSSEContent(rawResponse)) {
  responseBodyStr = parseSSEToEvents(rawResponse);
} else {
  responseBodyStr = rawResponse;
}
```

### 类型变更

```typescript
// Before
export interface RequestRecord {
  responseBody?: string;
}

// After
export interface RequestRecord {
  responseBody?: string | ParsedSSEEvent[];
}
```

---

## 5. 错误日志升级

### 现状

```typescript
try {
  await insertRequestRecord(record);
} catch (err: any) {
  logger.debug(`[promptxy] Failed to save request record: ${err?.message}`);
}
```

### 新实现

```typescript
try {
  await insertRequestRecord(record);
} catch (err: any) {
  logger.error(`[promptxy] Failed to save request record: ${err?.message}`);
}
```

### Logger 扩展

```typescript
export type PromptxyLogger = {
  info: (message: string) => void;
  debug: (message: string) => void;
  error: (message: string) => void;  // 新增
  debugEnabled: boolean;
};
```

### 实现细节

- `logger.error`: 始终输出到 `stderr`，不受 `debug` 配置影响
- 使用 `console.error('[ERROR]', message)` 区分级别

---

## 6. 向后兼容性

### YAML 文件兼容

- **读取**：`loadRequestFile()` 自动检测 headers 字段类型
- **写入**：新数据使用对象格式

### API 兼容

- `RequestRecordResponse` 中 headers 字段实际已是对象类型
- 前端无需修改

### 数据迁移

- 不提供自动迁移工具
- 旧数据保持原格式，新写入使用新格式
- 用户可按需手动清理旧数据

---

## 7. 文件结构

### 新增文件

```
backend/src/promptxy/utils/
  └── sse-parser.ts     # SSE 解析工具
```

### 修改文件

```
backend/src/promptxy/
  ├── logger.ts          # 新增 error 方法
  ├── types.ts           # 新增 ParsedSSEEvent，修改 RequestRecord
  ├── database.ts        # 修改 RequestFile，添加兼容逻辑，暴露 rebuildIndexPublic
  ├── gateway.ts         # 移除 sanitizeHeaders，改用 error，集成 SSE 解析
  └── api-handlers.ts    # 新增 handleRebuildIndex
```

---

## 8. 测试策略

### 单元测试

- SSE 解析器：标准格式、多行 data、retry 字段、边界情况
- Headers 兼容性：JSON 字符串、对象、null、undefined

### 集成测试

- 完整请求流程：发起请求 → 保存 YAML → 读取验证格式
- 索引重建：删除索引文件 → 调用 API → 验证重建成功
- 错误日志：模拟保存失败 → 检查 stderr 输出

### 手动验证

- 检查新 YAML 文件格式（headers 为对象、SSE 为数组）
- 调用 `POST /_promptxy/rebuild-index`
- 查看旧数据仍可正常读取

---

## 9. 风险与缓解

### 风险 1：敏感信息泄露

- **风险**：YAML 文件包含完整 API keys
- **缓解**：
  - 文件存储在用户本地 `~/.local/`
  - 文档提醒用户注意文件权限
  - cURL 预览仍使用脱敏

### 风险 2：SSE 解析失败

- **风险**：非标准 SSE 格式解析错误
- **缓解**：
  - `parseSSEToEvents` 容错处理（忽略未知字段）
  - 解析失败时保存原始字符串（降级）

### 风险 3：旧数据兼容

- **风险**：某些旧数据格式无法解析
- **缓解**：
  - JSON.parse 失败时返回 undefined
  - 记录错误日志，不影响其他字段
