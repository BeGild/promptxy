# AI 友好记录查询系统设计

## 背景与问题

当前记录系统存在以下问题：

1. **全流程追踪缺失**：转换服务涉及多次协议转换，但缺少中间转换步骤的记录
2. **AI分析不友好**：单条记录包含完整请求/响应体，AI直接读取会导致上下文爆炸
3. **跨请求对比困难**：同一会话的多个请求分散存储，难以进行差异分析

核心问题：**AI通过 `Read` 工具读取文件时无法控制读取范围**，即使设计摘要字段，读取整个文件时还是会把所有内容读进去。

## 解决方案：渐进式披露脚本系统

设计一个 CLI 脚本 `records-query` 作为 AI 和记录数据之间的接口层。AI 永不直接读取记录文件，只通过脚本获取数据。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      AI 分析者                              │
│  (通过 Bash 工具调用脚本，不直接读取记录文件)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              records-query CLI (TypeScript)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  命令层次：                                           │  │
│  │  · list      - 列出会话/请求（元数据）                │  │
│  │  · structure - 获取结构（不含内容）                    │  │
│  │  · get       - 获取指定字段内容                       │  │
│  │  · diff      - 对比两个请求                           │  │
│  │  · trace     - 获取转换链追踪                         │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    记录存储层                               │
│  ~/.local/promptxy/requests/*.yaml                          │
└─────────────────────────────────────────────────────────────┘
```

## 命令设计

### 第一层：发现层 (Discovery)

#### `records list sessions`

列出所有会话及其概要信息。

```bash
records list sessions [--limit N] [--filter "expression"]
```

**参数**：
- `--limit N`: 限制返回数量（默认 20）
- `--filter`: 过滤条件，如 `client=claude`, `hasError=true`, `supplierId=xxx`

**输出**（JSON 格式）：
```json
{
  "total": 156,
  "sessions": [
    {
      "conversationId": "msg_abc123...",
      "requestCount": 5,
      "timeRange": { "start": 1737312568000, "end": 1737313120000 },
      "client": "claude",
      "supplier": "openai",
      "hasError": false,
      "models": ["claude-3-5-sonnet", "gpt-4o"]
    }
  ]
}
```

**关键设计**：只返回会话级别的元数据，不包含任何 body 内容，AI 可以快速筛选感兴趣的会话。

---

#### `records list requests`

列出指定会话的所有请求。

```bash
records list requests --conversation <id> [--limit N]
```

**输出**：
```json
{
  "conversationId": "msg_abc123...",
  "requestCount": 5,
  "requests": [
    {
      "id": "2026-01-29_10-30-15-234_xxx",
      "index": 0,
      "timestamp": 1737312568000,
      "path": "/v1/messages",
      "method": "POST",
      "client": "claude",
      "supplier": "openai",
      "model": "claude-3-5-sonnet",
      "hasTransformError": false,
      "responseStatus": 200,
      "durationMs": 2340
    }
  ]
}
```

---

### 第二层：结构层 (Structure)

#### `records structure`

获取请求的结构化信息。

```bash
records structure <request-id> [--part request|response|transform]
```

**参数**：
- `<request-id>`: 请求 ID
- `--part`: 指定分析哪个部分（默认 request）

**输出**：
```json
{
  "requestId": "2026-01-29_10-30-15-234_xxx",
  "structure": {
    "originalBody": {
      "type": "object",
      "fields": {
        "model": { "type": "string", "value": "claude-3-5-sonnet" },
        "max_tokens": { "type": "number", "value": 4096 },
        "messages": {
          "type": "array",
          "length": 3,
          "itemStructure": {
            "role": { "type": "string" },
            "content": { "type": "array", "itemStructure": "/* complex */" }
          }
        },
        "tools": { "type": "array", "length": 2, "hasItems": true },
        "stream": { "type": "boolean", "value": true }
      }
    },
    "transformedBody": {
      "type": "object",
      "fields": {
        "model": { "type": "string", "value": "gpt-4o" },
        "messages": {
          "type": "array",
          "length": 3,
          "note": "structure same as originalBody.messages"
        },
        "tools": { "type": "array", "length": 2, "note": "added by transformer" }
      }
    }
  }
}
```

**关键设计**：
- 数组字段只返回 `length`，不返回数组内容
- 对象字段返回其结构的递归描述
- 字符串/数字等基本类型返回实际值（因为很小）
- AI 可以了解结构而不被大量内容撑爆

---

### 第三层：对比层 (Diff)

#### `records diff`

对比两个请求的差异。

```bash
records diff <request-id-1> <request-id-2> [--mode structure|field|content]
```

**参数**：
- `--mode structure`: 对比结构差异（字段增删、类型变化）
- `--mode field`: 对比字段值差异（返回差异字段的完整值）
- `--mode content`: 对比指定字段的内容差异（需要配合 `--field`）

**输出 (--mode structure)**：
```json
{
  "request1": "2026-01-29_10-30-15-234_xxx",
  "request2": "2026-01-29_10-31-20-111_yyy",
  "structuralDifferences": {
    "originalBody": {
      "addedFields": [],
      "removedFields": ["temperature"],
      "typeChanges": {},
      "arrayLengthChanges": {
        "messages": { "from": 3, "to": 4 },
        "tools": { "from": 2, "to": 0 }
      }
    },
    "transformedBody": {
      "addedFields": ["frequency_penalty"],
      "removedFields": [],
      "typeChanges": {
        "stream": { "from": "boolean", "to": "number" }
      }
    }
  }
}
```

**输出 (--mode field --field model)**：
```json
{
  "field": "originalBody.model",
  "request1": { "value": "claude-3-5-sonnet" },
  "request2": { "value": "gpt-4o" },
  "difference": "value changed"
}
```

---

### 第四层：选择性内容层 (Get)

#### `records get`

按路径获取指定字段的内容。

```bash
records get <request-id> --path <json-path> [options]
```

**参数**：
- `--path`: JSON 路径，如 `originalBody.messages[0]`, `transformedBody.model`
- `--truncate N`: 字符串截断长度（默认 500）
- `--array-limit N`: 数组最大返回数量（默认 10）
- `--format json|summary`: 返回格式

**示例**：
```bash
# 获取 model 字段
records get 2026-01-29_10-30-15-234_xxx --path originalBody.model
# 输出: { "value": "claude-3-5-sonnet" }

