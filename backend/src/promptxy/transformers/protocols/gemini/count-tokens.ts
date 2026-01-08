/**
 * Claude count_tokens → Gemini countTokens 转换
 */

import type { GeminiCountTokensRequest } from './types.js';
import type { ClaudeMessage, ClaudeContentBlock } from '../claude/types.js';

/**
 * Count Tokens 结果
 */
export interface CountTokensResult {
  input_tokens: number;
  fallback?: boolean;
}

/**
 * 转换 Claude 请求到 Gemini countTokens 请求
 */
export function transformClaudeCountTokens(
  messages: ClaudeMessage[],
  system: string | ClaudeContentBlock[] | undefined
): GeminiCountTokensRequest {
  const request: GeminiCountTokensRequest = {
    contents: messages.map(msg => transformMessage(msg)),
  };

  // System Instruction
  if (system) {
    request.systemInstruction = transformSystemInstruction(system);
  }

  return request;
}

/**
 * 转换 Message
 */
function transformMessage(message: ClaudeMessage): GeminiCountTokensRequest['contents'][number] {
  const role = message.role === 'assistant' ? 'model' : 'user';
  const parts = transformContent(message.content);

  return { role, parts };
}

/**
 * 转换 Content (string 或 blocks) 到 Parts
 */
function transformContent(content: string | ClaudeContentBlock[]): GeminiCountTokensRequest['contents'][number]['parts'] {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  const parts: GeminiCountTokensRequest['contents'][number]['parts'] = [];
  for (const block of content) {
    const part = transformBlock(block);
    if (part) {
      parts.push(part);
    }
  }

  return parts;
}

/**
 * 转换单个 Content Block
 */
function transformBlock(block: ClaudeContentBlock): GeminiCountTokensRequest['contents'][number]['parts'][number] | null {
  switch (block.type) {
    case 'text':
      return { text: block.text };
    case 'tool_use':
      // countTokens 不需要 tool_use
      return null;
    case 'tool_result':
      // countTokens 不需要 tool_result
      return null;
    case 'image':
      // countTokens 不需要 image
      return null;
    default:
      return null;
  }
}

/**
 * 转换 System Instruction
 */
function transformSystemInstruction(
  system: string | ClaudeContentBlock[]
): { role: string; parts: GeminiCountTokensRequest['contents'][number]['parts'] } {
  let text: string;

  if (typeof system === 'string') {
    text = system;
  } else {
    // 提取所有 text block
    text = system
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('\n\n');
  }

  return {
    role: 'user',
    parts: [{ text }],
  };
}

/**
 * 转换 Gemini countTokens 响应
 */
export function transformGeminiCountTokensResponse(response: { totalTokens: number }): CountTokensResult {
  return {
    input_tokens: response.totalTokens,
  };
}

/**
 * Fallback: 本地估算 token 数
 *
 * 注意：这是粗略估算，与实际 Gemini 计费 token 会有偏差
 */
export function estimateTokensLocally(
  messages: ClaudeMessage[],
  system: string | ClaudeContentBlock[] | undefined
): CountTokensResult {
  let totalChars = 0;

  // System
  if (typeof system === 'string') {
    totalChars += system.length;
  } else if (system) {
    for (const block of system) {
      if (block.type === 'text') {
        totalChars += block.text.length;
      }
    }
  }

  // Messages
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      totalChars += msg.content.length;
    } else {
      for (const block of msg.content) {
        if (block.type === 'text') {
          totalChars += block.text.length;
        }
      }
    }
  }

  // 粗略估算：英文约 4 字符/token，中文约 2 字符/token
  // 这里使用保守估算：3 字符/token
  const estimatedTokens = Math.ceil(totalChars / 3);

  return {
    input_tokens: estimatedTokens,
    fallback: true,
  };
}
