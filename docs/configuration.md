# promptxy 配置参考

本文档详细说明 `promptxy` 的所有配置选项、环境变量覆盖和规则语法。

---

## 📋 配置文件位置

支持项目配置和全局配置合并，查找顺序：

1. **环境变量指定**：`PROMPTXY_CONFIG=/path/to/config.json`（指定全局配置路径）
2. **项目配置**：从当前目录向上查找 `promptxy.config.json`（最多3级）
3. **全局配置**：`~/.config/promptxy/config.json`

配置优先级：**项目配置 < 全局配置**（同名配置项后者覆盖前者）

---

## 📝 配置文件结构

```json
{
  "listen": {
    "host": "127.0.0.1",
    "port": 7070
  },
  "suppliers": [
    {
      "id": "claude-anthropic",
      "name": "Claude (Anthropic)",
      "baseUrl": "https://api.anthropic.com",
      "localPrefix": "/claude",
      "pathMappings": [],
      "enabled": true
    }
  ],
  "rules": [
    {
      "uuid": "rule-001",
      "name": "添加中文指令",
      "when": { "client": "claude", "field": "system" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }],
      "enabled": true
    }
  ],
  "storage": {
    "maxHistory": 1000
  },
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
**说明**：网关服务绑定的主机地址

**安全建议**：

- 保持默认 `127.0.0.1` 以限制本地访问
- 仅在受信任网络中使用 `0.0.0.0`

#### port

**类型**：`number`
**默认值**：`7070`
**范围**：`1-65535`
**说明**：网关服务监听的端口号

**示例**：

```json
"listen": { "host": "127.0.0.1", "port": 8080 }
```

---

### suppliers

**类型**：`array<Supplier>`
**必需**：是
**说明**：上游供应商配置数组，支持配置多个供应商并灵活切换

#### Supplier 对象结构

```typescript
{
  id: string;              // 必需：供应商唯一标识
  name: string;            // 必需：显示名称
  baseUrl: string;         // 必需：上游 API 地址
  localPrefix: string;     // 必需：本地路径前缀（如 /claude）
  pathMappings?: Array<{   // 可选：路径映射规则
    from: string;
    to: string;
    type?: 'exact' | 'prefix' | 'regex';
  }>;
  auth?: {                 // 可选：上游认证配置
    type: 'bearer' | 'header';
    token?: string;        // type=bearer 时必填
    headerName?: string;   // type=header 时必填
    headerValue?: string;  // type=header 时必填
  };
  transformer?: {          // 可选：协议转换配置
    default: TransformerStep[];  // 默认转换链
    models?: {                    // 模型精确匹配覆盖
      [modelName: string]: TransformerStep[];
    };
  };
  enabled: boolean;        // 必需：是否启用
}
```

#### Transformer 配置

Transformer 配置用于将 Anthropic 协议转换为其他供应商协议。

**转换器步骤类型**：

```typescript
type TransformerStep = string | {
  name: string;
  options?: Record<string, unknown>;
};
```

**可用转换器**：

| 名称 | 描述 | 支持的供应商 |
|------|------|-------------|
| `anthropic` | Anthropic 原始协议（透传） | anthropic |
| `openai` | OpenAI 兼容格式 | openai, deepseek, groq |
| `gemini` | Gemini API 格式 | gemini |
| `cleancache` | 清除 cache_control 字段 | 通用 |
| `maxtoken` | 设置 max_tokens 值 | 通用 |

**配置示例 - OpenAI 转换**：

```json
{
  "transformer": {
    "default": ["openai"]
  }
}
```

**配置示例 - 带清理的转换**：

```json
{
  "transformer": {
    "default": ["cleancache", "openai"]
  }
}
```

**配置示例 - 模型特定转换**：

```json
{
  "transformer": {
    "default": ["openai"],
    "models": {
      "claude-3-5-sonnet-20241022": ["cleancache", "openai"]
    }
  }
}
```

#### 配置说明

- **id**：供应商的唯一标识符，自动生成或手动指定
- **name**：显示在 UI 中的供应商名称
- **baseUrl**：上游 API 的完整地址
- **localPrefix**：本地访问路径前缀，必须以 `/` 开头
- **pathMappings**：路径映射规则，用于转换请求路径
- **enabled**：控制供应商是否启用，相同 `localPrefix` 的供应商不能同时启用

#### 路径映射规则

**type: 'prefix'** (默认)

前缀匹配替换，常用于路径前缀转换：

```json
{
  "from": "/v1/",
  "to": "/api/v1/",
  "type": "prefix"
}
```

**type: 'exact'**

精确匹配替换：

```json
{
  "from": "/messages",
  "to": "/chat/completions",
  "type": "exact"
}
```

**type: 'regex'**

正则表达式匹配替换：

```json
{
  "from": "^/v1/(.+)$",
  "to": "/api/v1/$1",
  "type": "regex"
}
```

#### 路由匹配规则

请求会按以下规则匹配供应商：

1. 只考虑 `enabled: true` 的供应商
2. 按 `localPrefix` 长度降序排序（优先匹配更长的前缀）
3. 第一个匹配的供应商将处理请求
4. 相同 `localPrefix` 的供应商不能同时启用（会报错）

**示例**：

```json
"suppliers": [
  {
    "id": "claude-official",
    "name": "Claude Official",
    "baseUrl": "https://api.anthropic.com",
    "localPrefix": "/claude",
    "enabled": true
  },
  {
    "id": "claude-test",
    "name": "Claude Test",
    "baseUrl": "https://test.example.com",
    "localPrefix": "/claude",
    "enabled": false
  }
]
```

访问 `/claude/v1/messages` 时：

- 如果 `claude-official` 启用，请求转发到 `https://api.anthropic.com/v1/messages`
- 如果 `claude-test` 启用，请求转发到 `https://test.example.com/v1/messages`

