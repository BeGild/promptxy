/**
 * Codex → Claude 响应转换（非流式）
 *
 * 当前网关的 Codex 上游返回形态以 OpenAI 兼容 chat.completion 为主（choices[0].message）。
 * 这里将其转换为 Claude Messages 的 message 响应，供 Claude Code 消费。
 */

import type { ClaudeContentBlock } from '../claude/types.js';

type OpenAIChatCompletionResponse = {
  id?: string;
  choices?: Array<{
    index?: number;
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type?: string;
        function?: { name: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function safeJsonParse(input: string | undefined): Record<string, unknown> {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as any;
    return {};
  } catch {
    return {};
  }
}

export function transformCodexResponseToClaude(response: unknown): unknown {
  if (!response || typeof response !== 'object') return response;

  const r = response as OpenAIChatCompletionResponse;
  const choice = r.choices?.[0];
  const message = choice?.message;
  const finishReason = choice?.finish_reason ?? null;

  const contentBlocks: ClaudeContentBlock[] = [];

  // 文本内容（可能为 null）
  if (typeof message?.content === 'string' && message.content.length > 0) {
    contentBlocks.push({ type: 'text', text: message.content });
  }

  // 工具调用（tool_calls → tool_use blocks）
  const toolCalls = message?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    for (const call of toolCalls) {
      contentBlocks.push({
        type: 'tool_use',
        id: call.id,
        name: call.function?.name || '',
        input: safeJsonParse(call.function?.arguments),
      });
    }
  }

  const out: any = {
    id: r.id,
    type: 'message',
    role: 'assistant',
    content: contentBlocks.length > 0 ? contentBlocks : '',
    stop_reason: finishReason,
  };

  if (r.usage && (r.usage.prompt_tokens !== undefined || r.usage.completion_tokens !== undefined)) {
    out.usage = {
      input_tokens: r.usage.prompt_tokens,
      output_tokens: r.usage.completion_tokens,
    };
  }

  return out;
}

