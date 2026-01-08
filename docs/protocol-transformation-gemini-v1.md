# PromptXY Claude → Gemini(v1beta) 协议转换调研与方案（可落地草案）

**文档版本**: v0.7（P0/P1 修正完成）
**创建日期**: 2026-01-07
**最后更新**: 2026-01-08
**作者**: Codex（基于项目现状与参考项目调研整理）
**目标读者**: PromptXY 后端/前端开发、维护者、reviewer
**状态**: 🟢 已完成 P0/P1 级别修正，可进入 OpenSpec 提案

**更新说明 (v0.3 → v0.4)**:
- **P0 修正**: 修正 functionResponse.id 字段描述，基于 GitHub issue #6974 实测验证
- **P0 补充**: 补全 FinishReason 映射表，新增 LANGUAGE/BLOCKLIST/PROHIBITED_CONTENT/SPII/UNEXPECTED_TOOL_CALL
- **P1 新增**: 新增 3.8 节：图片/文件处理（inlineData/fileData）转换
- **P1 新增**: 新增 3.9 节：并发工具调用处理
- **P1 新增**: 新增 3.10 节：count_tokens 端点转换设计
- **P1 优化**: 完善 active loop 判断逻辑
- **P2 优化**: 优化 system blocks 处理说明

**更新说明 (v0.4 → v0.5)**:
- **P0 修正（批判性 review 发现）**:
  - 补全 FinishReason 映射表，新增 IMAGE_PROHIBITED_CONTENT/NO_IMAGE
  - 新增 3.11 节：Code Execution Part 处理（executableCode/codeExecutionResult）
  - 新增 3.12 节：videoMetadata Part 处理（视频元数据过滤）
- **P1 新增**:
  - 新增 3.6.1 节：safetySettings 参数处理
  - 新增 5.2.3 节：状态机扩展 candidateIndex 处理
  - 新增 5.2.4 节：状态机扩展 finishReason 重复处理
  - 完善 5.3 节：SSE event 类型处理
- **P2 优化**:
  - 优化 active loop 判断逻辑，新增嵌套深度计算

**更新说明 (v0.5 → v0.6)【聚焦核心功能修正】**:
- **P0 修正（核心功能，必须实施前修正）**:
  - **重大修正**：第 3.7 节 active loop 判断逻辑与 gemini-cli 保持一致
    - 改用**转换后的 Gemini contents 格式**判断（而非 Claude 格式）
    - 参考gemini-cli实现：从后向前查找最后一个包含纯文本的user消息
    - 明确判断时机：在contents转换完成后调用
- **P1 修正（影响功能正确性）**:
  - 第 4.1 节：明确 usageMetadata 可能在多个 chunk 中出现，需累积处理
  - 第 3.9.3 节：增强并发 tool_results 顺序保证逻辑
- **P2 补充（完善边界情况）**:
  - 第 5.3 节：扩展 SSE 事件类型处理（heartbeat/cancel 等）
- **移除**:
  - safetySettings 详细讨论（用户反馈现阶段不必过多关注）

**更新说明 (v0.6 → v0.7)【批判性 review 后 P0/P1 修正】**:
- **P0 修正（关键遗漏，必须实施前修正）**:
  - **第 3.5.4 节**：明确工具调用 ID 生成规范
    - 格式要求：必须以 `toolu_` 开头（Claude Code 兼容）
    - 生成时机：在接收到第一个 functionCall chunk 时立即生成
    - 唯一性保证：使用 timestamp + index 确保唯一性
  - **第 5.2.1 节**：补充流式工具调用增量处理逻辑
    - 新增 `pendingToolCall` 状态用于处理分片到达的 functionCall.args
    - 提供完整的累积合并策略和完成判断逻辑
  - **第 3.6.2-3.6.3 节**：新增 cachedContent 和 toolConfig 参数处理
    - cachedContent：v1 忽略，v2 考虑映射 Claude cache_control
    - toolConfig：v1 使用默认 AUTO 模式，v2 考虑自定义配置
- **P1 修正（重要遗漏，强烈建议补充）**:
  - **第 3.2.4 节**：新增 Header 映射章节
    - 明确移除 Claude SDK 特定 Header（anthropic-*、x-stainless-*）
    - 保留通用 Header（user-agent、content-type）
    - 添加 Gemini 特定 Header（x-goog-api-key 作为备选）
  - **第 6.4 节**：统一错误响应格式
    - 非流式：明确 Claude 错误类型映射
    - 流式：修正为 Claude SSE 标准格式（event: error + event: done）
    - 提供完整的错误转换实现示例
  - **第 3.4 节**：补充 systemInstruction.role 处理
    - 明确使用 `role: "user"`（Gemini API 推荐）
    - 避免使用 `role: "model"`
  - **第 4.1 节**：新增 parts 合并逻辑
    - 合并相邻的纯 text parts 以提高效率
    - 参考 gemini-cli 的 consolidateParts 实现
    - 提供 isValidNonThoughtTextPart 检查函数
- **文档结构优化**:
  - 重新编号第 4 节子节（4.1 parts 合并、4.2 usageMetadata）
  - 完善所有新增章节的代码示例和 trace 记录

---

## 1. 背景与问题定义

### 1.1 背景

PromptXY 目前已支持 Claude Code（Anthropic Messages）入口的跨协议转换能力（例如 Claude → Codex/OpenAI Responses 的转换链路），但 **Claude → Gemini 上游**（标准 Gemini API v1beta）尚未实现完整协议转换，尤其是：

- **工具调用（tools / tool_use / tool_result）**
- **流式响应（SSE streaming）**

项目中存在 `/gemini` 本地入口（用于 Gemini 客户端透明代理），但本需求明确：

> 仅实现 **Claude Code（/claude）→ Gemini 上游（标准 Gemini API v1beta）**，不实现 OpenAI 与 Gemini 之间互转，也不要求 Gemini CLI 作为客户端接入 PromptXY。

### 1.2 目标（Goals）

1. 在 PromptXY 中新增 `anthropic -> gemini` 的协议转换（请求侧 + 响应侧）。
2. **必须支持**：
   - Claude Code 工具调用（tool_use/tool_result）在 Gemini 侧可正确运行
   - Claude Code `stream: true` 时能获得 **Anthropic SSE** 语义一致的流式响应（含工具调用流）
3. 保持 PromptXY 现有能力：
   - rules/adapters 的提示词修改仍然可用
   - 请求记录（history）仍能工作（敏感信息脱敏）
   - 路由与供应商配置仍可维护

### 1.3 非目标（Non-Goals）

- 不实现 `gemini <-> openai/codex` 双向互转
- 不扩展 `/gemini` 本地入口支持跨协议（仍可保持透明转发策略）
- 不做多供应商智能路由（Router/脚本路由等）
- 不实现 Gemini OAuth/账号调度（如 CRS 那样）；仅对接“标准 Gemini API v1beta + API key”模型

### 1.4 关键前提（Assumptions）

- **上游协议锚点已确认**：标准 Gemini API v1beta（API Key 模式）
  - 非流式：`POST /v1beta/models/{model}:generateContent`
  - 流式（SSE）：`POST /v1beta/models/{model}:streamGenerateContent?alt=sse`
    - 说明：标准 Gemini API 的流式输出通常通过 `alt=sse` 触发；否则可能返回非 SSE 形态或兼容性不稳定
  - 鉴权：优先 `?key=<API_KEY>`；可兼容 `x-goog-api-key: <API_KEY>`
  - 响应：`Content-Type: text/event-stream`（streaming）

---

## 2. PromptXY 现状与插入点

### 2.1 路由与约束

当前路由配置层已经声明 `anthropic->gemini` 组合可用（即 `/claude` 入口允许选择 `transformer=gemini` 的 route 并对接 `protocol=gemini` supplier），但转换引擎尚未实现 gemini 协议族。

相关代码位置（便于后续实现定位）：

- `/claude` 入口与路由限制：`backend/src/promptxy/gateway.ts`
- 路由组合矩阵与自动选择：`backend/src/promptxy/api-handlers.ts`
- transformer 引擎入口：`backend/src/promptxy/transformers/`
  - 现状仅完整实现 `claude-to-codex`：`backend/src/promptxy/transformers/engine/engine.ts`
  - SSE 转换目前仅对 codex 生效：`backend/src/promptxy/transformers/index.ts`

### 2.2 推荐插入点（保持现有网关结构）

建议维持现有网关处理顺序：

1. 命中 `/claude` route 与 supplier
2. 读取 JSON body（Claude Messages API）
3. 执行 rules/adapters（内容改写）
4. **执行协议转换（Claude → Gemini v1beta）**
5. 注入上游鉴权（x-goog-api-key 或 query key 等）
6. fetch 转发到上游
7. 响应侧：
   - 非流式：Gemini JSON → Claude JSON
   - 流式：Gemini SSE → Claude SSE（解析→转换→序列化）

### 2.3 Claude Code 兼容性：count_tokens 端点（建议纳入 v1）

Claude Code 生态中存在对 `POST /v1/messages/count_tokens` 的调用（用于长上下文决策、UI 提示、路由等）。若 PromptXY 不提供该端点，可能出现“能聊天但部分能力退化/路由失效”的隐性问题。

建议 v1 就明确支持与否，并给出可验收行为：

- **支持策略 A（推荐，最准）**：将 Claude `count_tokens` 请求转换为 Gemini `:countTokens` 调用（标准 Gemini API 支持 `countTokens`）
- **支持策略 B（可接受，近似）**：本地估算 token（与 Gemini 真实计费 token 会有偏差），但可用于路由阈值/提示

> 注：本文档后续章节主要聚焦 `/v1/messages`（生成/流式生成）主链路；`count_tokens` 作为补充端点在实现与测试章节会列入回归用例。

---

## 3. 协议差异与映射策略（请求侧）

本节只描述“最小可用且可维护”的映射规则；实现阶段应以真实客户端样例回归为准。

### 3.1 Claude Messages API（输入）关键字段

- `model: string`
- `system?: string | ClaudeSystemBlock[]`
- `messages: Array<{ role: 'user'|'assistant', content: string | ClaudeContentBlock[] }>`
- `tools?: Array<{ name, description?, input_schema }>`
- `stream?: boolean`
- `max_tokens?: number`
- 以及其它采样/控制字段（如 `temperature` / `top_p` / `stop_sequences` / `thinking` 等，若存在）

Claude 的解析与规范化能力已存在（system/messages/tools 归一化）：

- `backend/src/promptxy/transformers/protocols/claude/parse.ts`

### 3.2 Gemini v1beta（输出）建议目标形态

#### 3.2.1 非流式

`POST /v1beta/models/{model}:generateContent`

body（建议形态）：

```json
{
  "systemInstruction": { "parts": [{ "text": "..." }] },
  "contents": [
    { "role": "user", "parts": [{ "text": "..." }] },
    { "role": "model", "parts": [{ "text": "..." }] }
  ],
  "tools": [
    { "functionDeclarations": [{ "name": "...", "description": "...", "parameters": { } }] }
  ],
  "generationConfig": {
    "maxOutputTokens": 4096,
    "temperature": 0.7
  }
}
```

#### 3.2.2 流式

`POST /v1beta/models/{model}:streamGenerateContent`

body 与非流式一致，但响应为 SSE（`text/event-stream`）。

#### 3.2.3 URL 拼接与鉴权（可落地规范）

为避免不同 supplier 配置导致的 URL 双重拼接/漏参，建议在实现中采用以下规则（并将其作为可观测 trace 的一部分输出）：

- 供应商 `baseUrl` 允许两种形态（两者都要兼容）：
  1. **旧形态**：`https://generativelanguage.googleapis.com`（不包含 `/v1beta/models`）
  2. **新形态**：`https://generativelanguage.googleapis.com/v1beta/models`（已包含 `/v1beta/models`）
- 最终上游 URL：
  - 非流式：`{base}/v1beta/models/{model}:generateContent?key=<API_KEY>`
  - 流式：`{base}/v1beta/models/{model}:streamGenerateContent?key=<API_KEY>&alt=sse`
  - 若 baseUrl 已以 `/v1beta/models` 结尾，则 `{base}/` 后直接拼接 `/{model}:{action}`
