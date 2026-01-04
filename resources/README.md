# JSON Schema 提取工具

## 📋 功能说明

从 YAML 请求日志中提取 JSON 数据并生成 Schema，支持：
- ✅ 自动裁剪长字符串（>64字符用 `....` 替换）
- ✅ 处理 SSE (Server-Sent Events) 块标量格式
- ✅ 生成 JSON 数据文件（`.json`）
- ✅ 生成 JSON Schema 文件（`.schema.json`）
- ✅ 减少文件大小，便于后续处理

## 📁 文件结构

```
resources/
├── extract_schemas.py          # 主脚本
├── verify_schemas.py           # 验证脚本
├── README.md                   # 本文件
│
├── 2026-01-04_21-42-07-414_1ompl7/
│   ├── originalRequestHeaders.json          (772B)  ← 裁剪后数据
│   ├── originalRequestHeaders.schema.json   (1.9K)  ← Schema
│   ├── originalBody.json                    (22K)   ← 裁剪后数据
│   ├── originalBody.schema.json             (91K)   ← Schema
│   ├── responseBody.json                    (12K)   ← SSE 数据
│   ├── responseBody.schema.json             (854B)  ← SSE Schema
│   ├── responseHeaders.json                 (146B)  ← 裁剪后数据
│   └── responseHeaders.schema.json          (542B)  ← Schema
│
└── 2026-01-04_21-46-07-226_mvcluq/
    ├── originalRequestHeaders.json          (373B)
    ├── originalRequestHeaders.schema.json   (835B)
    ├── originalBody.json                    (22K)
    ├── originalBody.schema.json             (91K)
    ├── responseBody.json                    (178K)  ← SSE 数据
    ├── responseBody.schema.json             (854B)
    ├── responseHeaders.json                 (737B)
    └── responseHeaders.schema.json          (1.3K)
```

## 🚀 使用方法

### 1. 运行脚本

```bash
cd /home/ekko.bao/work/promptxy/resources/
python3 extract_schemas.py
```

### 2. 查看结果

```bash
# 查看文件夹
ls -lh 2026-01-04_21-42-07-414_1ompl7/

# 查看裁剪后的数据
cat 2026-01-04_21-42-07-414_1ompl7/originalBody.json | python3 -m json.tool

# 查看 Schema
cat 2026-01-04_21-42-07-414_1ompl7/originalBody.schema.json | python3 -m json.tool
```

## 🔧 核心功能

### 1. 字符串裁剪

**规则**：叶子节点的字符串如果超过 64 个字符，保留前 64 个字符 + `....`

**示例**：
```python
# 原始
"This is a very long string that exceeds sixty-four characters and needs to be truncated"

# 裁剪后
"This is a very long string that exceeds sixty-four characters an...."
```

**效果**：
- `originalBody.json`: 从 91K → 22K (减少 76%)
- 保留结构完整性
- 便于快速查看和分析

### 2. SSE 数据处理

**输入** (YAML 块标量):
```yaml
responseBody: |+
  event: message_start
  data: {"type":"message_start",...}

  event: content_block_delta
  data: {"type":"content_block_delta",...}
```

**输出** (JSON):
```json
{
  "sse_events": [
    {"event": "message_start", "data": {...}},
    {"event": "content_block_delta", "data": {...}}
  ],
  "event_count": 56
}
```

### 3. Schema 生成

为每个数据文件生成对应的 `.schema.json`：
- 符合 JSON Schema Draft 7 标准
- 包含字段类型、必需字段等信息
- 可用于数据验证和代码生成

## 📊 文件大小对比

### 示例1: originalBody (Claude)

| 类型 | 大小 | 说明 |
|------|------|------|
| 原始 YAML | 160K | 完整 YAML 文件 |
| 裁剪后 JSON | 22K | 裁剪长字符串 |
| Schema | 91K | 完整类型定义 |

**压缩率**: 86% (YAML → JSON)

### 示例2: responseBody (Codex)

| 类型 | 大小 | 说明 |
|------|------|------|
| 原始 YAML | 306K | 完整 YAML 文件 |
| 裁剪后 JSON | 178K | SSE 事件数组 |
| Schema | 854B | 简单结构 |

**压缩率**: 42% (YAML → JSON)

## 🎯 数据结构示例

### originalBody.json (裁剪后)
```json
{
  "model": "mimo-v2-flash",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "<system-reminder>\nThis is a reminder that your todo list is curr...."
        }
      ]
    }
  ],
  "system": [
    {
      "type": "text",
      "text": "You are Claude Code, Anthropic's official CLI for Claude.",
      "cache_control": {"type": "ephemeral"}
    },
    {
      "type": "text",
      "text": "\nYou are an interactive CLI tool that helps users with software ....",
      "cache_control": {"type": "ephemeral"}
    }
  ],
  "tools": [...]
}
```

