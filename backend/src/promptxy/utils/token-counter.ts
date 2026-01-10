/**
 * 统一 Token 计算工具
 *
 * 支持上游 API + 本地 fallback 策略
 */

import type { ClaudeMessage, ClaudeContentBlock } from '../transformers/protocols/claude/types.js';
import type { SupplierAuth } from '../types.js';

export interface TokenCountResult {
  input_tokens: number;
  _method?: 'tiktoken' | 'estimate';
  _fallback?: boolean;
}

/**
 * 计算 Claude 请求的 token 数量
 *
 * 支持上游 API（如果可用）和本地字节估算 fallback
 */
export async function countClaudeTokens(options: {
  messages: ClaudeMessage[];
  system?: string | ClaudeContentBlock[];
  tools?: unknown[];
  capabilities?: { supportsCountTokens: boolean; countTokensEndpoint?: string };
  baseUrl?: string;
  auth?: SupplierAuth;
}): Promise<TokenCountResult> {
  const { messages, system, tools, capabilities, baseUrl, auth } = options;

  if (capabilities?.supportsCountTokens && baseUrl && capabilities.countTokensEndpoint) {
    try {
      const result = await callUpstreamCountTokens({
        messages,
        system,
        tools,
        endpoint: capabilities.countTokensEndpoint,
        auth,
      });

      return {
        input_tokens: result,
        _method: 'tiktoken',
      };
    } catch (error) {
      const localResult = estimateTokensLocally({ messages, system, tools });
      return {
        ...localResult,
        _fallback: true,
      };
    }
  }

  return estimateTokensLocally({ messages, system, tools });
}

async function callUpstreamCountTokens(options: {
  messages: ClaudeMessage[];
  system?: string | ClaudeContentBlock[];
  tools?: unknown[];
  endpoint: string;
  auth?: SupplierAuth;
}): Promise<number> {
  const { messages, system, tools, endpoint, auth } = options;

  if (!auth || auth.type === 'none') {
    throw new Error('Upstream API requires authentication');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth.type === 'bearer' && auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  } else if (auth.type === 'header' && auth.headerName && auth.headerValue) {
    headers[auth.headerName] = auth.headerValue;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'gpt-4',
      messages: messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content:
          typeof msg.content === 'string'
            ? msg.content
            : msg.content.map((b: ClaudeContentBlock) => {
                if (b.type === 'text') return { type: 'text', text: b.text };
                return { type: 'text', text: '' };
              }),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Upstream count_tokens failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    usage?: { prompt_tokens?: number };
    prompt_tokens?: number;
  };

  return data.usage?.prompt_tokens || data.prompt_tokens || 0;
}

function estimateTokensLocally(options: {
  messages: ClaudeMessage[];
  system?: string | ClaudeContentBlock[];
  tools?: unknown[];
}): TokenCountResult {
  const { messages, system, tools } = options;

  let totalChars = 0;

  totalChars += countSystemChars(system);
  totalChars += countMessageChars(messages);
  totalChars += countToolChars(tools);

  const estimatedTokens = Math.ceil(totalChars / 3);

  return {
    input_tokens: estimatedTokens,
    _method: 'estimate',
    _fallback: true,
  };
}

function countSystemChars(system: string | ClaudeContentBlock[] | undefined): number {
  if (!system) return 0;

  if (typeof system === 'string') {
    return system.length;
  }

  if (Array.isArray(system)) {
    let chars = 0;
    for (const block of system) {
      if (block.type === 'text' && block.text) {
        chars += block.text.length;
      }
    }
    return chars;
  }

  return 0;
}

function countMessageChars(messages: ClaudeMessage[]): number {
  let chars = 0;

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'text' && block.text) {
          chars += block.text.length;
        } else if (block.type === 'image' && block.source) {
          const mediaType = block.source.type || 'image/jpeg';
          chars += mediaType.length;
        }
      }
    }
  }

  return chars;
}

function countToolChars(tools: unknown[] | undefined): number {
  if (!tools || !Array.isArray(tools)) return 0;

  let chars = 0;

  for (const tool of tools) {
    if (tool && typeof tool === 'object') {
      const toolObj = tool as { name?: string; description?: string; input_schema?: unknown };
      chars += (toolObj.name || '').length;
      chars += (toolObj.description || '').length;
      if (toolObj.input_schema) {
        chars += JSON.stringify(toolObj.input_schema).length;
      }
    }
  }

  return chars;
}