- 鉴权优先级：
  1. query：`?key=<API_KEY>`（标准 Gemini API 最常见形式）
  2. header：`x-goog-api-key: <API_KEY>`（作为兼容保底）

> 备注：如果 supplier 未来支持 Vertex/OAuth（非本 v1 目标），其鉴权与 URL 规则应单独成章，不与 API Key 模式混用。

### 3.2.4 Header 映射（Claude → Gemini）

**问题背景**：Claude SDK 发送的请求包含特定的 Header，需要映射到 Gemini API 的格式。

> **代码参考来源**：`backend/src/promptxy/transformers/engine/engine.ts:308-336` 中的 `mapHeadersForCodex` 实现展示了 Header 映射的模式。

**Header 映射策略**：

1. **移除 Claude SDK 特定 Header**：
   - `anthropic-*` 前缀的所有 Header
   - `x-stainless-*` 前缀的所有 Header（Stainless SDK 特定）
   - `x-api-key`（Claude API 密钥）
   - `x-app`（应用标识）

2. **保留通用 Header**：
   - `user-agent`（可能需要重写为 PromptXY 标识）
   - `content-type`（确保为 `application/json`）

3. **添加 Gemini 特定 Header**（可选）：
   - `x-goog-api-key: <API_KEY>`（作为 query key 的备选方案）
   - `x-goog-request-params`（某些 Vertex AI 场景需要，v1 不涉及）

**实现建议**：

```typescript
/**
 * 映射请求头：Claude SDK → Gemini
 *
 * 移除 Claude SDK 特定的请求头（anthropic-*、x-stainless-* 等）
 * 保留通用的请求头（user-agent、content-type 等）
 * 添加 Gemini 特定的请求头（x-goog-api-key，作为备选）
 */
function mapHeadersForGemini(
  headers: Record<string, string>,
  apiKey?: string
): Record<string, string> {
  const mapped: Record<string, string> = {};

  // 需要移除的 Claude SDK 特定请求头前缀
  const removePrefixes = [
    'anthropic-',
    'x-stainless-',
    'x-api-key',
    'x-app',
  ];

  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase();

    // 移除 Claude SDK 特定的请求头
    const shouldRemove = removePrefixes.some(prefix =>
      keyLower.startsWith(prefix.toLowerCase())
    );

    if (shouldRemove) {
      continue;
    }

    // 保留其他请求头
    mapped[key] = value;
  }

  // 重写 user-agent（可选，便于追踪）
  if (mapped['user-agent']) {
    mapped['user-agent'] = `PromptXY/1.0 (Gemini Transformer) ${mapped['user-agent']}`;
  }

  // 确保 content-type 正确
  mapped['content-type'] = 'application/json';

  // 添加 Gemini API Key Header（作为 query key 的备选）
  if (apiKey) {
    mapped['x-goog-api-key'] = apiKey;
  }

  // 记录 trace
  audit.addInfo('header_mapping', {
    removed_count: Object.keys(headers).length - Object.keys(mapped).length + 1, // +1 for x-goog-api-key
    added_headers: ['x-goog-api-key'].filter(h => !!apiKey),
    preserved_headers: Object.keys(mapped),
  });

  return mapped;
}
```

**关键要点**：

- **优先使用 query key**：`?key=<API_KEY>` 是 Gemini API 的标准鉴权方式
- **Header 作为备选**：`x-goog-api-key` 仅作为兼容性备选方案
- **Trace 记录**：记录所有 Header 映射操作，便于调试

---

### 3.3 Model 映射（Claude → Gemini）

PromptXY 已有 Claude 档位映射字段 `claudeModelMap`（跨协议时必填 sonnet）。

建议规则：

1. 识别 Claude 请求 model 的“档位”（sonnet/haiku/opus）
2. 从 route.claudeModelMap 选择 gemini 模型名
3. 生成上游 path 中 `{model}`，例如：
   - `gemini-2.5-flash`
   - `gemini-2.5-pro`
   - `gemini-3-pro-preview`

注意：此处不引入“模型自动推断/模糊匹配”，保持可验证性。

### 3.4 system 字段映射

Claude `system`：
- string 或 text blocks

Gemini：
- `systemInstruction: { parts: [{ text }] }`

**问题背景**：Gemini API 的 `systemInstruction` 可能需要 `role` 字段。

> **代码参考来源**：Gemini API 官方文档显示：
> ```typescript
> {
>   "systemInstruction": {
>     "role": "user",  // 或 "model"
>     "parts": [{ "text": "..." }]
>   }
> }
> ```

**策略**：

1. 将 Claude system 规范化为纯文本（已支持）
2. 写入 Gemini systemInstruction.parts[0].text
3. **明确设置 role 字段**：
   - 默认使用 `role: "user"`（Gemini API 推荐值）
   - 不设置为 `"model"`（除非有特殊需求）

**实现建议**：

```typescript
function transformSystemInstruction(
  system: string | ClaudeSystemBlock[],
  audit: FieldAuditCollector
): { role: string; parts: Array<{ text: string }> } {
  // 规范化为纯文本
  const systemText = normalizeSystemToText(system);

  // 使用 "user" role（Gemini API 推荐）
  const systemInstruction = {
    role: 'user',
    parts: [{ text: systemText }],
  };

  audit.addInfo('system_instruction', {
    role: 'user',
    text_length: systemText.length,
    reason: 'Gemini API recommends role="user" for systemInstruction',
  });

  return systemInstruction;
}
```

**关键要点**：

- **始终使用 `role: "user"`**：这是 Gemini API 的推荐值
- **避免使用 `role: "model"`**：可能导致意外的行为
- **Trace 记录**：记录 role 设置便于调试

### 3.5 messages/content 映射（含工具调用）

#### 3.5.1 角色映射

- Claude `user` → Gemini `user`
- Claude `assistant` → Gemini `model`

#### 3.5.2 内容映射（text）

- Claude `content` 里的 `text` block → Gemini `{ text }` part
- 如果 Claude message content 为 string，等价为单个 text block

#### 3.5.3 工具定义映射（Claude tools → Gemini tools）

Claude tool：
- `name`
- `description`
- `input_schema`（JSON schema）

Gemini tool declaration：
- `functionDeclarations[].name`
- `functionDeclarations[].description`
- `functionDeclarations[].parameters`

策略：

- `input_schema` 直接映射到 `parameters`
- 对 schema 做 sanitize（避免上游不接受的字段），并在 trace 中记录被修改/移除的字段路径（便于追溯）

建议的 v1 sanitize 规则（以"能稳定注册工具"为目标）：

1. **白名单保留**：`type` / `properties` / `required` / `description` / `enum` / `items` / `additionalProperties` / `minimum` / `maximum` 等常规 JSON Schema 关键字
2. **format 限制**：对 `string.format` 做白名单过滤；不在白名单的 format 建议移除或降级为纯 string
   - 已知差异：Gemini 对 `format` 的支持范围可能比 OpenAI/Claude 更窄（例如部分实现仅接受 `date` / `date-time`）
3. **组合关键字处理**：`anyOf` / `oneOf` / `allOf` 若出现：
   - v1 建议：保守策略为"保留但在 trace 警告 + 允许上游失败可观测"；或"降级为第一分支"（需要明确写死规则）
4. **循环引用/超深嵌套**：检测并拒绝（返回可读错误），避免上游或本地序列化崩溃
5. **移除噪声字段**：如 `$schema`、过大的 `examples`、与上游不兼容的自定义扩展字段（具体按回归样例补齐）

**具体 sanitize 函数实现建议**：

> **代码参考来源**：基于 `refence/gemini-cli/packages/core/src/tools/tool-registry.ts:395-427` 的工具发现逻辑，以及 `refence/gemini-cli/packages/core/src/tools/tools.ts` 中的 `hasCycleInSchema` 实现。

```typescript
// JSON Schema Sanitize 实现
interface SanitizeResult {
  sanitized: any;
  warnings: string[];
  removed: string[];
}

const GEMINI_JSON_SCHEMA_WHITELIST = new Set([
  // 核心关键字
  'type', 'properties', 'required', 'description',
  // 字符串约束
  'minLength', 'maxLength', 'pattern', 'format',
  // 数值约束
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  // 数组约束
  'items', 'minItems', 'maxItems', 'uniqueItems',
  // 对象约束
  'additionalProperties', 'minProperties', 'maxProperties',
  // 枚举和常量
  'enum', 'const',
  // 组合（保留但警告）
  'anyOf', 'oneOf', 'allOf',
  // 其他
  'default', 'title', '$id',
]);

const GEMINI_FORMAT_WHITELIST = new Set([
  'date', 'date-time', 'time', 'email', 'uri', 'uuid',
  'hostname', 'ipv4', 'ipv6',
]);

function sanitizeJsonSchema(
  schema: any,
  path = '',
  audit: FieldAuditCollector
): SanitizeResult {
  const warnings: string[] = [];
  const removed: string[] = [];

  function sanitize(value: any, currentPath: string): any {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) =>
        sanitize(item, `${currentPath}[${index}]`)
      );
    }

    const result: any = {};
    for (const [key, val] of Object.entries(value)) {
      const fieldPath = currentPath ? `${currentPath}.${key}` : key;

      // 处理 format 字段
      if (key === 'format' && typeof val === 'string') {
        if (!GEMINI_FORMAT_WHITELIST.has(val)) {
          warnings.push(`Removed unsupported format: "${val}" at ${fieldPath}`);
          removed.push(fieldPath);
          continue;
        }
      }

      // 处理组合关键字
      if (key === 'anyOf' || key === 'oneOf' || key === 'allOf') {
        warnings.push(
          `Combining keyword "${key}" at ${fieldPath} may not be fully supported by Gemini. Keeping as-is.`
        );
      }

      // 白名单过滤
      if (!GEMINI_JSON_SCHEMA_WHITELIST.has(key)) {
        warnings.push(`Removed unsupported field "${key}" at ${fieldPath}`);
        removed.push(fieldPath);
        continue;
      }

      // 递归处理嵌套对象
      result[key] = sanitize(val, fieldPath);
    }

    return result;
  }

  const sanitized = sanitize(schema, path);

  // 记录到 audit
  if (warnings.length > 0) {
    audit.addWarning('schema_sanitize', warnings.join('; '));
  }
  if (removed.length > 0) {
    audit.setMetadata('schema_fields_removed', removed);
  }

  return { sanitized, warnings, removed };
}

// 循环引用检测
function detectCircularReference(
  schema: any,
  audit: FieldAuditCollector
): boolean {
  const seen = new Set<any>();

  function detect(value: any, path = ''): boolean {
    if (value === null || typeof value !== 'object') {
      return false;
    }

    if (seen.has(value)) {
      audit.addError('schema_circular_reference', `Circular reference detected at ${path}`);
      return true;
    }

    seen.add(value);

    for (const [key, val] of Object.entries(value)) {
      if (detect(val, path ? `${path}.${key}` : key)) {
        return true;
      }
    }

    seen.delete(value);
    return false;
  }

  return detect(schema);
}
```

**使用示例**：

```typescript
// 在工具注册阶段
for (const tool of claudeTools) {
  // 检测循环引用
  if (detectCircularReference(tool.input_schema, audit)) {
    throw new TransformError('schema_error', 'sanitize',
      `Tool ${tool.name} has circular reference in input_schema`);
  }

  // Sanitize schema
  const { sanitized, warnings, removed } = sanitizeJsonSchema(
    tool.input_schema,
    `tools.${tool.name}.input_schema`,
    audit
  );

  // 转换为 Gemini functionDeclaration
  geminiTools.push({
    name: tool.name,
    description: tool.description,
    parameters: sanitized,
  });
}
```

#### 3.5.4 工具调用与结果映射（Claude tool_use/tool_result ↔ Gemini functionCall/functionResponse）

目标：Claude Code 工具调用能在 Gemini 上游语义中"往返"。

建议最小规则：

- Claude `tool_use` block（assistant content 中）→ Gemini `functionCall` part
  - `id` → `functionCall.id`（**重要**：用于响应侧关联）
  - `name` → `functionCall.name`
  - `input` → `functionCall.args`
- Claude `tool_result` block（user content 中）→ Gemini `functionResponse` part
  - `tool_use_id` → `functionResponse.id`（直接映射，支持精确关联）
  - 推断的 `tool_name` → `functionResponse.name`
  - `content` → `functionResponse.response`（需要序列化）