# 获取 messages 数组的前 2 条
records get 2026-01-29_10-30-15-234_xxx --path originalBody.messages --array-limit 2
# 输出: { "items": [/* 2条消息 */], "totalCount": 5, "truncated": true }

# 获取第一个 message 的 role
records get 2026-01-29_10-30-15-234_xxx --path originalBody.messages[0].role
# 输出: { "value": "user" }

# 获取工具列表摘要（不返回具体工具定义）
records get 2026-01-29_10-30-15-234_xxx --path transformedBody.tools --format summary
# 输出: { "count": 2, "names": ["computer", "text_editor"] }
```

---

### 第五层：转换分析层 (Trace)

#### `records trace`

获取转换链的追踪信息。

```bash
records trace <request-id>
```

**输出**：
```json
{
  "requestId": "2026-01-29_10-30-15-234_xxx",
  "transformChain": [
    {
      "step": "claude-to-openai",
      "fromProtocol": "anthropic",
      "toProtocol": "openai-codex",
      "changes": {
        "addedFields": ["tools", "frequency_penalty"],
        "removedFields": [],
        "renamedFields": { "system": "/* injected into messages */" },
        "typeChanges": {}
      }
    }
  ]
}
```

**设计原则**：只提供客观的变化列表，不输出主观的"问题判断"。

---

## 渐进式披露流程示例

AI 分析一个转换问题的典型流程：

```bash
# 1. 发现：列出有错误的会话
records list sessions --filter "hasError=true"
# 返回: 3 个会话

# 2. 发现：查看会话中的请求
records list requests --conversation msg_abc123...
# 返回: 5 个请求，第3个有错误

# 3. 结构：了解请求结构，不读内容
records structure 2026-01-29_10-31-20-111_yyy
# 返回: 结构 schema，AI 发现 tools 字段存在

# 4. 对比：对比正常请求和错误请求的结构差异
records diff 2026-01-29_10-30-15-234_xxx 2026-01-29_10-31-20-111_yyy --mode structure
# 返回: tools 字段从 2 个变成 0 个

# 5. 精确获取：只获取 tools 字段的内容
records get 2026-01-29_10-30-15-234_xxx --path transformedBody.tools
# 返回: 具体的 tools 定义

# 6. 转换追踪：查看转换步骤
records trace 2026-01-29_10-31-20-111_yyy
# 返回: 转换器在 tools 转换时的变化

# 至此 AI 用最小上下文定位了问题
```

## 核心设计原则

1. **分层递进**：从元数据 → 结构 → 差异 → 内容，逐步深入
2. **最小返回**：每个命令返回当前层最小必要信息
3. **客观事实**：脚本只输出客观数据，AI 自行判断问题
4. **可组合**：命令输出包含引用 ID，方便后续 fetch
5. **绝不直接读文件**：AI 只通过脚本接口访问

## 命令汇总

| 命令 | 层级 | 用途 |
|------|------|------|
| `list sessions` | 发现 | 会话级元数据筛选 |
| `list requests` | 发现 | 请求级元数据 |
| `structure` | 结构 | 无内容的 schema |
| `diff` | 对比 | 请求间差异 |
| `get` | 内容 | 精确获取指定字段 |
| `trace` | 转换 | 转换链变化追踪 |
