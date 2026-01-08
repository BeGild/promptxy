# Gemini 协议转换器使用指南

## 概述

Gemini 协议转换器提供了完整的 **Claude Code → Gemini(v1beta)** 协议转换功能，包括：

- 请求转换（Claude → Gemini）
- 响应转换（Gemini → Claude，非流式）
- SSE 流式转换（Gemini SSE → Claude SSE）
- count_tokens 兼容
- 完整的审计与 trace 支持

## 快速开始

### 基本使用

```typescript
import { GeminiTransformer } from './transformers/protocols/gemini/index.js';

// 创建转换器实例
const transformer = new GeminiTransformer({
  baseUrl: 'https://generativelanguage.googleapis.com',
  apiKey: process.env.GEMINI_API_KEY,
  enableAudit: true, // 启用审计功能
});

// 转换请求
const claudeRequest = {
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
  max_tokens: 4096,
};

const result = transformer.transformRequest(claudeRequest);
console.log('URL:', result.data.url);
console.log('Body:', result.data.body);
console.log('Audit:', result.audit);

// 使用转换后的请求发送到 Gemini API
// ...
```

### 完整流程示例

```typescript
import {
  GeminiTransformer,
  type GeminiTransformerConfig,
} from './transformers/protocols/gemini/index.js';
import type { ClaudeMessagesRequest } from './transformers/protocols/claude/types.js';

async function processClaudeRequest(claudeRequest: ClaudeMessagesRequest) {
  // 1. 创建转换器
  const config: GeminiTransformerConfig = {
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: process.env.GEMINI_API_KEY!,
    enableAudit: true,
    retryConfig: {
      enableRetry: true,
      maxAttempts: 2,
    },
  };
  const transformer = new GeminiTransformer(config);

  // 2. 转换请求
  const { data: requestData, audit: requestAudit } = transformer.transformRequest(claudeRequest);

  // 3. 发送到 Gemini API
  const response = await fetch(requestData.url, {
    method: 'POST',
    headers: requestData.headers,
    body: requestData.body,
  });

  // 4. 处理响应
  if (claudeRequest.stream) {
    // SSE 流式响应
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim().startsWith('data:')) {
          const chunks = transformer.parseSSEChunk(line);
          if (chunks.length > 0) {
            const { data: sseResult, streamEnd } = transformer.transformSSE(chunks);

            // 处理 Claude SSE 事件
            for (const event of sseResult.events) {
              console.log('SSE Event:', event.type);
              // 发送到客户端...
            }

            if (streamEnd) break;
          }
        }
      }
    }
  } else {
    // 非流式响应
    const geminiResponse = await response.json();
    const { data: claudeResponse, audit: responseAudit } = transformer.transformResponse(
      geminiResponse,
      claudeRequest.model
    );

    console.log('Claude Response:', claudeResponse);
  }

  // 5. 获取审计摘要
  const summary = transformer.getAuditSummary();
  console.log('Audit Summary:', summary);
}
```

## API 参考

### GeminiTransformer

#### 构造函数

```typescript
constructor(config: GeminiTransformerConfig)
```

**配置参数：**
- `baseUrl: string` - Gemini API 基础 URL
- `apiKey?: string` - API Key（可选，优先使用 query 参数）
- `enableAudit?: boolean` - 是否启用审计功能（默认 false）
- `retryConfig?: RetryConfig` - 重试配置

#### 方法

##### transformRequest

转换 Claude 请求到 Gemini 请求。

```typescript
transformRequest(claudeRequest: ClaudeMessagesRequest): TransformResult<{
  url: string;
  body: string;
  headers: Record<string, string>;
}>
```

##### transformResponse

转换 Gemini 响应到 Claude 响应（非流式）。

```typescript
transformResponse(
  geminiResponse: GeminiGenerateContentResponse,
  model?: string
): TransformResult<ClaudeMessageResponse>
```

##### transformSSE

转换 Gemini SSE 流到 Claude SSE 流。

```typescript
transformSSE(
  sseChunks: GeminiSSEChunk[],
  enableRetry?: boolean
): TransformResult<{ events: ClaudeSSEEvent[]; traceSummary?: string }> & { streamEnd: boolean }
```