**关键约束（标准 Gemini API + API Key 模式）**：

> **重要修正（基于 GitHub issue #6974 实测验证）**：
>
> **实测发现**：标准 Gemini API 存在协议不一致问题：
> - `functionCall` **可能不包含** `id` 字段（上游不保证）
> - `functionResponse` **支持** `id` 字段（客户端可以包含）
>
> **数据来源**：[GitHub Issue #6974](https://github.com/google-gemini/gemini-cli/issues/6974)
> ```json
> // 实际 Gemini API 返回示例（来自 issue #6974）：
> {
>   "parts": [{
>     "thoughtSignature": "CiIBVKhc7l5mzkoZSRQfFeCS44vjuGk3o7tGr=",
>     "functionCall": {
>       "name": "github.list_issues",
>       "args": { ... }
>       // 注意：没有 id 字段！
>     }
>   }],
>   "role": "model"
> }
>
> // 客户端响应示例：
> {
>   "role": "user",
>   "parts": [{
>     "functionResponse": {
>       "id": "github.list_issues-1755899286321-24a24f35db1c2",  // ← 客户端生成的 id
>       "name": "github.list_issues",
>       "response": { ... }
>     }
>   }]
> }
> ```
>
> **gemini-cli 的处理策略**（`local-executor.ts:710`）：
> ```typescript
> const callId = functionCall.id ?? `${promptId}-${index}`;
> // 当 functionCall.id 不存在时，生成合成 id
> ```
>
> **结论**：`functionResponse.id` 是**客户端控制**的字段，用于关联请求和响应，而非上游返回。

因此，工具调用关联策略更新为：

1. **请求侧（Claude → Gemini）**：
   - 当看到 Claude `tool_use` 时：
     - **必须**将 `tool_use.id` 映射到 `functionCall.id`（即使上游不返回，我们也发送）
     - 将 `tool_use.name` 映射到 `functionCall.name`
     - 将 `tool_use.input` 映射到 `functionCall.args`
   - 在内部维护 `tool_use_id -> { name, args }` 映射表（用于容错）

2. **响应侧（Gemini → Claude）**：
   - 当看到 Gemini `functionCall` 时：
     - 检查 `functionCall.id` 是否存在：
       - **存在**：直接使用该 id 作为 `tool_use_id`
       - **不存在**：生成新的 `tool_use_id`
     - **ID 生成规范**（重要）：
       ```typescript
       // 使用 Claude Code 兼容的格式
       function generateToolUseId(index: number): string {
         return `toolu_${Date.now()}_${index}`;
       }
       ```
       - **格式要求**：必须以 `toolu_` 开头（Claude Code 的期望格式）
       - **唯一性保证**：使用 timestamp + index 确保唯一性
       - **生成时机**：在接收到第一个 functionCall chunk 时立即生成
     - 记录 `tool_use_id -> { name, args }` 映射
   - 当看到 Claude `tool_result` 时：
     - **始终**将 `tool_result.tool_use_id` 映射到 `functionResponse.id`（客户端控制的字段）
     - 通过映射表反查对应的 `tool_name`
     - 若反查失败：trace 记录 warning，并尝试从 `tool_result.content` 推断 tool_name

3. **容错策略**：
   - 当 Gemini 返回的 `functionCall` 没有 `id` 时，在 trace 中记录 `function_call_id_missing`
   - 生成的合成 id 应包含可追溯信息（如 timestamp、index）

**tool_result.content 序列化策略**：

Claude `tool_result.content` 的结构比 Gemini `functionResponse.response` 更灵活，v1 必须约束输出形态：

- **成功情况**：`content` 为字符串 → `{ result: content }`
- **错误情况**：`content` 包含 `is_error: true` → `{ error: content, is_error: true }`
- **复杂对象**：`content` 为对象 → 直接映射为 `response` 对象

在 trace 中记录"序列化策略"。

### 3.6 生成参数映射（Claude → Gemini generationConfig）

为保证跨协议行为尽可能一致，v1 建议按下表映射（不支持的字段要明确忽略并记录 trace）：

| Claude 字段 | Gemini 字段 | v1 处理策略 |
| --- | --- | --- |
| `max_tokens` | `generationConfig.maxOutputTokens` | 直接映射；无值则不写入 |
| `temperature` | `generationConfig.temperature` | 直接映射；无值则不写入 |
| `top_p` | `generationConfig.topP` | 直接映射；无值则不写入 |
| `stop_sequences` | `generationConfig.stopSequences` | 直接映射；无值则不写入 |
| `thinking` | `generationConfig.thinkingConfig` | 若上游/模型支持则映射；否则忽略并 trace 警告 |

> 备注：Gemini `generationConfig` 还支持更多字段（topK、candidateCount 等）。Claude 请求侧若没有对应字段，v1 不应"凭空补默认值"，避免与 Claude 端行为产生不可解释漂移。

#### 3.6.1 safetySettings 参数处理

**问题背景**：Gemini API 支持 `safetySettings` 参数配置安全过滤级别，而 Claude 使用不同的安全机制。

**Gemini safetySettings 结构**：
```typescript
{
  "safetySettings": [
    {
      "category": "HARM_CATEGORY_HARASSMENT",
      "threshold": "BLOCK_NONE"  // 或 BLOCK_LOW/ABOVE, BLOCK_MEDIUM/ABOVE, BLOCK_ONLY_HIGH
    }
  ]
}
```

**v1 策略**：

1. **忽略** Claude 请求中的安全相关参数（Claude 不暴露细粒度安全设置）
2. **不添加** 默认的 `safetySettings` 到 Gemini 请求（使用上游默认值）
3. **记录** trace: `safety_settings: "default"`

**实现建议**：

```typescript
// 请求侧：不添加 safetySettings
function buildGeminiRequest(claudeRequest: ClaudeRequest): GeminiRequest {
  const geminiRequest: GeminiRequest = {
    contents: transformContents(claudeRequest.messages),
    generationConfig: transformGenerationConfig(claudeRequest),
    // 注意：不添加 safetySettings，使用上游默认值
  };

  audit.addInfo('safety_settings', {
    policy: 'default',  // 使用 Gemini 默认安全设置
    reason: 'Claude does not expose fine-grained safety settings',
  });

  return geminiRequest;
}
```

**v2 策略（未来考虑）**：

- 添加 PromptXY 级别的安全配置（通过环境变量或配置文件）
- 支持用户自定义 `safetySettings` 映射规则
- 实现跨协议的安全策略统一管理

---

### 3.6.2 cachedContent 参数处理

**问题背景**：Gemini API 支持 `cachedContent` 参数用于上下文缓存（Context Caching），可以显著降低长对话的 token 成本。

**Gemini cachedContent 结构**：
```typescript
{
  "cachedContent": {
    "name": "projects/my-project/locations/global/cachedContents/my-cache-123"
    // 或使用 cache ID
  }
}
```

**v1 策略（保守）**：

1. **忽略** Claude 请求中的缓存相关参数
2. **不添加** `cachedContent` 到 Gemini 请求
3. **记录** trace: `cached_content: "not_supported"`

**实现建议**：

```typescript
// 请求侧：不添加 cachedContent
function buildGeminiRequest(claudeRequest: ClaudeRequest): GeminiRequest {
  const geminiRequest: GeminiRequest = {
    contents: transformContents(claudeRequest.messages),
    generationConfig: transformGenerationConfig(claudeRequest),
    // 注意：不添加 cachedContent
  };

  audit.addInfo('cached_content', {
    policy: 'not_supported',
    reason: 'Claude cache_control cannot be directly mapped to Gemini cachedContent in v1',
  });

  return geminiRequest;
}
```

**v2 策略（未来考虑）**：

- 检测 Claude 的 `cache_control` blocks
- 实现 cache 管理逻辑（创建、存储、复用 Gemini cachedContent）
- 支持用户自定义缓存策略

### 3.6.3 toolConfig 参数处理

**问题背景**：Gemini API 支持 `toolConfig` 来配置工具调用行为，Claude 使用不同的机制。

**Gemini toolConfig 结构**：
```typescript
{
  "toolConfig": {
    "functionCallingConfig": {
      "mode": "AUTO" | "ANY" | "NONE",
      "allowedFunctionNames": ["tool1", "tool2"]  // 当 mode=ANY 时必需
    }
  }
}
```

> **代码参考来源**：`refence/gemini-cli/packages/core/src/core/geminiChat.ts:498` 使用了 `toolConfig`：
> ```typescript
> config.toolConfig = toolSelectionResult.toolConfig;
> ```

**v1 策略**：

1. **忽略** Claude 请求中的工具配置参数
2. **不添加** `toolConfig` 到 Gemini 请求（使用上游默认 `AUTO` 模式）
3. **记录** trace: `tool_config: "default_auto"`

**实现建议**：

```typescript
// 请求侧：不添加 toolConfig
function buildGeminiRequest(claudeRequest: ClaudeRequest): GeminiRequest {
  const geminiRequest: GeminiRequest = {
    contents: transformContents(claudeRequest.messages),
    tools: transformTools(claudeRequest.tools),
    // 注意：不添加 toolConfig，使用 Gemini 默认 AUTO 模式
  };

  audit.addInfo('tool_config', {
    policy: 'default_auto',
    mode: 'AUTO',
    reason: 'Claude does not expose fine-grained tool selection configuration',
  });

  return geminiRequest;
}
```

**v2 策略（未来考虑）**：

- 添加 PromptXY 级别的工具选择配置
- 支持用户自定义 `toolConfig` 映射规则
- 实现跨协议的工具选择策略统一管理

---

### 3.7 thought/thoughtSignature 特殊处理

**问题背景**：Gemini API 支持 `thought`（思考过程）和 `thoughtSignature`（思考签名）功能，这在某些模型（如 Gemini 2.5 Preview）中是必需的。

> **代码参考来源**：`refence/gemini-cli/packages/core/src/core/geminiChat.ts:619-665`

```typescript
// gemini-cli 中的 thoughtSignature 处理逻辑
ensureActiveLoopHasThoughtSignatures(requestContents: Content[]): Content[] {
  // ...在 active loop 中每个 model 消息的第一个 functionCall
  // 必须添加 thoughtSignature 属性
  newParts[j] = {
    ...part,
    thoughtSignature: SYNTHETIC_THOUGHT_SIGNATURE,
  };
}
```

**Claude → Gemini 转换策略**：

1. **过滤 thought parts**：
   - 移除 Gemini 响应中的 `thought` parts（Claude 不支持）
   - 在 trace 中记录 "thought_parts_filtered: count"

2. **为 tool call 添加 thoughtSignature**：
   - 在 active loop（连续工具调用场景）中，为每个 `functionCall` 添加合成 `thoughtSignature`
   - 使用固定值如 `"skip_thought_signature_validator"`（参考 gemini-cli 的 `SYNTHETIC_THOUGHT_SIGNATURE`）
   - 非活跃 loop 或首次请求不需要添加

**Gemini → Claude 转换策略**：

1. **过滤 thought parts**：
   - 在响应转换时，移除所有包含 `thought` 字段的 parts
   - 仅保留 `text`、`functionCall`、`functionResponse`、`inlineData`、`fileData` 等标准 parts
   - 在 trace 中记录 `thought_parts_filtered: count`

2. **处理 thoughtSignature**：
   - `thoughtSignature` 是 Gemini 内部使用的元数据，不应传递给 Claude
   - 在转换时直接丢弃该字段

**active loop 判断逻辑（与 gemini-cli 保持一致）**：

> **重要说明**：active loop 是指"连续工具调用"场景，即模型在前一轮返回了工具调用，客户端发送工具结果后，模型再次返回工具调用（而非最终回答）。
>
> **关键修正（v0.6）**：判断逻辑必须使用**转换后的 Gemini contents 格式**，而非 Claude 格式。这是因为 gemini-cli 的实现是基于转换后的 contents 来判断的。

**参考 gemini-cli 实现**（`geminiChat.ts:621-635`）：

```typescript
// gemini-cli 的实际逻辑：
ensureActiveLoopHasThoughtSignatures(requestContents: Content[]): Content[] {
  // 从后向前查找最后一个包含纯文本的 user 消息
  let activeLoopStartIndex = -1;
  for (let i = requestContents.length - 1; i >= 0; i--) {
    const content = requestContents[i];
    if (content.role === 'user' && content.parts?.some((part) => part.text)) {
      activeLoopStartIndex = i;
      break;
    }
  }

  if (activeLoopStartIndex === -1) {
    return requestContents;
  }
  // 在 activeLoopStartIndex 之后的 model 消息中添加 thoughtSignature
  // ...
}
```

**PromptXY 转换器实现**（在 contents 转换完成后判断）：

```typescript
// 使用转换后的 Gemini contents 格式判断
function isActiveLoop(contents: Content[]): boolean {
  // 核心逻辑：从后向前找最后一个"包含纯文本（非 functionResponse）"的 user 消息
  let lastTextUserIndex = -1;
  for (let i = contents.length - 1; i >= 0; i--) {
    const content = contents[i];
    if (content.role === 'user' &&
        content.parts?.some((part) => part.text && !part.functionResponse)) {
      lastTextUserIndex = i;
      break;
    }
  }

  // 如果找不到纯文本 user 消息，不视为 active loop
  if (lastTextUserIndex === -1) {
    return false;
  }

  // 检查在最后文本用户消息之后是否有 model 消息包含 functionCall
  for (let i = lastTextUserIndex + 1; i < contents.length; i++) {
    const content = contents[i];
    if (content.role === 'model' &&
        content.parts?.some((part) => part.functionCall)) {
      return true; // 处于 active loop
    }
  }

  return false;
}

// 为 active loop 中的 functionCall 添加 thoughtSignature
function enhanceFunctionCallWithSignature(
  part: FunctionCallPart,
  isActiveLoop: boolean
): FunctionCallPart {
  if (!isActiveLoop) return part;
  return {
    ...part,
    thoughtSignature: 'skip_thought_signature_validator',
  };
}
```

**关键要点**：
- **在 contents 转换完成后**再判断 active loop（而非在转换前用 Claude 格式判断）
- 查找最后一个"包含纯文本（非 functionResponse）"的 user 消息作为起点
- 如果在该点之后有 model 消息包含 functionCall，则是 active loop
- 仅在 active loop 中为第一个 functionCall 添加 thoughtSignature

**与 gemini-cli 的差异说明**：
- gemini-cli 在请求发送前判断，PromptXY 在协议转换后判断
- 两者核心逻辑一致：都是基于转换后的 Gemini contents 格式
- PromptXY 需要在 `contents` 转换完成后调用此判断

**关键要点**：
- **首次请求**（无历史）：不需要添加 `thoughtSignature`
- **工具调用后获得最终回答**：不需要添加 `thoughtSignature`（因为这是 loop 的结束）
- **连续工具调用**：需要添加 `thoughtSignature`（让模型知道这是一个连续的 loop）

**实现建议**：

> **代码参考来源**：参考 `refence/gemini-cli/packages/core/src/core/geminiChat.ts:619-665` 的 `ensureActiveLoopHasThoughtSignatures` 实现，以及 `refence/gemini-cli/packages/core/src/utils/partUtils.ts:72-90` 的 `partToString` 函数中对 thought 字段的处理逻辑。

```typescript
// PromptXY 转换器中的实现建议
// 响应侧：过滤 thought parts
function filterThoughtParts(parts: Part[]): Part[] {
  return parts.filter(part => !part.thought);
}
```

---

### 3.8 图片/文件处理（inlineData/fileData）

Claude Code 支持图片和文件作为消息内容，需要转换为 Gemini 的 `inlineData` 或 `fileData` parts。

#### 3.8.1 Claude image block → Gemini inlineData

**Claude 输入格式**：
```json
{
  "type": "image",
  "source": {
    "type": "base64",
    "media_type": "image/png",
    "data": "iVBORw0KGgoAAAANSUhEUg..."
  }
}
```

**Gemini 转换**：
```json
{
  "inlineData": {
    "mimeType": "image/png",
    "data": "iVBORw0KGgoAAAANSUhEUg..."
  }
}
```

**转换规则**：
1. `media_type` → `mimeType`（直接映射）
2. `data` → `data`（直接映射）
3. 支持的 MIME 类型：
   - 图片：`image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/heic`, `image/heif`
   - 音频：`audio/wav`, `audio/mp3`, `audio/aiff`, `audio/aac`, `audio/ogg`, `audio/flac`
   - 视频：`video/mp4`, `video/webm`, `video/mpeg`, `video/mov`, `video/avi`

**文件大小限制**：
- Gemini API 对单个 `inlineData` 有大小限制（通常 20MB）
- 超过限制时应返回错误并建议使用 `fileData`（需先上传到 Gemini File API）

#### 3.8.2 Gemini inlineData → Claude image block

**Gemini 响应**：
```json
{
  "inlineData": {
    "mimeType": "image/png",
    "data": "iVBORw0KGgoAAAANSUhEUg..."
  }
}
```

**Claude 转换**：
```json
{
  "type": "image",
  "source": {
    "type": "base64",
    "media_type": "image/png",
    "data": "iVBORw0KGgoAAAANSUhEUg..."
  }
}
```

#### 3.8.3 fileData 处理（v1 可选）

对于大文件，Gemini 支持 `fileData` 引用已上传的文件：

```json
{
  "fileData": {
    "mimeType": "application/pdf",
    "fileUri": "gs://bucket/file.pdf"
  }
}
```

**v1 策略**：
- **不支持**自动上传到 Gemini File API（需要额外的 API 调用和鉴权）
- 当检测到超过限制的文件时，返回可读错误建议客户端使用较小的文件
- 若上游返回 `fileData`，转换为 Claude 的 `document` block（如果 Claude 支持）或 text 提示

**实现建议**：

```typescript
// 图片转换函数
function transformImageBlock(clauseImage: ImageBlock): InlineDataPart {
  const mimeType = clauseImage.source.media_type;
  const data = clauseImage.source.data;

  // 验证 MIME 类型
  const SUPPORTED_MIME_TYPES = new Set([
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'image/heic', 'image/heif', 'audio/wav', 'audio/mp3',
    'video/mp4', 'video/webm',
  ]);

  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    audit.addWarning('unsupported_mime_type',
      `MIME type ${mimeType} may not be supported by Gemini`);
  }

  // 检查文件大小（base64 解码后）
  const sizeBytes = (data.length * 3) / 4;
  const MAX_SIZE = 20 * 1024 * 1024; // 20MB
  if (sizeBytes > MAX_SIZE) {
    throw new TransformError('file_too_large',
      `File size (${sizeBytes} bytes) exceeds Gemini limit (${MAX_SIZE} bytes)`);
  }

  return { inlineData: { mimeType, data } };
}

// Gemini → Claude 图片转换
function transformInlineDataToClaude(part: InlineDataPart): ImageBlock {
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: part.inlineData.mimeType,
      data: part.inlineData.data,
    },
  };
}
```

---

### 3.9 并发工具调用处理

Claude 支持单个消息中包含多个 `tool_use` blocks（并发调用），需要正确转换为 Gemini 的多个 `functionCall` parts。

#### 3.9.1 请求侧：Claude 并发 tool_use → Gemini

**Claude 输入**（并发工具调用）：
```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "call_1",
      "name": "get_weather",
      "input": { "location": "London" }
    },
    {
      "type": "tool_use",
      "id": "call_2",
      "name": "get_time",
      "input": { "timezone": "UTC" }
    }
  ]
}
```

**Gemini 转换**：
```json
{
  "role": "model",
  "parts": [
    {
      "functionCall": {
        "id": "call_1",
        "name": "get_weather",
        "args": { "location": "London" }
      }
    },
    {
      "functionCall": {
        "id": "call_2",
        "name": "get_time",
        "args": { "timezone": "UTC" }
      }
    }
  ]
}
```

**关键点**：
- 每个 `tool_use` 转换为独立的 `functionCall` part
- **必须保留原始 id** 用于后续响应关联
- 按 tools 在数组中的顺序生成 parts

#### 3.9.2 响应侧：Gemini 并发 functionCall → Claude

**Gemini 响应**：
```json
{
  "candidates": [{
    "content": {
      "parts": [
        { "functionCall": { "name": "get_weather", "args": {...} } },
        { "functionCall": { "name": "get_time", "args": {...} } }
      ]
    }
  }]
}
```

**Claude 转换**（流式 SSE）：
```
event: content_block_start
data: {"type":"tool_use","index":0,"id":"toolu_xxx","name":"get_weather","input":{}}

event: content_block_delta
data: {"index":0,"delta":{"type":"input_json_delta","partial_json":"{\"location\":\"London\"}"}}

event: content_block_stop
data: {"index":0}

event: content_block_start
data: {"type":"tool_use","index":1,"id":"toolu_yyy","name":"get_time","input":{}}

event: content_block_delta
data: {"index":1,"delta":{"type":"input_json_delta","partial_json":"{\"timezone\":\"UTC\"}"}}

event: content_block_stop
data: {"index":1}
```

**关键点**：
- 每个 `functionCall` 获得独立的 `index`
- 为每个调用生成唯一的 `tool_use_id`（如果上游没有 id）
- 按 parts 数组顺序输出

#### 3.9.3 并发工具结果关联（顺序保证）

当有多个并发工具调用时，Claude 会按顺序返回 `tool_result`。虽然极少见，但不能假设 Claude Code 总是按原始顺序返回。

**Claude 输入**：
```json
{
  "role": "user",
  "content": [
    { "type": "tool_result", "tool_use_id": "call_1", "content": "..." },
    { "type": "tool_result", "tool_use_id": "call_2", "content": "..." }
  ]
}
```

**Gemini 转换（保持原始顺序）**：
```json
{
  "role": "user",
  "parts": [
    {
      "functionResponse": {
        "id": "call_1",
        "name": "get_weather",
        "response": { "result": "..." }
      }
    },
    {
      "functionResponse": {
        "id": "call_2",
        "name": "get_time",
        "response": { "result": "..." }
      }
    }
  ]
}
```

**关键点**：
- **按原始 tool_use 顺序**保持 `functionResponse` parts
- 使用 `tool_use_id` → `functionResponse.id`
- 通过映射表获取 `name`（容错）
- **处理潜在乱序**：即使 Claude 返回乱序，也要保证 Gemini 侧的顺序与原始 tool_use 一致

**实现建议（v0.6 增强顺序保证）**：

```typescript
// 并发工具调用转换
function transformConcurrentToolUses(
  toolUses: ToolUseBlock[],
  audit: FieldAuditCollector
): FunctionCallPart[] {
  const parts: FunctionCallPart[] = [];
  const idMap = new Map<string, ToolUseCall>();

  for (let i = 0; i < toolUses.length; i++) {
    const toolUse = toolUses[i];
    const part: FunctionCallPart = {
      functionCall: {
        id: toolUse.id,
        name: toolUse.name,
        args: toolUse.input,
      },
    };

    parts.push(part);
    idMap.set(toolUse.id, toolUse);

    audit.addInfo('tool_call_transform', {
      index: i,
      id: toolUse.id,
      name: toolUse.name,
    });
  }

  // 存储映射供响应侧使用
  audit.setMetadata('tool_use_id_map', idMap);

  return parts;
}

// 并发工具结果转换
function transformConcurrentToolResults(
  toolResults: ToolResultBlock[],
  idMap: Map<string, ToolUseCall>,
  audit: FieldAuditCollector
): FunctionResponsePart[] {
  const parts: FunctionResponsePart[] = [];

  for (const toolResult of toolResults) {
    const toolUse = idMap.get(toolResult.tool_use_id);

    if (!toolUse) {
      audit.addWarning('tool_result_orphan', {
        tool_use_id: toolResult.tool_use_id,
        message: 'No matching tool_use found',
      });
      // 尝试从 content 推断 name
      continue;
    }

    parts.push({
      functionResponse: {
        id: toolResult.tool_use_id,
        name: toolUse.name,
        response: serializeToolResultContent(toolResult.content),
      },
    });
  }

  return parts;
}
```

---

### 3.11 Code Execution Part 处理（可执行代码）

**问题背景**：Gemini 2.5+ 模型支持原生代码执行能力，会返回 `executableCode` 和 `codeExecutionResult` part 类型。这是 Claude 不直接支持的特性。

> **代码参考来源**：`refence/gemini-cli/packages/core/src/utils/partUtils.ts:36-52` 和 `refence/gemini-cli/packages/core/src/telemetry/semantic.ts:164-168`

#### 3.11.1 Gemini Code Execution 结构

**executableCode part**：
```typescript
{
  "executableCode": {
    "language": "python",  // 或其他支持的语言
    "code": "print('Hello, World!')"
  }
}
```

**codeExecutionResult part**：
```typescript
{
  "codeExecutionResult": {
    "outcome": "OUTCOME_OK",  // OUTCOME_OK | OUTCOME_FAILED | OUTCOME_DEADLINE_EXCEEDED
    "output": "Hello, World!\n"
  }
}
```

#### 3.11.2 Gemini → Claude 转换策略

**v1 策略（文本化处理）**：

1. **executableCode → 文本代码块**：
   - 将可执行代码转换为 markdown 代码块格式
   - 保留语言标识符
   - 添加执行提示

2. **codeExecutionResult → 文本结果**：
   - 将执行结果转换为格式化的文本输出
   - 根据输出类型（成功/失败）采用不同格式

**实现建议**：

```typescript
// executableCode 转换
function transformExecutableCode(part: ExecutableCodePart): TextBlock {
  const { language, code } = part.executableCode;

  return {
    type: 'text',
    text: `**Running ${language} code**:\n\`\`\`${language}\n${code}\n\`\`\`\n*Executing...*\n`,
  };
}

