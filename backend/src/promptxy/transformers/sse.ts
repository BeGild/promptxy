/**
 * SSE (Server-Sent Events) 流式响应转换
 *
 * 提供：
 * - SSE 事件解析
 * - 流式协议转换（OpenAI/Gemini → Anthropic）
 * - SSE 重新序列化
 */

import { Transform } from 'node:stream';
import { createLogger } from '../logger.js';

const logger = createLogger({ debug: false });

/**
 * SSE 事件类型
 */
export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * 解析 SSE 流
 * 将 SSE 文本流解析为事件数组
 */
export function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = chunk.split('\n');

  let currentEvent: Partial<SSEEvent> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行表示事件结束
    if (!trimmed) {
      if (currentEvent.data !== undefined) {
        events.push({
          id: currentEvent.id,
          event: currentEvent.event,
          data: currentEvent.data,
          retry: currentEvent.retry,
        });
        currentEvent = {};
      }
      continue;
    }

    // 解析字段
    if (trimmed.startsWith('id:')) {
      currentEvent.id = trimmed.slice(3).trim();
    } else if (trimmed.startsWith('event:')) {
      currentEvent.event = trimmed.slice(6).trim();
    } else if (trimmed.startsWith('data:')) {
      const data = trimmed.slice(5).trim();
      if (currentEvent.data === undefined) {
        currentEvent.data = data;
      } else {
        currentEvent.data += '\n' + data;
      }
    } else if (trimmed.startsWith('retry:')) {
      const retry = parseInt(trimmed.slice(6).trim(), 10);
      if (!isNaN(retry)) {
        currentEvent.retry = retry;
      }
    }
  }

  // 处理最后一个事件
  if (currentEvent.data !== undefined) {
    events.push({
      id: currentEvent.id,
      event: currentEvent.event,
      data: currentEvent.data,
      retry: currentEvent.retry,
    });
  }

  return events;
}

/**
 * 序列化 SSE 事件
 */
export function serializeSSEEvent(event: SSEEvent): string {
  const lines: string[] = [];

  if (event.id) lines.push(`id: ${event.id}`);
  if (event.event) lines.push(`event: ${event.event}`);
  if (event.retry) lines.push(`retry: ${event.retry}`);

  // data 字段可能包含多行
  const dataLines = event.data.split('\n');
  for (const line of dataLines) {
    lines.push(`data: ${line}`);
  }

  lines.push(''); // 空行表示事件结束
  // 注意：事件结束需要“空行”，也就是两个换行符。
  // 如果只以单个 `\n` 结束，多个事件拼接时会粘连，导致客户端把多事件解析成一个事件。
  return lines.join('\n') + '\n';
}

/**
 * 检测响应是否为 SSE 流
 */
export function isSSEResponse(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return contentType.includes('text/event-stream');
}

/**
 * 转换 OpenAI SSE chunk → Anthropic SSE chunk
 */
export function transformOpenAIChunkToAnthropic(
  chunk: string,
): string | null {
  try {
    // 解析 SSE 事件
    const events = parseSSEChunk(chunk);
    const transformedEvents: SSEEvent[] = [];

    for (const event of events) {
      // 只处理 data 事件
      if (event.event && event.event !== 'message.delta') {
        // 保留非 message.delta 事件（如 message.done）
        transformedEvents.push(event);
        continue;
      }

      if (!event.data) continue;

      // 解析 JSON 数据
      const data = JSON.parse(event.data);

      // 转换 OpenAI 格式 → Anthropic 格式
      const anthropicData = convertOpenAIStreamChunk(data);
      if (!anthropicData) continue;

      // 使用转换后的数据类型作为 SSE 事件名
      transformedEvents.push({
        id: event.id,
        retry: event.retry,
        event: anthropicData.type, // 如 'content_block_delta', 'message_stop' 等
        data: JSON.stringify(anthropicData),
      });
    }

    // 序列化回 SSE 格式
    return transformedEvents.map(serializeSSEEvent).join('');
  } catch {
    // 解析失败，返回原数据
    return chunk;
  }
}

/**
 * 转换 OpenAI 流式 chunk → Anthropic 流式 chunk
 */
