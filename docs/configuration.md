# promptxy 配置参考

本文档详细说明 `promptxy` 的所有配置选项、环境变量覆盖和规则语法。

---

## 📋 配置文件位置

`promptxy` 按以下顺序查找配置文件：

1. **环境变量指定**：`PROMPTXY_CONFIG=/path/to/config.json`
2. **当前目录**：`./promptxy.config.json`
3. **用户主目录**：`~/.promptxy/config.json`

---

## 📝 配置文件结构

```json
{
  "listen": {
    "host": "127.0.0.1",
    "port": 7070
  },
  "upstreams": {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com",
    "gemini": "https://generativelanguage.googleapis.com"
  },
  "rules": [
    {
      "id": "example-rule",
      "when": { "client": "claude", "field": "system" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }]
    }
  ],
  "debug": false
}
```

---

## 🔧 配置项详解

### listen

**类型**：`object`
**必需**：是

#### host

**类型**：`string`
**默认值**：`"127.0.0.1"`
**说明**：服务绑定的主机地址

**安全建议**：

- 保持默认 `127.0.0.1` 以限制本地访问
- 仅在受信任网络中使用 `0.0.0.0`

#### port

**类型**：`number`
**默认值**：`7070`
**范围**：`1-65535`
**说明**：服务监听的端口号

**示例**：

```json
"listen": { "host": "127.0.0.1", "port": 8080 }
```

---

### upstreams

**类型**：`object`
**必需**：是
**说明**：三个 AI 服务的上游 API 地址

#### anthropic

**类型**：`string` (URL)
**默认值**：`"https://api.anthropic.com"`
**说明**：Claude Code 的上游 API

#### openai

**类型**：`string` (URL)
**默认值**：`"https://api.openai.com"`
**说明**：Codex CLI 的上游 API

#### gemini

**类型**：`string` (URL)
**默认值**：`"https://generativelanguage.googleapis.com"`
**说明**：Gemini CLI 的上游 API

**示例**：

```json
"upstreams": {
  "anthropic": "https://api.anthropic.com",
  "openai": "https://api.openai.com",
  "gemini": "https://generativelanguage.googleapis.com"
}
```

---

### rules

**类型**：`array<Rule>`
**默认值**：`[]`
**说明**：规则数组，按顺序执行

#### 规则对象结构

```typescript
{
  id: string;              // 必需：规则唯一标识
  when: {                  // 必需：匹配条件
    client: string;        // 必需：claude | codex | gemini
    field: string;         // 必需：system | instructions
    method?: string;       // 可选：HTTP 方法
    pathRegex?: string;    // 可选：路径正则
    modelRegex?: string;   // 可选：模型正则
  };
  ops: Array<Operation>;   // 必需：操作数组
  stop?: boolean;          // 可选：是否停止后续规则
}
```

#### 规则示例

```json
{
  "rules": [
    {
      "id": "rule-1",
      "when": { "client": "claude", "field": "system" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }]
    },
    {
      "id": "rule-2",
      "when": { "client": "codex", "field": "instructions" },
      "ops": [
        { "type": "delete", "regex": "be concise", "flags": "i" },
        { "type": "append", "text": "\nBe thorough." }
      ],
      "stop": false
    }
  ]
}
```

---

### debug

**类型**：`boolean`
**默认值**：`false`
**说明**：启用调试模式，打印规则匹配详情

**调试模式行为**：

- 打印每个请求的规则匹配情况
- 显示应用的规则 ID 和操作数量
- **不会**打印敏感信息（Authorization、API Key 等）

**示例**：

```json
"debug": true
```

---

## 🎛️ 环境变量覆盖

所有配置项都可以通过环境变量覆盖，优先级：**环境变量 > 配置文件 > 默认值**

| 环境变量                      | 配置项                | 示例值                                      | 说明         |
| ----------------------------- | --------------------- | ------------------------------------------- | ------------ |
| `PROMPTXY_HOST`               | `listen.host`         | `127.0.0.1`                                 | 绑定主机     |
| `PROMPTXY_PORT`               | `listen.port`         | `7070`                                      | 监听端口     |
| `PROMPTXY_UPSTREAM_ANTHROPIC` | `upstreams.anthropic` | `https://api.anthropic.com`                 | Claude 上游  |
| `PROMPTXY_UPSTREAM_OPENAI`    | `upstreams.openai`    | `https://api.openai.com`                    | Codex 上游   |
| `PROMPTXY_UPSTREAM_GEMINI`    | `upstreams.gemini`    | `https://generativelanguage.googleapis.com` | Gemini 上游  |
| `PROMPTXY_DEBUG`              | `debug`               | `1` 或 `true`                               | 调试模式     |
| `PROMPTXY_CONFIG`             | -                     | `/path/to/config.json`                      | 配置文件路径 |