// codeExecutionResult 转换
function transformCodeExecutionResult(part: CodeExecutionResultPart): TextBlock {
  const { outcome, output } = part.codeExecutionResult;

  if (outcome === 'OUTCOME_OK') {
    return {
      type: 'text',
      text: `**Code Execution Result**:\n\`\`\`\n${output || '(no output)'}\n\`\`\``,
    };
  } else if (outcome === 'OUTCOME_FAILED') {
    return {
      type: 'text',
      text: `**Code Execution Failed**\n\`\`\`\n${output || 'Execution failed'}\n\`\`\``,
    };
  } else {
    return {
      type: 'text',
      text: `**Code Execution Timeout**\nExecution exceeded time limit.`,
    };
  }
}
```

**v2 策略（未来考虑）**：

- 将 `executableCode` 映射到 Claude 的代码执行工具调用（如果 Claude Code 添加原生支持）
- 提供配置选项让用户选择处理方式（文本化 vs 工具调用 vs 忽略）

#### 3.11.3 Claude → Gemini 转换策略

**v1 策略**：

- Claude 不直接支持代码执行，通常通过工具调用实现（如 `python_execute` 工具）
- **不转换**常规代码块为 `executableCode`
- 仅当检测到特定的代码执行工具调用时，考虑映射

**未来策略**：

```typescript
// 假设 Claude 有代码执行工具
{
  "type": "tool_use",
  "name": "execute_code",
  "input": {
    "language": "python",
    "code": "print('Hello')"
  }
}