##### parseSSEChunk

解析 SSE chunk 字符串。

```typescript
parseSSEChunk(chunk: string): GeminiSSEChunk[]
```

##### transformCountTokens

转换 count_tokens 请求。

```typescript
transformCountTokens(
  messages: ClaudeMessage[],
  system?: string | ClaudeContentBlock[],
  enableFallback?: boolean
): TransformResult<{ geminiRequest: object; url: string }>
```

##### getAuditSummary

获取审计摘要（用于 Protocol Lab 展示）。

```typescript
getAuditSummary(): {
  urlInfo: string;
  stats: string;
  warnings: string[];
  schemaChanges: string[];
}
```

## 审计功能

当启用 `enableAudit: true` 时，转换器会记录详细的审计信息：

### 记录的信息

1. **URL 构造信息**
   - action 类型（generateContent/streamGenerateContent）
   - 模型名称
   - 是否流式
   - 是否使用 query key

2. **转换统计**
   - 源消息数量 → 目标 contents 数量
   - 工具数量
   - tool_use_id 映射数量

3. **Schema 变更**
   - 被移除的字段
   - Schema 警告

4. **运行时元数据**
   - finishReason 映射
   - thought parts 过滤
   - parts 合并统计
   - usage 转换

### 审计结果示例

```typescript
{
  fieldAudit: {
    sourcePaths: ['/messages', '/messages (count: 2)'],
    targetPaths: ['/contents', '/contents (count: 2)'],
    extraTargetPaths: [],
    missingRequiredTargetPaths: [],
    unmappedSourcePaths: [],
    diffs: [],
    defaulted: [],
    metadata: {
      gemini_url_action: 'generateContent',
      gemini_url_model: 'gemini-2.0-flash-exp',
      system_instruction_role: 'user',
      tool_use_id_mappings: 1,
    }
  },
  schemaAudit: {
    removedFields: [],
    warnings: []
  },
  urlInfo: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    action: 'generateContent',
    model: 'gemini-2.0-flash-exp',
    streaming: false,
    hasQueryKey: true
  },
  stats: {
    sourceMessageCount: 2,
    targetContentCount: 2,
    toolCount: 1,
    toolUseMappingCount: 1
  }
}
```

## 高级功能

### 内部重试

SSE 转换支持内部重试机制：

```typescript
const transformer = new GeminiTransformer({
  // ...
  retryConfig: {
    enableRetry: true,
    maxAttempts: 2, // 最多重试 1 次
  },
});
```

### Invalid Stream 检测

转换器会自动检测以下无效流情况：

- `NO_FINISH_REASON` - 无完成原因
- `NO_RESPONSE_TEXT` - 无响应内容
- `MALFORMED_FUNCTION_CALL` - 格式错误的工具调用

检测到无效流时，会：
1. 记录 trace 信息
2. 发送 Claude SSE `event: error`
3. 如果启用重试，自动重试

### Schema Sanitize

工具 schema 会自动进行以下处理：

1. **白名单过滤** - 只保留 Gemini 支持的字段
2. **Format 白名单** - 只保留支持的格式类型
3. **组合关键字处理** - `anyOf/oneOf/allOf` 保留第一个分支并警告
4. **审计记录** - 记录所有被移除的字段和警告

## 错误处理

### count_tokens Fallback

当 Gemini `:countTokens` API 不可用时，会自动使用本地估算：

```typescript
const result = transformer.transformCountTokensResponse(
  { totalTokens: 100 },
  true // enableFallback
);

if (result.data.fallback) {
  console.log('使用了本地估算');
}
```

## 集成到 PromptXY

Gemini 转换器已完全集成到 PromptXY 的转换框架中，可以：

1. 作为协议转换器在路由中使用
2. 在 Protocol Lab 中展示审计信息
3. 在请求历史中记录 trace 数据

## 测试

运行测试：

```bash
npm test -- tests/transformers/protocols/gemini/
```

当前测试覆盖：
- 请求转换测试 (13 个用例)
- 响应转换测试 (7 个用例)
- SSE 转换测试 (12 个用例)

总计 **32 个测试用例** 全部通过。
