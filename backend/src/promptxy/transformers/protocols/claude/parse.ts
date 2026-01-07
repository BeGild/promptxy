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

  return {
    system,
    messages,
    tools,
    stream: request.stream || false,
    model: request.model,
    metadata: request.metadata,
    sessionId: extractSessionId(request.metadata),
  };
}

/**
 * 从 metadata.user_id 提取 sessionId
 *
 * 规则（参考 refence/claude-code-router/src/utils/router.ts:184）：
 * - 以 "_session_" 分隔提取
 */
export function extractSessionId(metadata?: { user_id?: string }): string | undefined {
  const userId = metadata?.user_id;
  if (!userId || typeof userId !== 'string') {
    return undefined;
  }

  const parts = userId.split('_session_');
  return parts.length > 1 ? parts[1] : undefined;
}