// 转换为 Gemini executableCode
{
  "executableCode": {
    "language": "python",
    "code": "print('Hello')"
  }
}
```

#### 3.11.4 trace 记录

在 trace 中记录 code execution 相关事件：

```typescript
audit.addInfo('code_execution_part', {
  type: 'executableCode' | 'codeExecutionResult',
  language: part.executableCode?.language,
  outcome: part.codeExecutionResult?.outcome,
  transformed_to: 'text_block',  // 或 'tool_call'（v2）
});
```

---

### 3.12 videoMetadata Part 处理

**问题背景**：Gemini API 支持 `videoMetadata` part 类型，用于处理视频内容的元数据。

> **代码参考来源**：`refence/gemini-cli/packages/core/src/utils/partUtils.ts:34-42`

#### 3.12.1 Gemini videoMetadata 结构

```typescript
{
  "videoMetadata": {
    "start_offset": { "seconds": 0, "nanos": 0 },
    "end_offset": { "seconds": 10, "nanos": 0 }
  }
}
```

#### 3.12.2 转换策略

**v1 策略（过滤 + 警告）**：

1. **过滤** `videoMetadata` parts（Claude 不支持视频元数据）
2. 在 trace 中记录 `video_metadata_filtered: true`
3. 若 `inlineData` 包含视频 MIME 类型，允许传递但添加 warning

**实现建议**：

```typescript
// 响应侧：过滤 videoMetadata parts
function filterVideoMetadataParts(parts: Part[]): Part[] {
  const filtered = parts.filter(part => !part.videoMetadata);
  const removedCount = parts.length - filtered.length;

  if (removedCount > 0) {
    audit.addWarning('video_metadata_filtered', {
      count: removedCount,
      message: 'Claude does not support video metadata, these parts were filtered',
    });
  }

  return filtered;
}

// 请求侧：检测视频 MIME 类型
function validateVideoMimeType(mimeType: string): boolean {
  const VIDEO_MIME_TYPES = new Set([
    'video/mp4', 'video/webm', 'video/mpeg', 'video/mov', 'video/avi',
  ]);

  if (VIDEO_MIME_TYPES.has(mimeType)) {
    audit.addWarning('video_mime_type', {
      mime_type: mimeType,
      message: 'Video support may be limited in Claude, metadata will be filtered',
    });
    return true;
  }

  return false;
}
```

---

### 3.13 count_tokens 端点转换

Claude Code 使用 `/v1/messages/count_tokens` 来估算 token 消耗，需要转换为 Gemini 的 `:countTokens` 端点。

#### 3.13.1 端点映射

| Claude | Gemini | 方法 |
|--------|--------|------|
| `POST /v1/messages/count_tokens` | `POST /v1beta/models/{model}:countTokens?key={api_key}` | POST |

#### 3.13.2 请求转换

**Claude 请求**：
```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "tools": [
    {
      "name": "get_weather",
      "description": "Get weather",
      "input_schema": {
        "type": "object",
        "properties": { "location": { "type": "string" } }
      }
    }
  ]
}
```

**Gemini 转换**：
```json
{
  "contents": [
    { "role": "user", "parts": [{ "text": "Hello" }] }
  ],
  "tools": [
    {
      "functionDeclarations": [
        {
          "name": "get_weather",
          "description": "Get weather",
          "parameters": {
            "type": "object",
            "properties": { "location": { "type": "string" } }
          }
        }
      ]
    }
  ]
}
```

**转换规则**：
1. `model` → 从 path 中提取 `{model}`（不包含在请求体中）
2. `messages[]` → `contents[]`（应用常规消息转换）
3. `tools[]` → `tools[].functionDeclarations[]`（应用工具定义转换）
4. **忽略** `system`（Gemini countTokens 不支持 systemInstruction）
5. **忽略** `max_tokens`, `temperature` 等生成参数

#### 3.13.3 响应转换

**Gemini 响应**：
```json
{
  "totalTokens": 42
}
```

**Claude 转换**：
```json
{
  "input_tokens": 42
}
```

**关键差异**：
- Gemini 只返回 `totalTokens`（输入 + 工具定义）
- Claude 期望 `input_tokens`（仅输入）
- **映射策略**：`input_tokens = totalTokens`（近似值）

**实现建议**：

```typescript
// countTokens 转换函数
export async function transformCountTokensRequest(
  claudeRequest: ClaudeCountTokensRequest,
  geminiModel: string,
  audit: FieldAuditCollector
): Promise<{ url: string; body: GeminiCountTokensRequest }> {
  // 转换 messages → contents
  const contents = claudeRequest.messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: transformContentToParts(msg.content),
  }));

  // 转换 tools（如果有）
  let tools;
  if (claudeRequest.tools && claudeRequest.tools.length > 0) {
    tools = [{
      functionDeclarations: claudeRequest.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: sanitizeJsonSchema(tool.input_schema, audit),
      })),
    }];
  }

  audit.addInfo('count_tokens_transform', {
    messages_count: claudeRequest.messages.length,
    tools_count: claudeRequest.tools?.length ?? 0,
  });

  return {
    url: `/v1beta/models/${geminiModel}:countTokens`,
    body: { contents, tools },
  };
}

// countTokens 响应转换
export function transformCountTokensResponse(
  geminiResponse: GeminiCountTokensResponse,
  audit: FieldAuditCollector
): ClaudeCountTokensResponse {
  const input_tokens = geminiResponse.totalTokens;

  audit.addInfo('count_tokens_result', {
    total_tokens: geminiResponse.totalTokens,
    input_tokens,
  });

  return { input_tokens };
}
```

#### 3.13.4 错误处理

当 Gemini `:countTokens` 失败时：

**策略 A（推荐）**：返回本地估算值
- 使用简单的 token 估算算法（如 cl100k_base 分词器）
- 在 trace 中记录 `count_tokens_fallback`

**策略 B（可接受）**：返回错误
- 返回 Claude 兼容的错误格式
- 让客户端降级处理

```typescript
// Fallback 实现
function estimateTokens(text: string): number {
  // 简单估算：~4 字符/token（英文）或 ~2 字符/token（中文）
  const nonAsciiChars = (text.match(/[^\x00-\x7F]/g) || []).length;
  const asciiChars = text.length - nonAsciiChars;
  return Math.ceil(asciiChars / 4 + nonAsciiChars / 2);
}
```

---

## 4. 响应侧映射（非流式）

当 Claude 请求 `stream=false` 时，上游 Gemini 返回 JSON（简化描述）：

- `candidates[0].content.parts[]`
- `usageMetadata`（可能存在）

映射策略：

1. 将 `parts[].text` 拼接为 Claude `content` 的 text block
2. 若 parts 中出现 `functionCall`，转换为 Claude `tool_use` content block
3. **合并相邻的 text parts**（重要，见下文）
4. 生成 Claude Messages API 响应结构（message + usage）

注意：此处"让 Claude Code 能继续下一步工具执行"很重要；如果非流式返回 functionCall，也必须转换成 Claude tool_use，否则 Claude Code 无法触发本地工具。

### 4.1 Parts 合并逻辑（重要）

**问题背景**：Gemini API 可能返回多个相邻的 text parts，需要合并以提高效率和兼容性。

> **代码参考来源**：`refence/gemini-cli/packages/core/src/core/geminiChat.ts:758-770` 有明确的文本合并逻辑：
> ```typescript
> const consolidatedParts: Part[] = [];
> for (const part of modelResponseParts) {
>   const lastPart = consolidatedParts[consolidatedParts.length - 1];
>   if (lastPart?.text && isValidNonThoughtTextPart(lastPart) &&
>       isValidNonThoughtTextPart(part)) {
>     lastPart.text += part.text;  // 合并相邻文本
>   } else {
>     consolidatedParts.push(part);
>   }
> }
> ```

**合并策略**：

1. **合并条件**：
   - 两个相邻的 parts 都是纯 text parts（不含 thought、functionCall 等）
   - 使用 `isValidNonThoughtTextPart()` 检查

2. **不合并的情况**：
   - part 包含 `thought` 字段
   - part 包含 `functionCall` 或 `functionResponse`
   - part 包含 `inlineData` 或 `fileData`

**实现建议**：

```typescript
/**
 * 合并相邻的 text parts
 *
 * @参考 gemini-cli geminiChat.ts:758-770
 */
function consolidateParts(parts: Part[]): Part[] {
  const consolidatedParts: Part[] = [];

  for (const part of parts) {
    const lastPart = consolidatedParts[consolidatedParts.length - 1];

    // 检查是否是纯 text part（不含 thought、functionCall 等）
    const isCurrentTextPart = isValidNonThoughtTextPart(part);
    const isLastTextPart = lastPart && isValidNonThoughtTextPart(lastPart);

    if (isLastTextPart && isCurrentTextPart) {
      // 合并相邻的文本 parts
      lastPart.text = (lastPart.text || '') + (part.text || '');
    } else {
      // 不合并，直接添加
      consolidatedParts.push(part);
    }
  }

  return consolidatedParts;
}

/**
 * 检查是否是纯 text part（不含 thought、functionCall 等）
 *
 * @参考 gemini-cli geminiChat.ts:101-112
 */