**使用示例**：

```bash
# 临时覆盖配置
PROMPTXY_PORT=9000 PROMPTXY_DEBUG=1 npm run dev

# 指定配置文件
PROMPTXY_CONFIG=/etc/promptxy/production.json npm run start
```

---

## 📋 操作类型详解

所有操作都作用于提示词文本，按 `ops` 数组顺序执行。

### set

**完全替换提示词**

```json
{ "type": "set", "text": "全新的系统提示词" }
```

**使用场景**：需要完全重写默认提示词

---

### append

**追加到末尾**

```json
{ "type": "append", "text": "\nAlways respond in Chinese." }
```

**使用场景**：添加额外指令而不影响原有内容

---

### prepend

**插入到开头**

```json
{ "type": "prepend", "text": "PRIORITY INSTRUCTIONS:\n" }
```

**使用场景**：添加高优先级指令

---

### replace

**替换匹配内容**

**字符串匹配：**

```json
{ "type": "replace", "match": "old text", "replacement": "new text" }
```

**正则匹配：**

```json
{
  "type": "replace",
  "regex": "file size.*?\\d+MB",
  "replacement": "no file size limit",
  "flags": "i"
}
```

**参数说明**：

- `match`：精确字符串匹配（不能与 `regex` 同时使用）
- `regex`：正则表达式匹配
- `flags`：正则标志（如 `i` 忽略大小写，`g` 全局替换）
- `replacement`：替换后的文本

**使用场景**：修改特定词汇或规则

---

### delete

**删除匹配内容**

**字符串匹配：**

```json
{ "type": "delete", "match": "unwanted rule" }
```

**正则匹配：**

```json
{ "type": "delete", "regex": "be concise", "flags": "i" }
```

**参数说明**：

- `match`：精确字符串匹配（不能与 `regex` 同时使用）
- `regex`：正则表达式匹配
- `flags`：正则标志

**使用场景**：移除不需要的默认规则

---

### insert_before

**在匹配前插入**

```json
{ "type": "insert_before", "regex": "^You are", "text": "IMPORTANT: " }
```

**参数说明**：

- `regex`：必需，用于定位插入位置
- `text`：必需，要插入的文本
- `flags`：可选，正则标志

**使用场景**：在特定位置前添加指令

---

### insert_after

**在匹配后插入**

```json
{ "type": "insert_after", "regex": "^You are", "text": " Always be helpful." }
```

**参数说明**：

- `regex`：必需，用于定位插入位置
- `text`：必需，要插入的文本
- `flags`：可选，正则标志

**使用场景**：在特定位置后添加指令

---

## 🎯 匹配条件详解

### client (必需)

**类型**：`string`
**取值**：`"claude"` | `"codex"` | `"gemini"`

**说明**：指定规则适用的 CLI 客户端

**示例**：

```json
{ "client": "claude" }
```

---

### field (必需)

**类型**：`string`
**取值**：`"system"` | `"instructions"`

**说明**：指定要改写的请求字段

**对应关系**：

- Claude Code → `system`
- Codex CLI → `instructions`
- Gemini CLI → `system`

**示例**：

```json
{ "client": "claude", "field": "system" }
```

---

### method (可选)

**类型**：`string`
**默认**：无（匹配所有方法）

**说明**：HTTP 请求方法过滤

**示例**：

```json
{ "client": "claude", "field": "system", "method": "POST" }
```

---

### pathRegex (可选)

**类型**：`string` (正则表达式)
**默认**：无（匹配所有路径）

**说明**：请求路径正则匹配

**示例**：

```json
{ "client": "claude", "field": "system", "pathRegex": "^/v1/messages$" }
```

---

### modelRegex (可选)

**类型**：`string` (正则表达式)
**默认**：无（匹配所有模型）

**说明**：模型名称正则匹配

**示例**：

