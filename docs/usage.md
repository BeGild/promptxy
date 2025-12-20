# promptxy 使用指南

本文档详细说明如何配置三个 AI CLI 工具使用 `promptxy` 网关，以及规则引擎的语法和常见用例。

---

## 📋 目录

- [CLI 配置详解](#cli-配置详解)
- [规则引擎语法](#规则引擎语法)
- [常见用例](#常见用例)
- [调试与故障排查](#调试与故障排查)

---

## CLI 配置详解

### Claude Code

#### 配置方式

通过环境变量设置：

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:7070"
```

#### 永久配置

添加到 `~/.bashrc`、`~/.zshrc` 或 `~/.profile`：

```bash
# promptxy for Claude Code
export ANTHROPIC_BASE_URL="http://127.0.0.1:7070"
```

#### 验证配置

```bash
# 检查环境变量
echo $ANTHROPIC_BASE_URL

# 测试请求（需要已配置 Anthropic API Key）
claude -p "hello"
```

#### 预期行为

- 请求会先发送到 `promptxy`
- `promptxy` 根据规则修改 `system` 字段
- 修改后的请求转发到 `https://api.anthropic.com`

---

### Codex CLI

#### 配置方式 1：环境变量（推荐用于快速测试）

```bash
export OPENAI_BASE_URL="http://127.0.0.1:7070/openai"
```

#### 配置方式 2：配置文件（推荐用于生产）

编辑 `~/.codex/config.toml`：

```toml
model_provider = "promptxy"
wire_api = "responses"

[model_providers.promptxy]
name = "promptxy"
base_url = "http://127.0.0.1:7070/openai"
wire_api = "responses"
requires_openai_auth = true
```

#### 验证配置

```bash
# 检查环境变量（如果使用方式1）
echo $OPENAI_BASE_URL

# 测试请求（需要已配置 OpenAI API Key）
codex "hello"
```

#### 注意事项

- 必须使用 `/openai` 前缀
- Codex 可能依赖 `instructions` 字段的前缀，建议使用 `insert_after` 而非整体替换
- 认证信息会自动透传，无需在 `promptxy` 配置中保存

---

### Gemini CLI

#### 配置方式

通过环境变量设置：

```bash
export GOOGLE_GEMINI_BASE_URL="http://127.0.0.1:7070/gemini"
```

#### 永久配置

添加到 `~/.bashrc`、`~/.zshrc` 或 `~/.profile`：

```bash
# promptxy for Gemini CLI
export GOOGLE_GEMINI_BASE_URL="http://127.0.0.1:7070/gemini"
```

#### 验证配置

```bash
# 检查环境变量
echo $GOOGLE_GEMINI_BASE_URL

# 测试请求（需要已配置 Gemini API Key）
gemini "hello"
```

#### 支持的字段

`promptxy` 会自动识别并改写以下字段：
- `system_instruction` (字符串格式)
- `systemInstruction` (对象格式，包含 `parts` 数组)

#### 注意事项

- 必须使用 `/gemini` 前缀
- 支持 Gemini API Key 模式（当前不支持 Gemini Code Assist/GCA 模式）
- API Key 通过 `x-goog-api-key` 或查询参数透传

---

## 规则引擎语法

### 规则结构

```json
{
  "id": "规则唯一标识",
  "when": {
    "client": "claude",           // 必需：claude | codex | gemini
    "field": "system",            // 必需：system | instructions
    "method": "POST",             // 可选：HTTP 方法
    "pathRegex": "^/v1/messages", // 可选：路径正则
    "modelRegex": "sonnet"        // 可选：模型名称正则
  },
  "ops": [                        // 操作数组，按顺序执行
    { "type": "append", "text": "..." }
  ],
  "stop": false                   // 可选：是否在此规则后停止处理
}
```

### 支持的操作

#### 1. set - 完全替换

```json
{ "type": "set", "text": "全新的系统提示词" }
```

#### 2. append - 追加到末尾

```json
{ "type": "append", "text": "\nAlways respond in Chinese." }
```

#### 3. prepend - 插入到开头

```json
{ "type": "prepend", "text": "Priority instructions: " }
```

#### 4. replace - 替换匹配内容

**字符串匹配：**
```json
{ "type": "replace", "match": "old text", "replacement": "new text" }
```

**正则匹配：**
```json
{ "type": "replace", "regex": "file size.*?\\d+MB", "replacement": "no file size limit", "flags": "i" }
```

#### 5. delete - 删除匹配内容

**字符串匹配：**
```json
{ "type": "delete", "match": "unwanted rule" }
```

**正则匹配：**
```json
{ "type": "delete", "regex": "be concise", "flags": "i" }
```

#### 6. insert_before - 在匹配前插入

```json
{ "type": "insert_before", "regex": "^You are", "text": "IMPORTANT: " }
```

#### 7. insert_after - 在匹配后插入

```json
{ "type": "insert_after", "regex": "^You are", "text": " Always be helpful." }
```

### 匹配条件详解

#### client (必需)
- `claude` - 匹配 Claude Code 请求
- `codex` - 匹配 Codex CLI 请求
- `gemini` - 匹配 Gemini CLI 请求

#### field (必需)
- `system` - 用于 Claude 和 Gemini
- `instructions` - 用于 Codex

#### method (可选)
- 如果指定，只匹配该 HTTP 方法的请求
- 示例：`"method": "POST"`

#### pathRegex (可选)
- 正则表达式，匹配请求路径
- 示例：`"^/v1/messages"` 匹配 Claude 的消息接口

#### modelRegex (可选)
- 正则表达式，匹配模型名称
- 示例：`"sonnet|opus"` 匹配 Claude 的 sonnet 和 opus 模型

### 执行顺序

1. **规则按数组顺序匹配**
2. **每个规则的 ops 按数组顺序执行**
3. **如果设置了 `stop: true`，匹配后停止处理后续规则**
4. **无匹配规则时，请求原样转发（no-op）**

---

## 常见用例

### 用例 1：强制使用中文

```json
{
  "rules": [
    {
      "id": "claude-chinese",
      "when": { "client": "claude", "field": "system" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }]
    },
    {
      "id": "codex-chinese",
      "when": { "client": "codex", "field": "instructions" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }]
    },
    {
      "id": "gemini-chinese",
      "when": { "client": "gemini", "field": "system" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }]
    }
  ]
}
```

### 用例 2：移除文件大小限制

```json
{
  "rules": [
    {
      "id": "remove-file-limit",
      "when": { "client": "claude", "field": "system" },
      "ops": [
        {
          "type": "delete",
          "regex": "file size.*?\\d+MB",
          "flags": "i"
        }
      ]
    }
  ]
}
```

### 用例 3：在特定位置插入规则

```json
{
  "rules": [
    {
      "id": "insert-after-intro",
      "when": { "client": "codex", "field": "instructions" },
      "ops": [
        {
          "type": "insert_after",
          "regex": "^You are",
          "text": " Always provide detailed explanations."
        }
      ]
    }
  ]
}
```

### 用例 4：替换特定关键词

```json
{
  "rules": [
    {
      "id": "replace-terminology",
      "when": { "client": "claude", "field": "system" },
      "ops": [
        {
          "type": "replace",
          "match": "be concise",
          "replacement": "be thorough and detailed"
        }
      ]
    }
  ]
}
```

### 用例 5：按模型定制规则

```json
{
  "rules": [
    {
      "id": "sonnet-specific",
      "when": {
        "client": "claude",
        "field": "system",
        "modelRegex": "sonnet"
      },
      "ops": [{ "type": "append", "text": "\nOptimize for code quality." }]
    },
    {
      "id": "opus-specific",
      "when": {
        "client": "claude",
        "field": "system",
        "modelRegex": "opus"
      },
      "ops": [{ "type": "append", "text": "\nFocus on complex reasoning." }]
    }
  ]
}
```

### 用例 6：多操作组合

```json
{
  "rules": [
    {
      "id": "comprehensive-customization",
      "when": { "client": "claude", "field": "system" },
      "ops": [
        { "type": "prepend", "text": "CUSTOM RULES:\n" },
        { "type": "delete", "regex": "be concise", "flags": "i" },
        { "type": "append", "text": "\nAlways use Chinese." },
        { "type": "replace", "match": "helpful", "replacement": "extremely helpful" }
      ]
    }
  ]
}
```

### 用例 7：仅对特定路径生效

```json
{
  "rules": [
    {
      "id": "messages-only",
      "when": {
        "client": "claude",
        "field": "system",
        "pathRegex": "^/v1/messages$"
      },
      "ops": [{ "type": "append", "text": "\nOnly for messages endpoint." }]
    }
  ]
}
```

---

## 调试与故障排查

### 启用调试模式

#### 方式 1：配置文件

```json
{
  "debug": true
}
```

#### 方式 2：环境变量

```bash
PROMPTXY_DEBUG=1 npm run dev
```

### 调试输出示例

```
[promptxy] CLAUDE POST /v1/messages -> https://api.anthropic.com (rules=example-rule ops=1)
```

这表示：
- 客户端：`CLAUDE`
- 方法：`POST`
- 路径：`/v1/messages`
- 转发到：`https://api.anthropic.com`
- 匹配规则：`example-rule`
- 执行操作数：`1`

### 常见问题

#### 1. 规则不匹配

**检查清单：**
- ✅ `client` 是否正确（claude/codex/gemini）
- ✅ `field` 是否正确（system/instructions）
- ✅ 正则表达式是否正确（可使用在线正则测试工具）
- ✅ 是否需要 `method`、`pathRegex` 或 `modelRegex` 条件

**调试方法：**
```bash
# 启用调试模式
PROMPTXY_DEBUG=1 npm run dev

# 发送测试请求
# 查看控制台输出的规则匹配信息
```

#### 2. CLI 未通过网关

**检查清单：**
- ✅ 环境变量是否设置正确
- ✅ 环境变量是否已导出（`export`）
- ✅ 网关服务是否正在运行
- ✅ 端口是否正确（默认 7070）

**验证方法：**
```bash
# 1. 检查环境变量
echo $ANTHROPIC_BASE_URL  # Claude
echo $OPENAI_BASE_URL     # Codex
echo $GOOGLE_GEMINI_BASE_URL  # Gemini

# 2. 检查网关是否运行
curl http://127.0.0.1:7070/_promptxy/health

# 3. 查看网关日志
# 在调试模式下，每个请求都会打印日志
```

#### 3. 认证失败

**原因：** `promptxy` 不存储密钥，只透传认证信息

**解决：**
- 确保 CLI 自身已配置正确的 API Key
- 检查 CLI 是否正确发送认证头
- 验证上游 API 密钥有效

#### 4. 流式响应异常

**可能原因：**
- 网关未正确处理 SSE 流
- 响应头被错误修改

**验证：**
```bash
# 检查响应头
curl -v http://127.0.0.1:7070/_promptxy/health
```

### 健康检查

```bash
# 快速检查
curl http://127.0.0.1:7070/_promptxy/health

# 预期输出
{"status":"ok"}
```

### 日志说明

#### 调试模式日志格式

```
[promptxy] <CLIENT> <METHOD> <PATH> -> <UPSTREAM> (rules=<rule_ids> ops=<count>)
```

**示例：**
```
[promptxy] CLAUDE POST /v1/messages -> https://api.anthropic.com (rules=force-chinese,remove-limit ops=3)
```

#### 敏感信息保护

`promptxy` **永远不会**在日志中打印：
- `Authorization` 头的值
- `x-goog-api-key` 头的值
- 任何包含 `key`、`token`、`secret` 的请求头值

---

## 最佳实践

### 1. 从小规则开始

先测试单个简单规则，确认工作正常后再添加复杂规则。

### 2. 使用调试模式

首次配置时始终启用 `debug: true` 或 `PROMPTXY_DEBUG=1`。

### 3. 规则命名清晰

使用有意义的 `id`，如 `force-chinese-claude` 而非 `rule-1`。

### 4. 注意执行顺序

规则按数组顺序执行，后面的规则可能覆盖前面的结果。

### 5. 测试每个 CLI

分别测试 Claude、Codex、Gemini，确保每个都正常工作。

### 6. 备份配置

修改配置前备份原文件，便于回滚。

---

## 下一步

- 查看 [配置参考](configuration.md) 了解所有配置选项
- 阅读 [origin-and-requirements.md](origin-and-requirements.md) 了解设计背景