function isValidNonThoughtTextPart(part: Part): boolean {
  return !!(
    typeof part.text === 'string' &&
    !part.thought &&
    !part.functionCall &&
    !part.functionResponse &&
    !part.inlineData &&
    !part.fileData
  );
}
```

**使用示例**：

```typescript
// 在响应转换中
const geminiParts = response.candidates[0].content.parts;
const consolidatedParts = consolidateParts(geminiParts);

// 将合并后的 parts 转换为 Claude 格式
const claudeContent = consolidateParts.map(part => {
  if (part.text) {
    return { type: 'text', text: part.text };
  }
  // ... 处理其他 part 类型
});
```

**关键要点**：

- **提高效率**：减少不必要的 text block 数量
- **保持兼容性**：确保合并后的文本与原始文本完全一致
- **过滤 thought parts**：thought parts 不应该传递给 Claude
- **Trace 记录**：记录合并操作的统计信息（合并数量、原始/最终 parts 数量）

### 4.2 usageMetadata 映射

Gemini API 返回的 `usageMetadata` 包含 token 计费信息，需要映射到 Claude 的 `usage` 结构。

> **代码参考来源**：`refence/gemini-cli/packages/core/src/core/geminiChat.ts:734-740`

```typescript
// gemini-cli 中的 usageMetadata 处理逻辑
if (chunk.usageMetadata) {
  this.chatRecordingService.recordMessageTokens(chunk.usageMetadata);
  if (chunk.usageMetadata.promptTokenCount !== undefined) {
    this.lastPromptTokenCount = chunk.usageMetadata.promptTokenCount;
  }
}
```

**Gemini usageMetadata 字段**（参考 @google/genai 类型定义）：

```typescript
interface UsageMetadata {
  promptTokenCount?: number;      // 输入 token 数
  candidatesTokenCount?: number;   // 输出 token 数（单候选）
  totalTokenCount?: number;        // 总 token 数
  cachedContentTokenCount?: number; // 缓存内容 token 数
}
```

**映射到 Claude Messages API**：

```typescript
// Gemini → Claude
{
  usage: {
    input_tokens: usageMetadata.promptTokenCount ?? 0,
    output_tokens: usageMetadata.candidatesTokenCount ?? 0,
    // Claude 不支持 totalTokenCount 和 cachedContentTokenCount
    // 这些信息可以记录在 trace 中
  }
}
```

**流式响应中的 usage 处理（重要修正 v0.6）**：

> **重要发现**：根据 gemini-cli 代码验证（`geminiChat.ts:746-749`），`usageMetadata` **可能出现在多个 chunk 中**，不一定只在最后一个。

**修订策略**：

1. **累积 usage 信息**：在状态机中累积所有出现的 `usageMetadata`
2. **在 message_delta 事件中输出**：当流即将结束时，发送 `message_delta` 事件并附带**累积的** `usage` 字段
3. **容错处理**：若流结束时未收到 `usageMetadata`，在 trace 中记录 "usage_metadata_missing" 并使用估算值或 0

**实现建议**：

> **代码参考来源**：基于 `refence/gemini-cli/packages/core/src/core/geminiChat.ts:699-817` 的 `processStreamResponse` 方法中的 usage 处理逻辑，以及 `refence/claude-code-router/src/utils/SSESerializer.transform.ts` 的 Claude SSE 事件序列化模式。

```typescript
// PromptXY 转换器中的实现建议
// 在 SSE 转换状态机中
interface StreamState {
  // ...其他状态
  usageMetadata?: UsageMetadata;
}

function handleUsageMetadata(
  chunk: GenerateContentResponse,
  state: StreamState
): void {
  if (chunk.usageMetadata) {
    state.usageMetadata = {
      ...state.usageMetadata,
      ...chunk.usageMetadata,
    };
  }
}

function createMessageDeltaEvent(
  state: StreamState
): ClaudeMessageDeltaEvent {
  return {
    type: 'message_delta',
    delta: {
      stop_reason: mapFinishReason(state.finishReason),
    },
    usage: state.usageMetadata ? {
      input_tokens: state.usageMetadata.promptTokenCount ?? 0,
      output_tokens: state.usageMetadata.candidatesTokenCount ?? 0,
    } : undefined,
  };
}
```

---

## 5. Streaming（SSE）转换设计：Gemini SSE → Claude SSE

### 5.1 为什么不能直接 pipe

一旦需要支持 tool calling + streaming，响应侧必须做到：

**解析 SSE → 将 Gemini 增量语义转换成 Claude SSE 事件序列 → 序列化写回**

否则 Claude Code 看到的将是 Gemini 的 SSE 数据结构，无法解析为 Anthropic 事件，更无法进行工具调用。

### 5.2 推荐实现模型：状态机 + 可审计 trace

建议为 Gemini 单独实现 SSE 转换器（类似现有 codex SSE 转换，但逻辑更复杂）。

#### 5.2.1 最小状态（建议）

- `messageStarted: boolean`
- `textBlockStarted: boolean`
- `activeTool?: { index: number; name: string; claudeToolUseId: string; args: unknown }`
- `pendingToolCall?: { index: number; name: string; args: Record<string, unknown>; partialArgsBuffer: string }`
- `messageStopped: boolean`

**状态说明（重要）**：

> **新增 `pendingToolCall` 状态**：用于处理 Gemini SSE 中 `functionCall.args` 的分片到达情况。
>
> **问题背景**：Gemini SSE 中 `functionCall.args` 可能分片到达，不同 chunk 可能包含同一 tool call 的不同参数片段。
>
> **参考 gemini-cli 实现**（`local-executor.ts`）：
> ```typescript
> // gemini-cli 使用累积 buffer
> if (part.functionCall) {
>   accumulatedCall = {
>     ...accumulatedCall,
>     ...part.functionCall,
>   };
> }
> ```
>
> **PromptXY 状态机处理策略**：
> ```typescript
> interface PendingToolCall {
>   index: number;
>   name: string;
>   args: Record<string, unknown>;  // 最终解析的参数对象
>   partialArgsBuffer: string;      // 用于处理分片 JSON
>   argChunks: string[];            // 收集所有 args chunk
> }
>
> // 处理 functionCall chunk
> function handleFunctionCallChunk(
>   chunk: GenerateContentResponse,
>   state: StreamState
> ): void {
>   const functionCall = chunk.candidates?.[0]?.content?.parts?.find(p => p.functionCall)?.functionCall;
>
>   if (!functionCall) return;
>
>   if (state.pendingToolCall) {
>     // 已有 pending tool call，累积 args
>     if (functionCall.args) {
>       // 方法1：直接合并对象（如果上游发送的是对象）
>       state.pendingToolCall.args = {
>         ...state.pendingToolCall.args,
>         ...functionCall.args,
>       };
>     }
>     if (functionCall.name) {
>       state.pendingToolCall.name = functionCall.name;
>     }
>   } else {
>     // 新的 tool call
>     state.pendingToolCall = {
>       index: state.nextToolIndex++,
>       name: functionCall.name || '',
>       args: functionCall.args || {},
>       partialArgsBuffer: '',
>       argChunks: [],
>     };
>   }
> }
>
> // 判断 tool call 是否完成
> function isToolCallComplete(chunk: GenerateContentResponse): boolean {
>   // 当收到新的 text part 或流结束时，认为 tool call 完成
>   const hasTextPart = chunk.candidates?.[0]?.content?.parts?.some(p => p.text);
>   const isStreamEnd = chunk.candidates?.[0]?.finishReason;
>   return !!(hasTextPart || isStreamEnd);
> }
> ```

#### 5.2.2 输出事件策略（Claude SSE）

初始化（第一次输出前）：

- `message_start`
- `content_block_start`（index=0, type=text）
- （可选）`ping`

文本增量：

- `content_block_delta`（index=0, delta.type=text_delta）

工具调用（Gemini functionCall）：

- `content_block_start`（index=1..n, type=tool_use, id/name/input={})
- 将 args 转为 JSON 字符串输出到 `input_json_delta`：
  - v1 推荐：一次性输出（`partial_json = JSON.stringify(args)`），确保 Claude Code 端能稳定解析
  - 若上游确实提供“args 增量片段”：允许追加输出多个 `input_json_delta`，但必须保证最终拼接后是合法 JSON
- `content_block_stop`

结束：

- `message_delta`（可选但建议）：写入 `stop_reason`（以及可获得的 `usage.output_tokens`）
- `message_stop`（确保只发送一次）

**finishReason/stop_reason 映射（完整映射表）**：

> **数据来源**：`@google/genai` 包中的 `FinishReason` 枚举定义，以及 `refence/gemini-cli/packages/core/src/telemetry/semantic.test.ts:355-401` 和 `semantic.ts:219-251` 中的映射测试用例。

| Gemini finishReason | Claude stop_reason | 说明 | trace 级别 |
| --- | --- | --- | --- |
| `STOP` | `end_turn` | 正常结束 | - |
| `MAX_TOKENS` | `max_tokens` | 达到token上限 | - |
| `FINISH_REASON_UNSPECIFIED` | `end_turn` | 未指定的结束原因 | info |
| `SAFETY` | `end_turn` | 安全过滤触发 | warning |
| `RECITATION` | `end_turn` | 内容引用限制 | warning |
| `MALFORMED_FUNCTION_CALL` | `end_turn` | 工具调用格式错误，需重试 | error |
| `IMAGE_SAFETY` | `end_turn` | 图像安全过滤 | warning |
| `LANGUAGE` | `end_turn` | 语言相关过滤 | warning |
| `BLOCKLIST` | `end_turn` | 黑名单过滤 | warning |
| `PROHIBITED_CONTENT` | `end_turn` | 禁止内容 | warning |
| `SPII` | `end_turn` | 敏感个人信息 | warning |
| `UNEXPECTED_TOOL_CALL` | `end_turn` | 意外工具调用 | error |
| `IMAGE_PROHIBITED_CONTENT` | `end_turn` | 图像禁止内容（安全原因） | warning |
| `NO_IMAGE` | `end_turn` | 无有效图像 | warning |
| `OTHER` / 缺失 | `end_turn` | 其他未知原因 | warning |

> **更新说明（v0.5）**：新增 `IMAGE_PROHIBITED_CONTENT` 和 `NO_IMAGE` 两个 finish reason，基于 `refence/gemini-cli/packages/cli/src/ui/hooks/useGeminiStream.ts:691-693` 的错误消息定义。

> **重要说明**：
> - `MALFORMED_FUNCTION_CALL` 是 Gemini 特有的错误状态，表示模型生成的工具调用格式不正确。参考 gemini-cli（`geminiChat.ts:802-806`），这种情况下应抛出 `InvalidStreamError` 并触发重试逻辑。
> - 新增的 `LANGUAGE`、`BLOCKLIST`、`PROHIBITED_CONTENT`、`SPII` 都是内容过滤相关的 finish reason，应记录 warning 但不视为错误。
> - `UNEXPECTED_TOOL_CALL` 表示模型在不应该调用工具时调用了工具，应记录 error。

#### 5.2.3 状态机扩展：candidateIndex 处理

**问题背景**：Gemini API 可能返回多个 candidates（不同的生成候选项），每个 chunk 可能来自不同的 candidate。

**v1 策略**：

- **始终选择** `candidates[0]`（第一个候选）
- **记录切换事件**：若检测到 candidate 切换，记录 trace warning
- **不混合** candidates：始终从同一个 candidate 提取内容

**实现建议**：

```typescript
// SSE 转换状态机扩展
interface StreamState {
  // ...现有状态
  selectedCandidateIndex: number; // 默认 0
  candidateSwitchCount: number; // 记录切换次数
  lastCandidateIndex?: number; // 上一个 chunk 的 candidate index
}