---

### rules

**类型**：`array<Rule>`
**默认值**：`[]`
**说明**：规则数组，按顺序执行

#### 完整版规则对象结构

```typescript
{
  uuid: string;              // 必需：规则唯一标识符（自动生成）
  name: string;              // 必需：规则名称
  description?: string;      // 可选：规则描述
  when: {                    // 必需：匹配条件
    client: string;          // 必需：claude | codex | gemini
    field: string;           // 必需：system | instructions
    method?: string;         // 可选：HTTP 方法
    pathRegex?: string;      // 可选：路径正则（不支持 g 标志）
    modelRegex?: string;     // 可选：模型正则
  };
  ops: Array<Operation>;     // 必需：操作数组
  stop?: boolean;            // 可选：是否停止后续规则
  enabled?: boolean;         // 可选：是否启用
}
```

#### 简化版规则对象结构

```typescript
{
  uuid: string;              // 必需：规则唯一标识
  name: string;              // 必需：规则显示名称
  when: {                    // 必需：匹配条件
    client: string;          // 必需：claude | codex | gemini
    field: string;           // 必需：system | instructions
    method?: string;         // 可选：HTTP 方法
    pathRegex?: string;      // 可选：路径正则（不支持 g 标志）（不支持 g 标志）
    modelRegex?: string;     // 可选：模型名称正则
  };
  ops: Array<Operation>;     // 必需：操作数组
  stop?: boolean;            // 可选：是否停止后续规则
  enabled?: boolean;         // 可选：是否启用
}
```

**注意**：后端校验要求规则必须包含 `uuid` 和 `name` 字段。

#### 规则示例（完整版）

```json
{
  "rules": [
    {
      "uuid": "rule-001",
      "name": "强制中文响应",
      "when": { "client": "claude", "field": "system" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }],
      "enabled": true
    },
    {
      "uuid": "rule-002",
      "name": "移除简洁限制",
      "when": { "client": "codex", "field": "instructions" },
      "ops": [
        { "type": "delete", "regex": "be concise", "flags": "i" },
        { "type": "append", "text": "\nBe thorough." }
      ],
      "enabled": true
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

部分配置项可以通过环境变量覆盖，优先级：**环境变量 > 配置文件 > 默认值**

### 通用环境变量

| 环境变量            | 配置项        | 示例值                 | 说明         |
| ------------------- | ------------- | ---------------------- | ------------ |
| `PROMPTXY_HOST`     | `listen.host` | `127.0.0.1`            | 绑定主机     |
| `PROMPTXY_PORT`     | `listen.port` | `7070`                 | 监听端口     |
| `PROMPTXY_DEBUG`    | `debug`       | `1` 或 `true`          | 调试模式     |
| `PROMPTXY_CONFIG`   | -             | `/path/to/config.json` | 配置文件路径 |

### 简化版专用环境变量

| 环境变量                      | 配置项                    | 示例值                                  |
| ----------------------------- | ------------------------- | --------------------------------------- |
| `PROMPTXY_UPSTREAM_ANTHROPIC` | `upstreams.anthropic`     | `https://api.anthropic.com`             |
| `PROMPTXY_UPSTREAM_OPENAI`    | `upstreams.openai`        | `https://api.openai.com`                |
| `PROMPTXY_UPSTREAM_GEMINI`    | `upstreams.gemini`        | `https://generativelanguage.googleapis.com` |

**注意**：
- 供应商（suppliers）配置不支持环境变量覆盖，请通过配置文件或 Web UI 管理
- 简化版使用 `upstreams`，完整版使用 `suppliers`

**使用示例**：

