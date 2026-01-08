/**
 * Gemini SSE 转换增强版：支持内部重试与 trace 记录
 */

import type { GeminiSSEChunk } from '../types.js';
import type { ClaudeSSEEvent } from '../../../protocols/claude/types.js';
import { transformGeminiSSEToClaude, type SSETransformResult } from './to-claude.js';

/**
 * Trace 记录
 */
export interface TransformTrace {
  /** 是否发生了重试 */
  retried: boolean;
  /** 重试原因 */
  retryReason?: string;
  /** 重试次数 */
  retryCount: number;
  /** 检测到的 invalid stream 类型 */
  invalidStreamType?: string;
  /** 原始错误消息 */
  originalError?: string;
  /** 转换的事件数量 */
  eventsGenerated: number;
  /** 是否流正常结束 */
  streamEnded: boolean;
}

/**
 * 带重试和 trace 的转换配置
 */
export interface RetryConfig {
  /** 最大重试次数（默认 1） */
  maxAttempts?: number;
  /** 是否启用重试 */
  enableRetry?: boolean;
}

/**
 * 带重试和 trace 的转换结果
 */
export interface RetryTransformResult extends SSETransformResult {
  /** Trace 记录 */
  trace: TransformTrace;
}

/**
 * Invalid Stream 判定条件
 */
interface InvalidStreamCondition {
  name: string;
  check: (chunks: GeminiSSEChunk[], result: SSETransformResult) => boolean;
}

/**
 * Invalid Stream 检测条件列表
 */
const INVALID_STREAM_CONDITIONS: InvalidStreamCondition[] = [
  {
    name: 'NO_FINISH_REASON_WITHOUT_TOOL_CALL',
    check: (chunks, result) => {
      if (result.events.length === 0) return false;
      const lastEvent = result.events[result.events.length - 1];
      if (lastEvent.type === 'message_stop') return false;

      // 检查是否有工具调用
      const hasToolCall = result.events.some(
        e => e.type === 'content_block_start' &&
        e.content_block?.type === 'tool_use'
      );

      if (!hasToolCall) {
        // 检查最后一个 chunk 是否有 finishReason
        const lastChunk = chunks[chunks.length - 1];
        const candidate = lastChunk?.candidates?.[0];
        return !candidate?.finishReason;
      }

      return false;
    },
  },
  {
    name: 'EMPTY_RESPONSE',
    check: (chunks, result) => {
      return result.events.length === 0 || (
        result.events.length === 1 &&
        result.events[0].type === 'message_stop'
      );
    },
  },
  {
    name: 'ONLY_ERROR_EVENT',
    check: (chunks, result) => {
      return result.events.length === 2 &&
        result.events[0].type === 'error' &&
        result.events[1].type === 'message_stop';
    },
  },
];

/**
 * 检测是否需要重试
 */
function shouldRetry(
  chunks: GeminiSSEChunk[],
  result: SSETransformResult,
  attemptNumber: number,
  config: RetryConfig
): { shouldRetry: boolean; reason?: string } {
  if (!config.enableRetry || attemptNumber >= (config.maxAttempts ?? 1)) {
    return { shouldRetry: false };
  }

  // 检查各种 invalid stream 条件
  for (const condition of INVALID_STREAM_CONDITIONS) {
    if (condition.check(chunks, result)) {
      return { shouldRetry: true, reason: condition.name };
    }
  }

  return { shouldRetry: false };
}

/**
 * 带重试和 trace 记录的 SSE 转换
 *
 * @param chunks - Gemini SSE chunks
 * @param config - 重试配置
 * @returns 转换结果和 trace 记录
 */
export function transformGeminiSSEWithRetry(
  chunks: GeminiSSEChunk[],
  config: RetryConfig = {}
): RetryTransformResult {
  const maxAttempts = config.enableRetry ? (config.maxAttempts ?? 1) + 1 : 1;
  const trace: TransformTrace = {
    retried: false,
    retryCount: 0,
    eventsGenerated: 0,
    streamEnded: false,
  };

  let lastResult: SSETransformResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 执行转换
    const result = transformGeminiSSEToClaude(chunks);
    lastResult = result;

    // 记录 trace
    trace.eventsGenerated = result.events.length;
    trace.streamEnded = result.streamEnd;

    // 检查是否需要重试（仅在第一次尝试时）
    if (attempt === 0) {
      const retryCheck = shouldRetry(chunks, result, attempt, config);

      if (retryCheck.shouldRetry) {
        trace.retried = true;
        trace.retryReason = retryCheck.reason;
        trace.retryCount = 1;

        // 如果是错误响应，记录原始错误
        const errorEvent = result.events.find(e => e.type === 'error');
        if (errorEvent && 'error' in errorEvent) {
          trace.originalError = errorEvent.error.message;
        }

        // 继续下一次尝试（在实际实现中，这里可能需要重新请求上游）
        continue;
      }
    }

    // 不需要重试或重试后，返回结果
    break;
  }

  return {
    ...lastResult!,
    trace,
  };
}

/**
 * 创建 trace 摘要（用于日志和调试）
 */
export function createTraceSummary(trace: TransformTrace): string {
  const parts: string[] = [];

  parts.push(`events=${trace.eventsGenerated}`);
  parts.push(`ended=${trace.streamEnded}`);

  if (trace.retried) {
    parts.push(`retried=true`);
    parts.push(`retry_reason=${trace.retryReason}`);
    parts.push(`retry_count=${trace.retryCount}`);
  }

  if (trace.originalError) {
    parts.push(`original_error=${trace.originalError}`);
  }

  return `GeminiSSETransform[${parts.join(', ')}]`;
}

/**
 * 判断 trace 是否表示成功的转换
 */
export function isTransformSuccessful(trace: TransformTrace): boolean {
  // 如果重试后仍然失败，或者没有生成任何事件
  if (trace.eventsGenerated === 0) {
    return false;
  }

  // 如果有错误但没有重试
  if (!trace.retried && trace.originalError) {
    return false;
  }

  return trace.streamEnded;
}