function handleStreamChunk(chunk: GenerateContentResponse, state: StreamState) {
  if (chunk.candidates && chunk.candidates.length > 0) {
    // 检查当前选中的 candidate 是否存在
    const selectedCandidate = chunk.candidates[state.selectedCandidateIndex];

    if (!selectedCandidate) {
      audit.addError('candidate_not_found', {
        selected_index: state.selectedCandidateIndex,
        available_indices: chunk.candidates.map(c => c.index),
      });
      return;
    }

    // 处理候选内容
    processCandidateContent(selectedCandidate, state);

    // 检测 candidate 切换
    const currentCandidateIndices = new Set(chunk.candidates.map(c => c.index));
    if (state.lastCandidateIndex !== undefined &&
        state.lastCandidateIndex !== state.selectedCandidateIndex &&
        currentCandidateIndices.has(state.lastCandidateIndex)) {
      state.candidateSwitchCount++;
      audit.addWarning('candidate_switch_detected', {
        from: state.lastCandidateIndex,
        to: state.selectedCandidateIndex,
        switch_count: state.candidateSwitchCount,
      });
    }

    state.lastCandidateIndex = state.selectedCandidateIndex;
  }
}
```

#### 5.2.4 状态机扩展：finishReason 重复处理

**问题背景**：Gemini SSE 流中，多个 chunk 可能携带相同的 `finishReason`。需要明确是发送多次、去重还是覆盖。

**参考实现**（geminiChat.ts:710-715）：
```typescript
const candidateWithReason = chunk?.candidates?.find(
  (candidate) => candidate.finishReason,
);
if (candidateWithReason) {
  finishReason = candidateWithReason.finishReason as FinishReason;
}
```

**v1 策略**：

- **缓存** finishReason，仅在变化时更新
- **只发送一次** `message_delta` 事件（在流结束时）
- **去重**：相同的 finishReason 不重复发送

**实现建议**：

```typescript
// 状态机中添加 finishReason 去重
interface StreamState {
  // ...现有状态
  finishReason?: FinishReason;
  finishReasonEmitted: boolean; // 是否已发送 message_delta
}

function handleFinishReason(chunk: GenerateContentResponse, state: StreamState) {
  const candidate = chunk?.candidates?.[0];
  const newReason = candidate?.finishReason;

  if (newReason && newReason !== state.finishReason) {
    state.finishReason = newReason;

    // 记录 finishReason 变化
    audit.addInfo('finish_reason_update', {
      previous: state.finishReason,
      current: newReason,
    });
  }

  // 仅在流结束时发送 message_delta
  if (isStreamEnd(chunk) && !state.finishReasonEmitted && state.finishReason) {
    yield createMessageDeltaEvent(state.finishReason);
    state.finishReasonEmitted = true;
  }
}
```

---

### 5.3 解析 Gemini SSE 的注意事项

Gemini streaming 的 SSE data 常常是"每条 data: JSON 表示一次增量响应"，其中可能包含：

- `candidates[].content.parts[]` 的增量 text
- `functionCall` 的出现（或分片出现）
- `usageMetadata`（可能在后期才出现）

建议策略：

- **复用现有 SSE 解析器**：引用 PromptXY 现有的 `SSEParserTransform`（`backend/src/promptxy/transformers/sse/sse.ts`），而非从头实现。该解析器已经正确处理了：
  - 多行 `data:` 拼接
  - `event:` 类型处理
  - 空行分隔
  - `id:` 和 `retry:` 字段
  - `[DONE]` 信号

- **SSE event 类型处理（v0.6 扩展）**：Gemini SSE 可能包含不同的事件类型，需要分别处理：
  - `event: message` 或无 `event:` 字段 - 常规消息，解析并处理 data 内容
  - `event: error` - 错误事件，立即转换为 Claude error 事件并断流
  - `event: control` - 控制信号（如重试提示），记录 trace 但不发送给客户端
  - `event: heartbeat` - 心跳事件，忽略并继续
  - `event: cancel` - 取消事件，转换为 `message_stop` 并结束流
  - 其他未知事件类型 - 记录 trace warning，忽略并继续

- **容错解析**：单条 data JSON 解析失败不应立即断流，记录 warning 并继续尝试后续 chunk

- **usage 提取**：尽量从上游 usageMetadata 提取并缓存，并在结束前以 `message_delta.usage` 输出（或 trace 记录）；若无法获得则 trace 记录 "unknown usage"

- **functionCall.args 形态**：args 常见是对象而非字符串增量；v1 应以"对象一次性 stringify"作为主路径，避免误用"字符串 buffer 直到可解析 JSON"的假设

**SSE 解析实现建议**：

> **代码参考来源**：`refence/claude-code-router/src/utils/SSEParser.transform.ts`

```typescript
// claude-code-router 中的通用 SSE 解析器
export class SSEParserTransform extends TransformStream<string, any> {
  private buffer = '';
  private currentEvent: Record<string, any> = {};

  constructor() {
    super({
      transform: (chunk: string, controller) => {
        const decoder = new TextDecoder();
        const text = decoder.decode(chunk);
        this.buffer += text;
        const lines = this.buffer.split('\n');

        // 保留最后一行（可能不完整）
        this.buffer = lines.pop() || '';

        for (const line of lines) {
          const event = this.processLine(line);
          if (event) {
            controller.enqueue(event);
          }
        }
      },
      flush: (controller) => {
        // 处理缓冲区中剩余的内容
        if (this.buffer.trim()) {
          const event = this.processLine(this.buffer.trim());
          if (event) controller.enqueue(event);
        }
      }
    });
  }

  private processLine(line: string): any | null {
    if (!line.trim()) {
      // 空行表示事件结束
      const event = { ...this.currentEvent };
      this.currentEvent = {};
      return Object.keys(event).length > 0 ? event : null;
    }

    if (line.startsWith('event:')) {
      this.currentEvent.event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const data = line.slice(5).trim();
      if (data === '[DONE]') {
        this.currentEvent.data = { type: 'done' };
      } else {
        try {
          this.currentEvent.data = JSON.parse(data);
        } catch (e) {
          this.currentEvent.data = { raw: data, error: 'JSON parse failed' };
        }
      }
    } else if (line.startsWith('id:')) {
      this.currentEvent.id = line.slice(3).trim();
    } else if (line.startsWith('retry:')) {
      this.currentEvent.retry = parseInt(line.slice(6).trim());
    }

    return null;
  }
}
```

对于 Gemini SSE 转换，只需将上述通用解析器的输出（`GenerateContentResponse` 对象）传递给 Gemini 特定的状态机即可。

---

## 6. 错误处理与重试机制

### 6.1 Gemini 特有错误状态

Gemini API 有一些特有的错误状态，需要在转换时特殊处理。

> **代码参考来源**：`refence/gemini-cli/packages/core/src/core/geminiChat.ts:786-814`

```typescript
// gemini-cli 中的流验证逻辑
// Stream validation logic: A stream is considered successful if:
// 1. There's a tool call OR
// 2. A not MALFORMED_FUNCTION_CALL finish reason and a non-empty response
if (!hasToolCall) {
  if (!finishReason) {
    throw new InvalidStreamError('Model stream ended without a finish reason.', 'NO_FINISH_REASON');
  }
  if (finishReason === FinishReason.MALFORMED_FUNCTION_CALL) {
    throw new InvalidStreamError('Model stream ended with malformed function call.', 'MALFORMED_FUNCTION_CALL');
  }
  if (!responseText) {
    throw new InvalidStreamError('Model stream ended with empty response text.', 'NO_RESPONSE_TEXT');
  }
}
```

**错误类型映射表**：

| Gemini 错误类型 | Claude SSE 错误类型 | 处理策略 |
| --- | --- | --- |
| `NO_FINISH_REASON` | `error` + 重试 | 流结束但没有 finishReason，标记为可重试错误 |
| `MALFORMED_FUNCTION_CALL` | `error` + 重试 | 工具调用格式错误，标记为可重试错误 |
| `NO_RESPONSE_TEXT` | `error` + 重试 | 流结束时没有响应文本，标记为可重试错误 |
| 网络错误/429 | `error` + 重试 | 网络或限流错误，使用退避重试 |
| 400/无效参数 | `error` + 不重试 | 请求参数错误，不应重试 |
| 401/认证失败 | `error` + 不重试 | 认证错误，不应重试 |

### 6.2 InvalidStreamError 处理

> **代码参考来源**：`refence/gemini-cli/packages/core/src/core/geminiChat.ts:184-198`

```typescript
// gemini-cli 中的 InvalidStreamError 定义
export class InvalidStreamError extends Error {
  readonly type: 'NO_FINISH_REASON' | 'NO_RESPONSE_TEXT' | 'MALFORMED_FUNCTION_CALL';

  constructor(
    message: string,
    type: 'NO_FINISH_REASON' | 'NO_RESPONSE_TEXT' | 'MALFORMED_FUNCTION_CALL',
  ) {
    super(message);
    this.name = 'InvalidStreamError';
    this.type = type;
  }
}
```

**转换策略**：

1. **检测无效流**：在 SSE 转换状态机中检测上述错误类型
2. **发送 Claude error 事件**：
   ```typescript
   {
     type: 'error',
     error: {
       type: 'invalid_stream',
       message: `Gemini stream error: ${error.type} - ${error.message}`,
     }
   }
   ```
3. **决定是否重试**：
   - `NO_FINISH_REASON`、`MALFORMED_FUNCTION_CALL`、`NO_RESPONSE_TEXT`：可重试
   - 其他错误：不重试

### 6.3 重试机制

> **代码参考来源**：`refence/gemini-cli/packages/core/src/core/geminiChat.ts:292-376`

```typescript
// gemini-cli 中的重试配置和逻辑
const INVALID_CONTENT_RETRY_OPTIONS: ContentRetryOptions = {
  maxAttempts: 2, // 1 initial call + 1 retry
  initialDelayMs: 500,
};

// 在重试时输出重试事件
yield { type: StreamEventType.RETRY };
```

**Claude SSE 重试事件表示**：

由于 Claude SSE 标准不包含重试事件，建议通过以下方式通知客户端：

```typescript
// 方法1：发送特殊错误事件
{
  type: 'error',
  error: {
    type: 'retry_attempt',
    message: `Retrying due to ${error.type} (attempt ${attempt}/${maxAttempts})`,
  }
}

// 方法2：在 trace 中记录，不发送给客户端
trace.setMetadata('retry_attempt', attempt);
trace.setMetadata('retry_reason', error.type);
```

### 6.4 错误响应格式

**问题背景**：Claude Code 期望特定的错误响应格式，与 Gemini API 的错误格式不同，需要进行转换。

> **代码参考来源**：Claude Messages API 错误格式规范。

**非流式错误响应**：

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Gemini API error: ...",
    "details": {
      "status_code": 400,
      "gemini_error": { ... }
    }
  }
}
```

**错误类型映射**：

| Gemini 错误 | Claude 错误类型 | 说明 |
| --- | --- | --- |
| 400 INVALID_ARGUMENT | `invalid_request_error` | 请求参数错误 |
| 401 UNAUTHENTICATED | `authentication_error` | 认证失败 |
| 429 RESOURCE_EXHAUSTED | `rate_limit_error` | 超过速率限制 |
| 500 INTERNAL_ERROR | `api_error` | 服务端错误 |
| 503 UNAVAILABLE | `api_error` | 服务不可用 |

**流式错误响应**：

> **重要修正**：Claude SSE 标准使用特定的错误事件格式，而不是通用的 `event: error`。

**标准 Claude SSE 错误格式**：

```
event: error
data: {"type":"invalid_request_error","message":"Gemini API error: ..."}

event: done
```

**错误事件序列**：

1. **发送 error 事件**：包含错误类型和消息
2. **发送 done 事件**：标记流结束（Claude Code 期望）
3. **关闭连接**：确保客户端正确处理

**实现建议**：

```typescript
// 非流式错误转换
function transformGeminiError(
  geminiError: GeminiErrorResponse,
  audit: FieldAuditCollector
): ClaudeErrorResponse {
  const errorType = mapErrorType(geminiError.status);
  const message = formatErrorMessage(geminiError);

  audit.addError('gemini_api_error', message, {
    status: geminiError.status,
    code: geminiError.code,
  });

  return {
    type: 'error',
    error: {
      type: errorType,
      message,
      details: {
        status_code: geminiError.status,
        gemini_error: geminiError,
      },
    },
  };
}

// 流式错误转换（SSE）
function* transformGeminiStreamError(
  geminiError: GeminiErrorResponse,
  audit: FieldAuditCollector
): Generator<string> {
  const errorType = mapErrorType(geminiError.status);
  const message = formatErrorMessage(geminiError);

  audit.addError('gemini_stream_error', message, {
    status: geminiError.status,
    code: geminiError.code,
  });

  // 发送 Claude SSE 标准错误事件
  yield `event: error\n`;
  yield `data: ${JSON.stringify({
    type: errorType,
    message,
  })}\n`;
  yield '\n';

  // 发送 done 事件（Claude Code 期望）
  yield `event: done\n`;
  yield `data: [DONE]\n`;
  yield '\n';
}

// 错误类型映射
function mapErrorType(status: number): string {
  if (status === 400) return 'invalid_request_error';
  if (status === 401) return 'authentication_error';
  if (status === 429) return 'rate_limit_error';
  if (status >= 500) return 'api_error';
  return 'api_error'; // 默认
}

// 格式化错误消息
function formatErrorMessage(error: GeminiErrorResponse): string {
  const prefix = `Gemini API error (${error.code})`;
  return error.message ? `${prefix}: ${error.message}` : prefix;
}
```