### originalBody.schema.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "description": "Schema for originalBody from 2026-01-04_21-42-07-414_1ompl7.yaml",
  "sample_count": 1,
  "type": "object",
  "properties": {
    "model": {"type": "string"},
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "role": {"type": "string"},
          "content": {
            "type": "array",
            "items": {
              "oneOf": [
                {"type": "object", "properties": {"type": {"type": "string"}, "text": {"type": "string"}}, ...},
                {"type": "object", "properties": {"type": {"type": "string"}, "text": {"type": "string"}, "cache_control": {...}}, ...}
              ]
            }
          }
        },
        "required": ["role", "content"]
      }
    },
    ...
  },
  "required": ["model", "messages", "system", "tools"],
  "additionalProperties": false
}
```

### responseBody.json (SSE)
```json
{
  "sse_events": [
    {
      "event": "message_start",
      "data": {
        "type": "message_start",
        "message": {
          "id": "msg_1789bfa1e7274d1b8bdc0229",
          "type": "message",
          "role": "assistant",
          "model": "mimo-v2-flash",
          "content": [],
          "usage": {"input_tokens": 0, "output_tokens": 0}
        }
      }
    },
    {
      "event": "content_block_delta",
      "data": {
        "type": "content_block_delta",
        "delta": {"type": "text_delta", "text": "你好"},
        "index": 0
      }
    }
  ],
  "event_count": 56
}
```

## 📝 脚本工作流程

```
YAML 文件
  ↓
PyYAML 解析 (支持块标量)
  ↓
提取 4 个字段
  ↓
┌─────────────┬──────────────┬─────────────┐
│ original... │ originalBody │ responseBody│
│ Headers     │              │             │
└─────────────┴──────────────┴─────────────┘
  ↓              ↓              ↓
JSON 解析      SSE 解析       SSE 解析
  ↓              ↓              ↓
裁剪字符串      裁剪字符串      保留结构
  ↓              ↓              ↓
保存 .json     保存 .json     保存 .json
  ↓              ↓              ↓
生成 Schema    生成 Schema    生成 Schema
  ↓              ↓              ↓
保存 .schema.json
```

## 🔍 验证脚本

```bash
python3 verify_schemas.py
```

验证所有 `.schema.json` 文件：
- ✅ 包含 `$schema` 字段
- ✅ 有正确的 `type` 定义
- ✅ 对象类型有 `properties` 和 `required`

## 📊 统计信息

```
处理的 YAML 文件: 2 个 (总计 466K)
生成的 JSON 数据: 8 个 (总计 236K)  ← 减少 49%
生成的 Schema: 8 个 (总计 96K)
总计: 332K
```

## 🎓 使用场景

### 1. 快速查看数据结构
```bash
cat 2026-01-04_21-42-07-414_1ompl7/originalBody.json
# 22K 的文件，包含完整结构
```

### 2. 验证数据有效性
```python
from jsonschema import validate
import json

with open('originalBody.schema.json') as f:
    schema = json.load(f)
with open('originalBody.json') as f:
    data = json.load(f)

validate(instance=data, schema=schema)
```

### 3. 生成类型定义
```bash
# 使用 json-schema-to-typescript
npx json2ts -i *.schema.json -o types/
```

### 4. 编写转换器
基于 Schema 和裁剪后的数据：
- 理解字段结构
- 定义映射规则
- 实现转换逻辑

## 💡 裁剪策略说明

### 为什么裁剪？
1. **原始数据过大**: originalBody 原始 91K，裁剪后 22K
2. **便于查看**: 快速浏览结构，无需滚动长文本
3. **保留关键信息**: 前 64 字符通常包含关键信息
4. **不影响 Schema**: Schema 仍然完整

### 裁剪规则
- **阈值**: 64 字符
- **后缀**: `....`
- **位置**: 所有叶子节点的字符串
- **例外**: 数字、布尔值、对象、数组不裁剪

### 示例
```
长度 50:  "Short text" → "Short text" (不变)
长度 64:  "Exactly 64 characters long, this is the limit" → 不变
长度 65:  "This is 65 characters long, needs truncation" → "This is 65 characters long, needs trun...."
```

## 🔄 可重复性

```bash
# 清理旧结果
rm -rf 2026-01-04_*

# 重新生成
python3 extract_schemas.py

# 验证
python3 verify_schemas.py
```

## 📚 文件说明

### extract_schemas.py (9.2K)
**主要函数**:
- `truncate_string()` - 裁剪单个字符串
- `truncate_long_strings()` - 递归裁剪数据结构
- `parse_sse_content()` - 解析 SSE 格式
- `generate_json_schema()` - 生成 Schema
- `main()` - 主流程

**关键特性**:
- 使用 PyYAML 解析块标量
- 递归处理嵌套结构
- 生成标准 JSON Schema

### verify_schemas.py (2.3K)
验证生成的 Schema 文件是否有效。

## ✅ 最终输出

每个 YAML 文件生成一个文件夹，包含：

**数据文件** (`.json`):
- 裁剪后的 JSON 数据
- 便于快速查看和分析
- 文件大小减少 50%+

**Schema 文件** (`.schema.json`):
- 完整的类型定义
- 符合 JSON Schema 标准
- 可用于验证和代码生成

---

**版本**: 3.0
**更新**: 2026-01-04
**特性**: 字符串裁剪 + Schema 分离