function convertOpenAIStreamChunk(data: any): any | null {
  // OpenAI streaming format:
  // {
  //   "id": "...",
  //   "object": "chat.completion.chunk",
  //   "created": ...,
  //   "model": "...",
  //   "choices": [{
  //     "index": 0,
  //     "delta": { "content": "..." }
  //   }]
  // }

  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    return null;
  }

  const choice = data.choices[0];
  const delta = choice.delta;

  // Anthropic streaming format:
  // {
  //   "type": "content_block_delta",
  //   "index": 0,
  //   "delta": { "type": "text_delta", "text": "..." }
  // }

  // 检查是否为完成信号
  if (choice.finish_reason) {
    return {
      type: 'message_stop',
    };
  }

  // 内容增量
  if (delta && delta.content) {
    return {
      type: 'content_block_delta',
      index: choice.index || 0,
      delta: {
        type: 'text_delta',
        text: delta.content,
      },
    };
  }

  return null;
}

/**
 * 转换 Gemini SSE chunk → Anthropic SSE chunk
 */
export function transformGeminiChunkToAnthropic(
  chunk: string,
): string | null {
  try {
    // 解析 SSE 事件
    const events = parseSSEChunk(chunk);
    const transformedEvents: SSEEvent[] = [];

    for (const event of events) {
      if (!event.data) continue;

      // 解析 JSON 数据
      const data = JSON.parse(event.data);

      // 转换 Gemini 格式 → Anthropic 格式
      const anthropicData = convertGeminiStreamChunk(data);
      if (!anthropicData) continue;

      // 使用转换后的数据类型作为 SSE 事件名
      transformedEvents.push({
        id: event.id,
        retry: event.retry,
        event: anthropicData.type, // 如 'content_block_delta', 'message_stop' 等
        data: JSON.stringify(anthropicData),
      });
    }

    // 序列化回 SSE 格式
    return transformedEvents.map(serializeSSEEvent).join('');
  } catch {
    // 解析失败，返回原数据
    return chunk;
  }
}

/**
 * 转换 Gemini 流式 chunk → Anthropic 流式 chunk
 */
function convertGeminiStreamChunk(data: any): any | null {
  // Gemini streaming format:
  // {
  //   "candidates": [{
  //     "content": {
  //       "parts": [{ "text": "..." }]
  //     },
  //     "finishReason": "STOP"
  //   }]
  // }

  if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
    return null;
  }

  const candidate = data.candidates[0];

  // 检查是否为完成信号
  if (candidate.finishReason) {
    return {
      type: 'message_stop',
    };
  }

  // 内容增量
  if (candidate.content && candidate.content.parts) {
    for (const part of candidate.content.parts) {
      if (part.text) {
        return {
          type: 'content_block_delta',
          delta: {
            type: 'text_delta',
            text: part.text,
          },
        };
      }
    }
  }

  return null;
}

/**
 * 创建 SSE 转换流
 *
 * 这是一个 Transform 流，用于在管道中转换 SSE 响应
 *
 * @param transformType - 转换类型：'openai' 或 'gemini'，其他值表示透传
 */
