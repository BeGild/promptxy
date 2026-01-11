/**
 * Claude Messages API 解析
 *
 * 参考: refence/claude-code-router/src/utils/router.ts
 */

import type {
  ClaudeMessagesRequest,
  ClaudeMessage,
  ClaudeContentBlock,
  ClaudeSystemBlock,
  NormalizedSystem,
  NormalizedMessageContent,
} from './types.js';

/**
 * 解析并规范化 system 字段
 *
 * 规则：
 * - string -> 直接使用
 * - array -> 取 type === "text" 的 block，拼接其 text
 *   - text 为 string -> 直接拼接
 *   - text 为 string[] -> join 后拼接
 *   - 其他形态 -> 忽略
 */
export function normalizeSystem(system?: string | ClaudeSystemBlock[]): NormalizedSystem {
  const hasEnvSeparator = false;
  let text = '';

  if (system === undefined || system === null) {
    return { text: '', originalType: 'string', hasEnvSeparator: false };
  }

  if (typeof system === 'string') {
    text = system;
    return {
      text,
      originalType: 'string',
      hasEnvSeparator: text.includes('<env>'),
    };
  }

  // array 类型
  const parts: string[] = [];
  for (const block of system) {
    if (block.type === 'text') {
      if (typeof block.text === 'string') {
        parts.push(block.text);
      } else if (Array.isArray(block.text)) {
        parts.push(block.text.join(''));
      }
      // 其他形态忽略
    }
  }

  text = parts.join('\n');

  return {
    text,
    originalType: 'blocks',
    hasEnvSeparator: text.includes('<env>'),
  };
}

/**
 * 解析并规范化 message content
 *
 * 规则：
 * - string -> 包装为 text block
 * - array -> 直接使用
 */
export function normalizeMessageContent(
  content: string | ClaudeContentBlock[],
): NormalizedMessageContent {
  if (typeof content === 'string') {
    return {
      blocks: [{ type: 'text', text: content }],
      originalType: 'string',
    };
  }

  return {
    blocks: content,
    originalType: 'blocks',
  };
}

/**
 * 解析 Claude Messages API 请求
 */
export function parseClaudeRequest(request: ClaudeMessagesRequest): {
  system: NormalizedSystem;
  messages: Array<{
    role: string;
    content: NormalizedMessageContent;
  }>;
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>;
  stream: boolean;
  model: string;
  metadata?: Record<string, unknown>;
  /** 从 metadata.user_id 提取的 sessionId，用于 prompt_cache_key */
  sessionId?: string;
  /** 从 metadata 提取的缓存保留策略，用于 prompt_cache_retention */
  promptCacheRetention?: 'in_memory' | '24h';
} {
  const system = normalizeSystem(request.system);

  const messages = (request.messages || []).map(msg => ({
    role: msg.role,
    content: normalizeMessageContent(
      typeof msg.content === 'string' ? msg.content : msg.content || [],
    ),
  }));

  const tools = (request.tools || []).map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input_schema,
  }));

  // 从 metadata 中提取自定义缓存保留策略
  // 客户端可以通过 metadata.prompt_cache_retention 指定
  const promptCacheRetention = extractPromptCacheRetention(request.metadata);

  return {
    system,
    messages,
    tools,
    stream: request.stream || false,
    model: request.model,
    metadata: request.metadata,
    sessionId: extractSessionId(request.metadata),
    promptCacheRetention,
  };
}

/**
 * 从 metadata.user_id 提取 sessionId 作为 prompt_cache_key
 *
 * 规则（参考 refence/claude-code-router/src/utils/router.ts:184）：
 * - 以 "_session_" 分隔提取
 * - 如果没有分隔符，使用 userId 前 32 字符作为缓存键
 * - 这样即使没有 sessionId，也能利用上游缓存
 *
 * @returns prompt_cache_key 或 undefined（如果完全没传 user_id）
 */
export function extractSessionId(metadata?: { user_id?: string }): string | undefined {
  const userId = metadata?.user_id;
  if (!userId || typeof userId !== 'string') {
    return undefined;
  }

  // 尝试 _session_ 分隔提取
  const parts = userId.split('_session_');
  if (parts.length > 1) {
    return parts[1];
  }

  // 如果没有 _session_ 分隔符，使用 userId 的一部分作为缓存键
  // 这样即使客户端没有 sessionId，也能利用上游缓存
  // 取前 32 字符作为缓存键（足够唯一，且不会太长）
  return userId.substring(0, 32);
}

/**
 * 从 metadata 提取缓存保留策略
 *
 * 客户端可以通过 metadata.prompt_cache_retention 指定
 * 支持的值: 'in_memory' (默认 5-10 分钟) 或 '24h' (扩展缓存)
 *
 * @returns prompt_cache_retention 或 undefined（使用上游默认值）
 */
export function extractPromptCacheRetention(metadata?: Record<string, unknown>): 'in_memory' | '24h' | undefined {
  const retention = metadata?.['prompt_cache_retention'];
  if (!retention || typeof retention !== 'string') {
    return undefined;
  }

  // 验证值是否有效
  if (retention === 'in_memory' || retention === '24h') {
    return retention;
  }

  // 无效值，返回 undefined 使用上游默认
  return undefined;
}
