/**
 * SSE (Server-Sent Events) 流式响应转换
 *
 * 提供：
 * - SSE 事件解析
 * - 流式协议转换（OpenAI/Gemini → Anthropic）
 * - SSE 重新序列化
 */

import { Readable, Transform } from 'node:stream';
import { createLogger } from '../logger.js';
import type { Supplier } from '../types.js';

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
  return lines.join('\n');
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
 */
export function createSSETransformStream(
  supplier: Supplier,
): Transform {
  // 确定转换类型
  let transformType: 'openai' | 'gemini' | 'passthrough' = 'passthrough';

  if (supplier.transformer && supplier.transformer.default) {
    const lastTransformer = supplier.transformer.default[supplier.transformer.default.length - 1];
    if (typeof lastTransformer === 'string') {
      if (lastTransformer === 'openai' || lastTransformer === 'deepseek' || lastTransformer === 'codex') {
        // Codex 使用 OpenAI Responses API 格式，复用 OpenAI 转换
        transformType = 'openai';
      } else if (lastTransformer === 'gemini') {
        transformType = 'gemini';
      }
    }
  }

  if (logger.debugEnabled) {
    logger.debug(`[SSETransform] 转换类型: ${transformType}`);
  }

  // 创建转换流
  return new Transform({
    transform(chunk: Buffer, encoding: BufferEncoding, callback) {
      try {
        const chunkStr = chunk.toString('utf-8');
        let transformed = chunkStr;

        // 根据转换类型应用转换
        if (transformType === 'openai') {
          const result = transformOpenAIChunkToAnthropic(chunkStr);
          transformed = result ?? chunkStr;
        } else if (transformType === 'gemini') {
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
      callback();
    },
  });
}