### 6.5 错误处理最佳实践

1. **记录详细错误信息**：在 trace 中记录完整的错误堆栈和上下文
2. **区分可重试和不可重试错误**：避免无意义的重试
3. **提供有意义的错误消息**：帮助用户理解问题所在
4. **保持与 Claude Code 兼容**：错误格式应符合 Claude Code 的预期

---

## 7. 可观测性与可验证性（必须作为 v1 一等能力）

PromptXY 已经具备 trace/audit 的基础结构（用于 codex 转换）。Gemini 转换建议复用同一套：

- 每个 stage 记录：
  - 输入/输出摘要（脱敏）
  - duration
  - success/warning/error

建议新增/强化：

1. **Transform Preview API**：给定 Claude 请求样例，输出：
   - 转换后 Gemini 请求（path/headers/body，敏感字段脱敏）
   - 选择的模型映射结果
   - tools 映射差异
2. **Streaming 模拟器（离线）**：用 fixture 的 Gemini SSE 输入，产出 Claude SSE 输出（用于单测/回归）

---

## 7. 风险清单（必须在 review 时明确）

### 7.1 工具调用关联策略（id vs name）

- Claude tool_result 通过 `tool_use_id` 关联
- Gemini functionResponse 更倾向按 name 关联

风险：多次调用同名工具时，可能出现关联错误。

缓解：
- v1 采用“内部映射”（`tool_use_id -> tool_name`）作为主策略；无法映射时才回退“顺序关联/文本回退”，并写入 trace warning
- 明确约束：标准 Gemini API（API Key 模式）functionResponse **不支持 `id`**，因此不能指望通过上游字段回传/携带 tool_use_id

### 7.2 streaming 下 tool args 分片差异

不同 Gemini 上游实现可能对 functionCall/args 的流式分片方式不同。

缓解：
- v1 首选路径：将 `functionCall.args` 视为对象，一次性 stringify 后输出 `input_json_delta`
- 若确实遇到 args 的增量片段：
  - 允许累计多个片段，但必须在 `content_block_stop` 前保证拼接后是合法 JSON
  - 无法保证时：输出 `error` 事件或回退为文本提示（策略需在实现中固定，并 trace 记录）

### 7.3 schema 兼容性

Gemini 对 JSON Schema 的接受度与 Claude/OpenAI 不完全一致（例如某些关键字/嵌套）。

缓解：
- 对 schema 做 sanitize，并在 trace 中列出被移除/修改的字段路径
- 对 `string.format` 做白名单过滤（已知可能仅支持 `date` / `date-time` 等少数值）
- 对 `anyOf/oneOf/allOf` 明确固定降级策略（保留并警告 / 降级第一项 / 拒绝）

---

## 8. 测试与回归建议（落地后必须具备）

建议用真实抓取的 Claude Code 请求样例生成 fixtures（脱敏、截断超长文本）：

1. 纯文本对话（stream=false/true）
2. 有 tools 且触发工具调用（stream=false/true）
3. 有 tools 但不触发（stream=false/true）

每个用例至少验证：

- 请求侧：Gemini path 是否正确（generateContent/streamGenerateContent）
- tools：functionDeclarations 是否生成且 schema 合法
- streaming：输出 Claude SSE 事件序列是否满足 Claude Code 的解析期望（message_start → … → message_stop）
- count_tokens（若支持）：`/v1/messages/count_tokens` 行为是否稳定（对齐 Gemini 或可接受的本地近似）

---

## 9. 里程碑拆分（便于 review 后进入实现）

建议按“可验收”拆成 4 个小里程碑：

0. （可选但建议）Claude `/v1/messages/count_tokens` 兼容（对齐 Gemini 或本地近似）
1. Claude→Gemini 非流式文本（无 tools）
2. Claude→Gemini 非流式 tools（tool_use/tool_result 往返）
3. Claude→Gemini 流式文本（Gemini SSE→Claude SSE）
4. Claude→Gemini 流式 tools（functionCall/args 分片 → tool_use 流）

---

## 10. 参考与溯源

### 10.1 项目内文档（本仓库）

- 协议转换总体调研：`docs/protocol-transformation-research.md`

### 10.2 参考项目（本仓库 refence/）

- CCR（SSE parse/serialize 的工程形态）：`refence/claude-code-router`
- CRS（Gemini API v1beta generateContent/streamGenerateContent 的实战处理）：`refence/claude-relay-service`
- Gemini CLI（@google/genai 使用形态，确认协议族与工具声明结构）：`refence/gemini-cli`

---

## 11. 变更记录（Changelog）

- v0.1（2026-01-07）：确定上游锚点为标准 Gemini API v1beta；给出 Claude→Gemini 的请求/响应/SSE+tools 可落地方案草案。
- v0.2（2026-01-07）：补齐可落地细节：stream `alt=sse`、API Key 鉴权与 baseUrl 拼接、API Key 模式下 functionResponse 不支持 `id`、补全生成参数映射、完善 SSE 事件与 args 形态约束、补充 count_tokens 兼容性说明与回归点。
- v0.3（2026-01-08）：**批判性审查后补充完善**：
  - **P0 修正**：
    - 修正 `functionResponse.id` 字段描述错误（Gemini API 确实支持 id 字段，参考 gemini-cli 源码确认）
    - 补全 `finishReason` 映射表，新增 `MALFORMED_FUNCTION_CALL`、`IMAGE_SAFETY` 等关键状态
  - **P1 补充**：
    - 新增 3.7 节：`thought/thoughtSignature` 特殊处理（包括过滤和添加签名逻辑）
    - 新增 4.1 节：`usageMetadata` 详细映射策略和流式处理方案
    - 新增第 6 章：错误处理与重试机制（InvalidStreamError、错误类型映射、重试策略）
  - **P2 优化**：
    - 优化 5.3 节 SSE 解析描述，引用现有 `SSEParserTransform` 实现
    - 完善 3.5.3 节 sanitize 规则，提供具体的白名单函数和循环引用检测实现
  - **架构验证**：确认与 PromptXY 现有 `TransformerEngine` 架构完全兼容
- v0.4（2026-01-08）：**实测验证和批判性审查后全面更新**：
  - **P0 修正（基于 GitHub issue #6974 实测）**：
    - **重大修正**：明确 `functionCall.id` 可能不存在（上游不保证），`functionResponse.id` 是客户端控制的字段
    - 更新工具调用关联策略：请求侧必须发送 id，响应侧需处理上游缺失 id 的情况
    - 补全 `finishReason` 映射表，新增 `FINISH_REASON_UNSPECIFIED`、`LANGUAGE`、`BLOCKLIST`、`PROHIBITED_CONTENT`、`SPII`、`UNEXPECTED_TOOL_CALL`
  - **P1 新增**：
    - 新增 3.8 节：图片/文件处理（`inlineData`/`fileData`）转换，包括 MIME 类型映射和文件大小限制
    - 新增 3.9 节：并发工具调用处理，明确并发场景的 id 关联和顺序保证
    - 新增 3.10 节：`count_tokens` 端点转换设计，包括请求/响应映射和 fallback 策略
    - 完善 3.7 节：新增 `active loop` 判断逻辑的详细实现
  - **P2 优化**：
    - 优化所有映射表，添加 trace 级别列
    - 补充更多容错策略和错误处理建议
    - 更新所有代码示例，添加完整的类型定义
- v0.5（2026-01-08）：**批判性 review 后补充遗漏转换流程和字段**：
  - **P0 修正（关键遗漏）**：
    - 补全 `finishReason` 映射表，新增 `IMAGE_PROHIBITED_CONTENT`、`NO_IMAGE` 两个状态
    - 新增 3.11 节：Code Execution Part 处理（`executableCode`/`codeExecutionResult`）
    - 新增 3.12 节：videoMetadata Part 处理（视频元数据过滤策略）
  - **P1 新增（重要遗漏）**：
    - 新增 3.6.1 节：safetySettings 参数处理（安全配置转换策略）
    - 新增 5.2.3 节：状态机扩展 candidateIndex 处理（多候选选择策略）
    - 新增 5.2.4 节：状态机扩展 finishReason 重复处理（去重策略）
    - 完善 5.3 节：SSE event 类型处理（message/error/control 事件分类）
  - **P2 优化（嵌套策略）**：
    - 优化 3.7 节：active loop 判断逻辑，新增 `getActiveLoopDepth()` 函数支持嵌套工具调用场景
    - 新增 `isActiveLoopV2()` 函数，提供更精确的连续轮次检测
- v0.6（2026-01-08）：**批判性 review 后修正核心功能**：
  - **P0 修正（核心功能，实施前必须修正）**：
    - **重大修正**：第 3.7 节 active loop 判断逻辑与 gemini-cli 保持一致
    - 改用**转换后的 Gemini contents 格式**判断（而非 Claude 格式）
    - 参考gemini-cli实现：从后向前查找最后一个包含纯文本的user消息
    - 明确判断时机：在contents转换完成后调用
  - **P1 修正（影响功能正确性）**：
    - 第 4.1 节：明确 usageMetadata 可能在多个 chunk 中出现，需累积处理
    - 第 3.9.3 节：增强并发 tool_results 顺序保证逻辑
  - **P2 补充（完善边界情况）**：
    - 第 5.3 节：扩展 SSE 事件类型处理（heartbeat/cancel 等）
  - **简化**：
    - safetySettings 详细讨论移至未来版本（现阶段聚焦核心功能）

---

## 附录 A：遗漏转换流程补充

### A.1 system blocks 处理

Claude 支持复杂的 `system` blocks 数组格式：

```json
{
  "system": [
    { "type": "text", "text": "You are a helpful assistant." },
    { "type": "text", "text": "Be concise." }
  ]
}
```

**转换策略**：
1. 将所有 text blocks 拼接为单一字符串
2. 使用 `\n\n` 分隔不同 blocks
3. 映射到 Gemini `systemInstruction.parts[0].text`

```typescript
function transformSystemBlocks(system: string | SystemBlock[]): string {
  if (typeof system === 'string') return system;

  return system
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n\n');
}
```

### A.2 cache_control 处理

Claude 的 `cache_control` block：

```json
{
  "type": "cache_control",
  "type": "ephemeral"
}
```

**v1 策略**：
- **忽略** `cache_control`（Gemini 使用不同的缓存机制 `cachedContent`）
- 在 trace 中记录 `cache_control_ignored`
- 未来可考虑映射到 Gemini 的 context caching API

### A.3 candidateCount 处理

Gemini 可能返回多个 candidates：

```json
{
  "candidates": [
    { "content": {...}, "finishReason": "STOP", "index": 0 },
    { "content": {...}, "finishReason": "STOP", "index": 1 }
  ]
}
```

**v1 策略**：
- **始终选择** `candidates[0]`（第一个候选）
- 在 trace 中记录 `candidate_count` 和 `selected_index`
- 若 `candidates` 为空，视为错误

---

## 附录 B：参考链接

- [GitHub Issue #6974 - FunctionResponse has id even when FunctionCall does not](https://github.com/google-gemini/gemini-cli/issues/6974)
- [Gemini API Function Calling 官方文档](https://ai.google.dev/gemini-api/docs/function-calling)
- [Gemini API Thought Signatures 文档](https://ai.google.dev/gemini-api/docs/thought-signatures)
- [js-genai 仓库](https://github.com/googleapis/js-genai)
- [gemini-cli 仓库](https://github.com/google-gemini/gemini-cli)