```json
{ "client": "claude", "field": "system", "modelRegex": "sonnet|opus" }
```

---

## 🔒 安全配置

### 本地绑定

**推荐配置**：

```json
{
  "listen": {
    "host": "127.0.0.1",
    "port": 7070
  }
}
```

**原因**：

- 防止局域网其他设备访问
- 避免暴露到公网
- 符合最小权限原则

---

### 凭据处理

**重要原则**：

- ❌ **不在配置文件中存储 API Key**
- ✅ **完全依赖 CLI 自身的认证信息**
- ✅ **认证头自动透传到上游**

**配置示例**（正确方式）：

```json
{
  "upstreams": {
    "anthropic": "https://api.anthropic.com"
    // 不需要在这里放 API Key
  }
}
```

---

### 敏感头过滤

`promptxy` 自动过滤以下头部，**不会**在日志中打印：

- `Authorization`
- `x-goog-api-key`
- 任何包含 `key`、`token`、`secret` 的头部

---

## 📊 配置验证

### 语法验证

配置文件必须是有效的 JSON，且符合以下结构：

```typescript
interface PromptxyConfig {
  listen: {
    host: string;
    port: number; // 1-65535
  };
  upstreams: {
    anthropic: string; // 必须是有效 URL
    openai: string; // 必须是有效 URL
    gemini: string; // 必须是有效 URL
  };
  rules: Array<{
    id: string;
    when: {
      client: 'claude' | 'codex' | 'gemini';
      field: 'system' | 'instructions';
      method?: string;
      pathRegex?: string;
      modelRegex?: string;
    };
    ops: Array<any>; // 非空数组
    stop?: boolean;
  }>;
  debug?: boolean;
}
```

### 启动时验证

服务启动时会自动验证配置：

```bash
npm run dev
```

**验证失败示例**：

```
Error: config.listen.port must be an integer in [1, 65535]
```

**修复后**：

```
promptxy listening on http://127.0.0.1:7070
```

---

## 🧪 测试配置

### 健康检查

```bash
curl http://127.0.0.1:7070/_promptxy/health
# {"status":"ok"}
```

### 调试模式测试

```bash
# 启动调试模式
PROMPTXY_DEBUG=1 npm run dev

# 发送测试请求
# 查看控制台输出的规则匹配信息
```

---

## 📝 配置示例

### 最小配置

```json
{
  "listen": { "host": "127.0.0.1", "port": 7070 },
  "upstreams": {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com",
    "gemini": "https://generativelanguage.googleapis.com"
  },
  "rules": [],
  "debug": false
}
```

### 完整配置

```json
{
  "listen": {
    "host": "127.0.0.1",
    "port": 7070
  },
  "upstreams": {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com",
    "gemini": "https://generativelanguage.googleapis.com"
  },
  "rules": [
    {
      "id": "force-chinese-all",
      "when": { "client": "claude", "field": "system" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }]
    },
    {
      "id": "remove-codex-limit",
      "when": { "client": "codex", "field": "instructions" },
      "ops": [{ "type": "delete", "regex": "be concise", "flags": "i" }]
    },
    {
      "id": "gemini-custom",
      "when": { "client": "gemini", "field": "system" },
      "ops": [
        { "type": "prepend", "text": "CUSTOM: " },
        { "type": "append", "text": " Always be helpful." }
      ]
    }
  ],
  "debug": true
}
```

---

## 🔧 高级配置

### 自定义上游地址

如果你使用自建的 API 代理或镜像：

```json
{
  "upstreams": {
    "anthropic": "https://my-proxy.example.com/anthropic",
    "openai": "https://my-proxy.example.com/openai",
    "gemini": "https://my-proxy.example.com/gemini"
  }
}
```

### 多环境配置

**开发环境** (`promptxy.config.dev.json`)：

```json
{
  "listen": { "host": "127.0.0.1", "port": 7070 },
  "debug": true,
  "rules": [...]
}
```

**生产环境** (`promptxy.config.prod.json`)：

```json
{
  "listen": { "host": "127.0.0.1", "port": 7070 },
  "debug": false,
  "rules": [...]
}
```

切换环境：

```bash
PROMPTXY_CONFIG=promptxy.config.prod.json npm run start
```

---

## 📚 相关文档

- [使用指南](usage.md) - CLI 配置和规则语法详解
- [README.md](../README.md) - 快速开始和常见用例
