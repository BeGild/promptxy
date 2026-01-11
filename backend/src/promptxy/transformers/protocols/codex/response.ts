/**
 * Codex → Claude 响应转换（非流式）
 *
 * 当前网关的 Codex 上游返回形态以 OpenAI 兼容 chat.completion 为主（choices[0].message）。
 * 这里将其转换为 Claude Messages 的 message 响应，供 Claude Code 消费。
 */

/**
 * 记录缓存指标到审计元数据
 *
 * @param cachedTokens 缓存命中的 token 数
 * @param inputTokens 总输入 token 数
 * @returns 缓存统计信息
 */
function logCacheMetrics(cachedTokens: number, inputTokens: number): {
  cacheHitCount: number;
  cacheHitRate: number;
} {
  const cacheHitCount = cachedTokens;
  const cacheHitRate = inputTokens > 0 ? (cacheHitCount / inputTokens) * 100 : 0;

  // 输出缓存指标日志（仅在开发环境或缓存命中时）
  if (cachedTokens > 0) {
    // eslint-disable-next-line no-console
    console.log(`[Cache Metrics] Hit: ${cachedTokens}/${inputTokens} tokens (${cacheHitRate.toFixed(1)}%)`);
  }

  return { cacheHitCount, cacheHitRate };
}

import type { ClaudeContentBlock } from '../claude/types.js';

/**
 * 映射 Codex finish_reason 到 Claude stop_reason
 *
 * 参考: refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:327-338
 */
function mapStopReason(codexFinishReason: string | null | undefined): string {
  const mapping: Record<string, string> = {
    'tool_calls': 'tool_use',
    'stop': 'end_turn',
    'length': 'max_tokens',
    'content_filter': 'end_turn',
  };

  if (!codexFinishReason) {
    return 'end_turn';
  }

  return mapping[codexFinishReason] || 'end_turn';
}

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
    /** OpenAI/Codex 缓存命中的 token 数 */
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
    /** OpenAI/Codex 推理 token 数 */
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
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

  // 检测错误响应并透传：避免将错误消息错误地转换为空的 assistant 消息
  // 支持多种错误格式：
  // - OpenAI/Codex: { error: { message: "...", type: "...", code: "..." } }
  // - FastAPI: { detail: "..." }
  // 注意：正常 chat.completion 响应会有 choices 字段
  const hasChoices = 'choices' in response;
  const hasErrorField = 'error' in response || 'detail' in response;

  // 有错误字段但没有 choices 字段 → 判定为错误响应，直接透传
  if (hasErrorField && !hasChoices) {
    return response;
  }

  const r = response as OpenAIChatCompletionResponse;
  const choice = r.choices?.[0];
  const message = choice?.message;
  const finishReason = choice?.finish_reason ?? null;

  // 映射 Codex finish_reason 到 Claude stop_reason
  // 参考: refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:327-338
  const stopReason = mapStopReason(finishReason);

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
    stop_reason: stopReason,
  };

  if (r.usage && (r.usage.prompt_tokens !== undefined || r.usage.completion_tokens !== undefined)) {
    // 映射 OpenAI/Codex 缓存指标到 Claude 格式
    // cached_tokens → cache_read_input_tokens
    const cachedTokens = r.usage.prompt_tokens_details?.cached_tokens || 0;
    const reasoningTokens = r.usage.completion_tokens_details?.reasoning_tokens || 0;
    const inputTokens = r.usage.prompt_tokens || 0;

    // 记录缓存指标
    logCacheMetrics(cachedTokens, inputTokens);

    out.usage = {
      input_tokens: inputTokens,
      output_tokens: r.usage.completion_tokens,
      // Claude 格式的缓存指标：cache_read_input_tokens 表示从缓存读取的 token 数
      cache_read_input_tokens: cachedTokens,
      // OpenAI 不区分 cache_creation，设为 0
      cache_creation_input_tokens: 0,
    };

    // 如果有 reasoning tokens，添加到 usage 中
    if (reasoningTokens > 0) {
      (out.usage as any).reasoning_tokens = reasoningTokens;
    }
  }

  return out;
}

