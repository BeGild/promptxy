---
name: records-query
description: |
  渐进式披露的记录查询系统，用于分析 PromptXY 转换服务的请求记录。

  当需要分析请求记录、诊断转换问题、对比请求差异时使用此 skill。
  支持通过分层命令按需获取数据，避免直接读取大文件导致上下文爆炸。

  使用场景：
  1. 诊断转换器问题 - 分析请求/响应转换是否正确
  2. 对比请求差异 - 找出同一会话中不同请求的变化
  3. 查询特定字段 - 精确获取 model、messages、tools 等字段
  4. 追踪转换链 - 查看 Claude→OpenAI 等协议转换步骤
  5. 筛选问题请求 - 按 client、supplier、hasError 等条件过滤
---

# Records Query Skill

## 核心原则

**渐进式披露**：从概要到细节，按需获取，避免一次性加载大量数据。

## 快速开始

```bash
# 列出最近的会话
./scripts/records.sh list sessions --limit 5

# 查看特定会话的请求列表
./scripts/records.sh list requests --conversation <conversation-id>

# 获取请求结构（不含内容）
./scripts/records.sh structure <request-id>

# 获取特定字段
./scripts/records.sh get <request-id> --path "originalBody.model"
```

## 命令参考

### list sessions - 列出会话

列出所有会话概要，支持过滤。

```bash
./scripts/records.sh list sessions [--limit N] [--filter "conditions"]
```

**过滤条件**（逗号分隔）：
- `client=claude|codex|gemini` - 按客户端过滤
- `supplier=openai|anthropic` - 按供应商过滤
- `hasError=true|false` - 按错误状态过滤
- `supplierId=<id>` - 按供应商ID过滤

**示例**：
```bash
# 列出最近10个有错误的 Claude 会话
./scripts/records.sh list sessions --limit 10 --filter "client=claude,hasError=true"
```

### list requests - 列出请求

列出指定会话的所有请求。

```bash
./scripts/records.sh list requests --conversation <id> [--limit N]
```

### structure - 获取结构

获取请求的结构 schema，**不包含实际内容**。

```bash
./scripts/records.sh structure <request-id> [--part request|response|transform]
```

**part 选项**：
- `request` - 请求体结构（originalBody, transformedBody, modifiedBody）
- `response` - 响应体结构
- `transform` - 同 request（用于转换分析）

### diff - 对比请求

对比两个请求的差异。

```bash
./scripts/records.sh diff <id1> <id2> [--mode structure|field] [--field <path>]
```

**mode 选项**：
- `structure` - 对比结构差异（字段增删、类型变化、数组长度）
- `field` - 对比指定字段的值（需配合 --field）

**示例**：
```bash
# 对比两个请求的结构差异
./scripts/records.sh diff req-001 req-002 --mode structure

# 对比特定字段
./scripts/records.sh diff req-001 req-002 --mode field --field "originalBody.model"
```

### get - 获取字段内容

精确获取指定路径的字段内容，支持截断控制。

```bash
./scripts/records.sh get <request-id> --path <json-path> [options]
```

**选项**：
- `--path <path>` - JSON 路径，如 `originalBody.messages[0].content`
- `--truncate N` - 字符串截断长度（默认 500）
- `--array-limit N` - 数组最大返回数量（默认 10）
- `--format json|summary` - 返回格式

**常用路径示例**：
- `originalBody.model` - 原始请求模型
- `originalBody.messages` - 消息列表
- `originalBody.tools` - 工具定义
- `transformedBody.model` - 转换后的模型
- `responseBody.choices[0].message.content` - 响应内容

### trace - 转换追踪

获取请求的转换链信息。

```bash
./scripts/records.sh trace <request-id>
```

## 典型分析流程

### 场景 1：诊断转换问题

```bash
# 1. 找出有错误的会话
./scripts/records.sh list sessions --filter "hasError=true" --limit 5

# 2. 查看该会话的请求
./scripts/records.sh list requests --conversation <conv-id>

# 3. 获取问题请求的结构
./scripts/records.sh structure <request-id>

# 4. 查看转换后的 model 字段
./scripts/records.sh get <request-id> --path "transformedBody.model"

# 5. 对比原始和转换后的 tools
./scripts/records.sh get <request-id> --path "originalBody.tools" --format summary
./scripts/records.sh get <request-id> --path "transformedBody.tools" --format summary

# 6. 查看转换链
./scripts/records.sh trace <request-id>
```

### 场景 2：对比同一会话的多个请求

```bash
# 1. 获取会话中的两个请求 ID
./scripts/records.sh list requests --conversation <conv-id>

# 2. 对比结构差异
./scripts/records.sh diff <req-1> <req-2> --mode structure

# 3. 如果发现 messages 长度变化，查看详情
./scripts/records.sh get <req-1> --path "originalBody.messages" --array-limit 3
./scripts/records.sh get <req-2> --path "originalBody.messages" --array-limit 3
```

### 场景 3：验证模型映射

```bash
# 1. 列出 Claude 客户端的会话
./scripts/records.sh list sessions --filter "client=claude" --limit 5

# 2. 获取请求，查看原始模型和转换后模型
./scripts/records.sh get <request-id> --path "originalBody.model"
./scripts/records.sh get <request-id> --path "transformedBody.model"

# 3. 查看供应商信息
./scripts/records.sh list requests --conversation <conv-id>
# 查看返回的 supplier 字段
```

## 路径语法

JSON 路径支持点号和数组索引：

- `originalBody.model` - 对象字段
- `originalBody.messages[0]` - 数组第一个元素
- `originalBody.messages[0].content` - 嵌套路径
- `responseBody.choices[0].message.content` - 深层嵌套

## 输出格式

### summary 格式

用于快速了解数组/对象概况：

```bash
./scripts/records.sh get <id> --path "originalBody.tools" --format summary
# 输出: { "count": 3, "names": ["computer", "text_editor", "browser"] }
```

### json 格式（默认）

完整 JSON 输出，支持截断：

```bash
./scripts/records.sh get <id> --path "originalBody.messages" --array-limit 2
# 输出: { "items": [...], "totalCount": 10, "truncated": true }
```

## 注意事项

1. **不要直接读取记录文件** - 始终使用 `./scripts/records.sh` 命令
2. **从概要开始** - 先用 `list` 和 `structure` 了解概况
3. **按需深入** - 确定需要的内容后再用 `get` 获取
4. **善用过滤** - 使用 `--filter` 减少返回数据量
5. **控制截断** - 大字段使用 `--truncate` 和 `--array-limit`
