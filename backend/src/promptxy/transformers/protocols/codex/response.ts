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

type TransformOptions = {
  /**
   * short -> original mapping (used to restore tool names after request-side shortening)
   * For streaming, this is handled in the SSE transformer; for non-stream we need it here.
   */
  reverseShortNameMap?: Record<string, string>;
};

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

function normalizeStopReasonLikeClaude(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (s === 'tool_use' || s === 'end_turn' || s === 'max_tokens') return s;
  return undefined;
}

function extractResponsesUsage(usage: any): {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
} | undefined {
  if (!usage || typeof usage !== 'object') return undefined;

  const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
  const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;
  const cachedTokens = typeof usage?.input_tokens_details?.cached_tokens === 'number'
    ? usage.input_tokens_details.cached_tokens
    : 0;

  // Align with CLIProxyAPI/codex-rs TokenUsage semantics:
  // - input_tokens: subtract cached_tokens
  // - cache_read_input_tokens: cached_tokens
  const adjustedInputTokens = Math.max(inputTokens - cachedTokens, 0);

  return {
    input_tokens: adjustedInputTokens,
    output_tokens: outputTokens,
    cache_read_input_tokens: cachedTokens,
    cache_creation_input_tokens: 0,
  };
}

function transformResponsesNonStreamToClaude(response: any, options?: TransformOptions): any | undefined {
  // Support both:
  // - OpenAI SSE-like wrapper: { type:"response.completed", response:{...} }
  // - Direct Responses object: { id, model, output, usage, ... }
  const responseData = (response?.type === 'response.completed' && response?.response && typeof response.response === 'object')
    ? response.response
    : response;

  if (!responseData || typeof responseData !== 'object') return undefined;

  // Heuristic: must have output[] to be Responses format
  if (!Array.isArray((responseData as any).output)) return undefined;

  const out: any = {
    id: (responseData as any).id,
    type: 'message',
    role: 'assistant',
    model: (responseData as any).model || '',
    content: [] as ClaudeContentBlock[],
    stop_reason: null,
    stop_sequence: null,
  };

  const usage = extractResponsesUsage((responseData as any).usage);
  if (usage) {
    out.usage = usage;
  }

  let hasToolCall = false;

  for (const item of (responseData as any).output as any[]) {
    if (!item || typeof item !== 'object') continue;
    const t = (item as any).type;

    if (t === 'reasoning') {
      // Prefer summary[] (string parts), fallback to content.
      let thinking = '';
      const summary = (item as any).summary;
      if (Array.isArray(summary)) {
        thinking = summary.map((p: any) => (typeof p?.text === 'string' ? p.text : String(p ?? ''))).join('');
      } else if (typeof summary === 'string') {
        thinking = summary;
      }
      if (!thinking) {
        const content = (item as any).content;
        if (Array.isArray(content)) {
          thinking = content.map((p: any) => (typeof p?.text === 'string' ? p.text : String(p ?? ''))).join('');
        } else if (typeof content === 'string') {
          thinking = content;
        }
      }
      if (thinking) {
        out.content.push({ type: 'thinking', thinking } as any);
      }
      continue;
    }

    if (t === 'message') {
      const content = (item as any).content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (!part || typeof part !== 'object') continue;
          if ((part as any).type === 'output_text' && typeof (part as any).text === 'string' && (part as any).text) {
            out.content.push({ type: 'text', text: (part as any).text } as any);
          }
        }
      } else if (typeof content === 'string' && content) {
        out.content.push({ type: 'text', text: content } as any);
      }
      continue;
    }

    if (t === 'function_call' || t === 'custom_tool_call') {
      hasToolCall = true;
      let name = (item as any).name || '';
      if (options?.reverseShortNameMap && name in options.reverseShortNameMap) {
        name = options.reverseShortNameMap[name];
      }

      let input: Record<string, unknown> = {};
      const argsStr = typeof (item as any).arguments === 'string' ? (item as any).arguments
        : typeof (item as any).input === 'string' ? (item as any).input
        : undefined;
      if (argsStr) {
        input = safeJsonParse(argsStr);
      }

      out.content.push({
        type: 'tool_use',
        id: (item as any).call_id || '',
        name,
        input,
      } as any);
      continue;
    }
  }

  // stop_reason:
  // - if responseData.stop_reason is already Claude style, use it
  // - else map common OpenAI-ish reasons
  const rawStop = (responseData as any).stop_reason;
  const normalized = normalizeStopReasonLikeClaude(rawStop);
  if (normalized) {
    out.stop_reason = normalized;
  } else if (typeof rawStop === 'string' && rawStop.trim()) {
    out.stop_reason = mapStopReason(rawStop.trim());
  } else if (hasToolCall) {
    out.stop_reason = 'tool_use';
  } else {
    out.stop_reason = 'end_turn';
  }

  const stopSequence = (responseData as any).stop_sequence;
  if (stopSequence !== undefined) {
    out.stop_sequence = stopSequence;
  }

  if (out.content.length === 0) {
    out.content = '';
  }

  return out;
}

export function transformCodexResponseToClaude(response: unknown, options?: TransformOptions): unknown {
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

  // First try Responses format (official /responses non-stream or SSE-aggregated wrapper).
  const responsesOut = transformResponsesNonStreamToClaude(response as any, options);
  if (responsesOut) {
    return responsesOut;
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

    const adjustedInputTokens = Math.max(inputTokens - cachedTokens, 0);
    out.usage = {
      input_tokens: adjustedInputTokens,
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