export function createSSETransformStream(
  transformType?: 'openai' | 'gemini' | 'codex' | string,
): Transform {
  // 确定转换类型
  let actualTransformType: 'openai' | 'gemini' | 'codex' | 'passthrough' = 'passthrough';

  if (transformType === 'codex') {
    // Codex /responses 流式事件（response.*）
    actualTransformType = 'codex';
  } else if (transformType === 'openai' || transformType === 'deepseek') {
    // OpenAI-compatible Chat Completions 流式事件
    actualTransformType = 'openai';
  } else if (transformType === 'gemini') {
    actualTransformType = 'gemini';
  }

  if (logger.debugEnabled) {
    logger.debug(`[SSETransform] 转换类型: ${actualTransformType}`);
  }

  // Codex Responses SSE 转换需要保持状态（message_start/content_block_start 只发一次）
  let codexStarted = false;
  let codexContentStarted = false;
  let codexStopped = false;
  let codexMessageId: string | undefined;

  function ensureCodexStartEvents(): SSEEvent[] {
    const events: SSEEvent[] = [];
    if (!codexStarted) {
      codexStarted = true;
      events.push({
        event: 'message_start',
        data: JSON.stringify({
          type: 'message_start',
          message: {
            id: codexMessageId || '',
            type: 'message',
            role: 'assistant',
            content: [],
          },
        }),
      });
    }
    if (!codexContentStarted) {
      codexContentStarted = true;
      events.push({
        event: 'content_block_start',
        data: JSON.stringify({
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        }),
      });
    }
    return events;
  }

  function codexToAnthropicChunk(chunk: string): string {
    try {
      const events = parseSSEChunk(chunk);
      const out: SSEEvent[] = [];

      for (const evt of events) {
        if (!evt.data) continue;
        let parsed: any;
        try {
          parsed = JSON.parse(evt.data);
        } catch {
          continue;
        }

        const kind: string | undefined =
          (evt.event && evt.event.startsWith('response.') ? evt.event : undefined) ||
          (typeof parsed.type === 'string' ? parsed.type : undefined);

        if (!kind) continue;

        if (kind === 'response.created') {
          const rid = parsed?.response?.id;
          if (typeof rid === 'string') codexMessageId = rid;
          out.push(...ensureCodexStartEvents());
          continue;
        }

        if (kind === 'response.output_item.added') {
          const mid = parsed?.item?.id;
          if (!codexMessageId && typeof mid === 'string') codexMessageId = mid;
          out.push(...ensureCodexStartEvents());
          continue;
        }

        if (kind === 'response.output_text.delta') {
          const mid = parsed?.item_id;
          if (!codexMessageId && typeof mid === 'string') codexMessageId = mid;
          out.push(...ensureCodexStartEvents());
          const delta =
            typeof parsed.delta === 'string'
              ? parsed.delta
              : typeof parsed.text === 'string'
                ? parsed.text
                : typeof parsed?.output_text === 'string'
                  ? parsed.output_text
                  : '';
          if (!delta) continue;

          out.push({
            event: 'content_block_delta',
            data: JSON.stringify({
              type: 'content_block_delta',
              index: 0,
              delta: { type: 'text_delta', text: delta },
            }),
          });
          continue;
        }

        if (
          kind === 'response.completed' ||
          kind === 'response.output_text.done' ||
          kind === 'response.output_item.done' ||
          kind === 'response.content_part.done' ||
          kind === 'response.done' ||
          kind === 'response.failed' ||
          kind === 'response.error'
        ) {
          const mid = parsed?.item_id || parsed?.item?.id;
          if (!codexMessageId && typeof mid === 'string') codexMessageId = mid;
          if (codexStopped) continue;
          codexStopped = true;
          out.push(...ensureCodexStartEvents());
          out.push({
            event: 'content_block_stop',
            data: JSON.stringify({ type: 'content_block_stop', index: 0 }),
          });
          out.push({
            event: 'message_delta',
            data: JSON.stringify({
              type: 'message_delta',
              delta: { stop_reason: 'end_turn' },
              usage: { input_tokens: 0, output_tokens: 0 },
            }),
          });
          out.push({
            event: 'message_stop',
            data: JSON.stringify({ type: 'message_stop' }),
          });
          continue;
        }
      }

      if (out.length === 0) {
        return '';
      }

      return out.map(serializeSSEEvent).join('');
    } catch {
      return chunk;
    }
  }

  // 创建转换流
  return new Transform({
    transform(chunk: Buffer, encoding: BufferEncoding, callback) {
      try {
        const chunkStr = chunk.toString('utf-8');
        let transformed = chunkStr;

        // 根据转换类型应用转换
        if (actualTransformType === 'openai') {
          const result = transformOpenAIChunkToAnthropic(chunkStr);
          transformed = result ?? chunkStr;
        } else if (actualTransformType === 'codex') {
          const result = codexToAnthropicChunk(chunkStr);
          transformed = result || '';
        } else if (actualTransformType === 'gemini') {
          const result = transformGeminiChunkToAnthropic(chunkStr);
          transformed = result ?? chunkStr;
        }

        callback(null, Buffer.from(transformed, 'utf-8'));
      } catch (error: any) {
        if (logger.debugEnabled) {
          logger.debug(`[SSETransform] 转换失败: ${error?.message}`);
        }
        // 转换失败，返回原数据
        callback(null, chunk);
      }
    },

    flush(callback) {
      try {
        // 兜底：如果上游没有发送明确的 completed/done 事件，流结束时补齐 stop 事件，
        // 避免 Claude 侧因为缺少 message_stop 而报 “Execution error”。
        if (actualTransformType === 'codex' && codexStarted && !codexStopped) {
          const out: SSEEvent[] = [];
          out.push(...ensureCodexStartEvents());
          out.push({
            event: 'content_block_stop',
            data: JSON.stringify({ type: 'content_block_stop', index: 0 }),
          });
          out.push({
            event: 'message_delta',
            data: JSON.stringify({
              type: 'message_delta',
              delta: { stop_reason: 'end_turn' },
              usage: { input_tokens: 0, output_tokens: 0 },
            }),
          });
          out.push({
            event: 'message_stop',
            data: JSON.stringify({ type: 'message_stop' }),
          });
          codexStopped = true;
          (this as Transform).push(Buffer.from(out.map(serializeSSEEvent).join(''), 'utf-8'));
        }
      } catch {
        // ignore
      }
      callback();
    },
  });
}