```bash
# 临时覆盖配置
PROMPTXY_PORT=9000 PROMPTXY_DEBUG=1 npm run dev

# 指定配置文件
PROMPTXY_CONFIG=/etc/promptxy/production.json npm run start

# 简化版：覆盖上游地址
PROMPTXY_UPSTREAM_ANTHROPIC=https://custom.example.com npm start
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
- `flags`：正则标志（如 `i` 忽略大小写；注意 `replace` 操作仅替换第一个匹配，不支持 `g` 全局标志）
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

**注意**：`insert_before` 的匹配是基于**整个文本**。如果 `regex` 匹配了整段文本，则会在文本开头插入。

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

**注意**：`insert_after` 的匹配是基于**整个文本**。如果 `regex` 匹配了整段文本，则会在文本末尾插入。这与 `replace` 操作（基于匹配内容的局部替换）的行为不同。

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

**注意**：`pathRegex` 不支持 `g`（全局）标志，仅支持 `i`（忽略大小写）标志

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

**重要变更**：

从 v2.1.5 开始，PromptXY 支持**存储上游认证信息**，提供以下两种配置方式：

1. **透传客户端凭证（默认行为）**：完全依赖 CLI 自身的认证信息，自动透传到上游
2. **配置上游认证（新功能）**：在配置文件中存储上游 API Key，自动注入到请求中

#### 方式一：透传客户端凭证（推荐用于本地开发）

CLI 自带的认证信息会自动透传到上游，无需在配置文件中存储 API Key。

**配置示例**：

```json
{
  "suppliers": [
    {
      "id": "claude-official",
      "name": "Claude Official",
      "baseUrl": "https://api.anthropic.com",
      "localPrefix": "/claude",
      "enabled": true
      // 不配置 auth，使用 CLI 自带的凭证
    }
  ]
}
```

#### 方式二：配置上游认证（推荐用于服务器部署）

在配置文件中存储上游 API Key，PromptXY 会自动注入到请求中。

**配置示例 - Bearer Token**：

```json
{
  "suppliers": [
    {
      "id": "openai-proxy",
      "name": "OpenAI Proxy",
      "baseUrl": "https://api.openai.com",
      "localPrefix": "/codex",
      "auth": {
        "type": "bearer",
        "token": "sk-xxxxx..."
      },
      "transformer": {
        "default": ["openai"]
      },
      "enabled": true
    }
  ]
}
```

**配置示例 - 自定义 Header**：

```json
{
  "suppliers": [
    {
      "id": "deepseek-proxy",
      "name": "DeepSeek Proxy",
      "baseUrl": "https://api.deepseek.com",
      "localPrefix": "/deepseek",
      "auth": {
        "type": "header",
        "headerName": "Authorization",
        "headerValue": "Bearer xxxx..."
      },
      "transformer": {
        "default": ["deepseek"]
      },
      "enabled": true
    }
  ]
}
```

#### 网关入站鉴权 (gatewayAuth)

如果需要限制对 PromptXY 网关本身的访问，可以配置 `gatewayAuth`：

```json
{
  "gatewayAuth": {
    "enabled": true,
    "token": "your-secret-token",
    "acceptedHeaders": ["authorization", "x-api-key"]
  }
}
```

**说明**：
- `enabled`: 是否启用入站鉴权
- `token`: 验证用的 token（与客户端请求头中的值比对）
- `acceptedHeaders`: 从哪些 header 中读取 token（按顺序检查第一个匹配的）

**工作流程**：
1. 客户端请求到达 PromptXY
2. PromptXY 从 `acceptedHeaders` 指定的 header 中读取 token
3. 与 `token` 字段比对，验证通过才继续处理
4. **清除**入站鉴权头，避免误传到上游
5. 根据 `supplier.auth` 配置注入上游认证

#### 脱敏策略

PromptXY 在以下场景中会自动脱敏敏感字段：

- **日志输出**：Authorization、x-api-key、x-goog-api-key 等字段会显示为 `***REDACTED***`
- **请求历史记录**：所有敏感字段都会被脱敏
- **预览 API**：默认返回脱敏后的 headers
- **trace 输出**：authHeaderUsed 字段只包含 header 名称，不包含值

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

**完整版类型定义**：

```typescript
interface PromptxyConfig {
  listen: {
    host: string;
    port: number; // 1-65535
  };
  suppliers: Array<{
    id: string;
    name: string;
    baseUrl: string; // 必须是有效 URL
    localPrefix: string; // 必须以 / 开头
    pathMappings?: Array<{
      from: string;
      to: string;
      type?: 'exact' | 'prefix' | 'regex';
    }>;
    enabled: boolean;
  }>;
  rules: Array<{
    uuid: string;
    name?: string;
    when: {
      client: 'claude' | 'codex' | 'gemini';
      field: 'system' | 'instructions';
      method?: string;
      pathRegex?: string;
      modelRegex?: string;
    };
    ops: Array<any>; // 非空数组
    stop?: boolean;
    enabled?: boolean;
  }>;
  storage: {
    maxHistory: number;
  };
  debug?: boolean;
}
```

**简化版类型定义**：

```typescript
interface PromptxyConfig {
  listen: {
    host: string;
    port: number; // 1-65535
  };
  upstreams: {
    anthropic: string;
    openai: string;
    gemini: string;
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
Error: config.suppliers must contain at least one supplier
```

```
Error: Local prefix '/claude' is used by multiple enabled suppliers: Claude Official, Claude Test
```

**修复后**：

```
PromptXY listening on http://127.0.0.1:7070
```

---

## 🧪 测试配置

### 健康检查

```bash
curl http://127.0.0.1:7070/_promptxy/health
# {"status":"ok"}
```

### 测试供应商路由

```bash
# 测试 Claude 供应商（假设 localPrefix 为 /claude）
curl http://127.0.0.1:7070/claude/v1/messages

# 测试 Codex 供应商（假设 localPrefix 为 /codex）
curl http://127.0.0.1:7070/codex/responses
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

**简化版**：

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

**完整版**：

```json
{
  "listen": { "host": "127.0.0.1", "port": 7070 },
  "suppliers": [
    {
      "id": "claude-anthropic",
      "name": "Claude (Anthropic)",
      "baseUrl": "https://api.anthropic.com",
      "localPrefix": "/claude",
      "enabled": true
    }
  ],
  "rules": [],
  "storage": { "maxHistory": 1000 },
  "debug": false
}
```

### 完整配置示例

**简化版**：

```json
{
  "listen": { "host": "127.0.0.1", "port": 7070 },
  "upstreams": {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com",
    "gemini": "https://generativelanguage.googleapis.com"
  },
  "rules": [
    {
      "uuid": "force-chinese",
      "name": "force-chinese",
      "when": { "client": "claude", "field": "system" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }]
    },
    {
      "uuid": "remove-codex-limit",
      "name": "remove-codex-limit",
      "when": { "client": "codex", "field": "instructions" },
      "ops": [{ "type": "delete", "regex": "be concise", "flags": "i" }]
    }
  ],
  "debug": true
}
```

**完整版**：

```json
{
  "listen": { "host": "127.0.0.1", "port": 7070 },
  "suppliers": [
    {
      "id": "claude-official",
      "name": "Claude Official",
      "baseUrl": "https://api.anthropic.com",
      "localPrefix": "/claude",
      "enabled": true
    },
    {
      "id": "claude-test",
      "name": "Claude Test",
      "baseUrl": "https://test.example.com",
      "localPrefix": "/claude",
      "enabled": false
    },
    {
      "id": "openai-official",
      "name": "OpenAI Official",
      "baseUrl": "https://api.openai.com",
      "localPrefix": "/codex",
      "enabled": true
    }
  ],
  "rules": [
    {
      "uuid": "rule-chinese",
      "name": "强制中文响应",
      "when": { "client": "claude", "field": "system" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }],
      "enabled": true
    },
    {
      "uuid": "rule-remove-limit",
      "name": "移除简洁限制",
      "when": { "client": "codex", "field": "instructions" },
      "ops": [{ "type": "delete", "regex": "be concise", "flags": "i" }],
      "enabled": true
    }
  ],
  "storage": { "maxHistory": 1000 },
  "debug": true
}
```

---

## 🔧 高级配置

### 使用路径映射

如果你的上游 API 路径结构与标准不同：

```json
{
  "suppliers": [
    {
      "id": "custom-proxy",
      "name": "Custom Proxy",
      "baseUrl": "https://proxy.example.com",
      "localPrefix": "/claude",
      "pathMappings": [
        {
          "from": "/v1/",
          "to": "/api/v1/",
          "type": "prefix"
        }
      ],
      "enabled": true
    }
  ]
}
```

访问 `/claude/v1/messages` 时，实际请求路径变为 `https://proxy.example.com/api/v1/messages`。

### 多供应商快速切换

配置多个相同 `localPrefix` 的供应商，通过 `enabled` 字段快速切换：

```json
{
  "suppliers": [
    {
      "id": "claude-prod",
      "name": "Claude Production",
      "baseUrl": "https://api.anthropic.com",
      "localPrefix": "/claude",
      "enabled": true
    },
    {
      "id": "claude-staging",
      "name": "Claude Staging",
      "baseUrl": "https://staging.example.com",
      "localPrefix": "/claude",
      "enabled": false
    },
    {
      "id": "claude-dev",
      "name": "Claude Development",
      "baseUrl": "https://dev.example.com",
      "localPrefix": "/claude",
      "enabled": false
    }
  ]
}
```

通过 Web UI 或修改配置文件中的 `enabled` 字段即可切换供应商。

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
