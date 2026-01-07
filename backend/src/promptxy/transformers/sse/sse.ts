/**
 * SSE 通用工具
 *
 * 协议无关的 SSE parse/serialize
 */

import { Transform } from 'node:stream';

/**
 * SSE 事件
 */
export type SSEEvent = {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
};

/**
 * 解析 SSE chunk 为事件数组
 */
export function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = chunk.split('\n');

  let currentEvent: Partial<SSEEvent> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行表示事件结束
    if (trimmed === '') {
      if (currentEvent.data !== undefined) {
        events.push({
          event: currentEvent.event,
          data: currentEvent.data,
          id: currentEvent.id,
          retry: currentEvent.retry,
        });
      }
      currentEvent = {};
      continue;
    }

    // 解析字段
    if (trimmed.startsWith('event:')) {
      currentEvent.event = trimmed.slice(6).trim();
    } else if (trimmed.startsWith('data:')) {
      const dataContent = trimmed.slice(5).trim();
      if (currentEvent.data === undefined) {
        currentEvent.data = dataContent;
      } else {
        currentEvent.data += '\n' + dataContent;
      }
    } else if (trimmed.startsWith('id:')) {
      currentEvent.id = trimmed.slice(3).trim();
    } else if (trimmed.startsWith('retry:')) {
      const retry = trimmed.slice(6).trim();
      currentEvent.retry = parseInt(retry, 10);
    }
  }

  // 处理最后一个事件（如果没有空行结尾）
  if (currentEvent.data !== undefined) {
    events.push({
      event: currentEvent.event,
      data: currentEvent.data,
      id: currentEvent.id,
      retry: currentEvent.retry,
    });
  }

  return events;
}

/**
 * 序列化 SSE 事件为字符串
 */
export function serializeSSEEvent(event: SSEEvent): string {
  const lines: string[] = [];

  if (event.event) {
    lines.push(`event: ${event.event}`);
  }

  if (event.id) {
    lines.push(`id: ${event.id}`);
  }

  if (event.retry !== undefined) {
    lines.push(`retry: ${event.retry}`);
  }

  // data 可能包含多行
  const dataLines = event.data.split('\n');
  for (const line of dataLines) {
    lines.push(`data: ${line}`);
  }

  lines.push(''); // 空行表示事件结束

  return lines.join('\n');
}

/**
 * 判断是否为 SSE 响应
 */
export function isSSEResponse(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return contentType.includes('text/event-stream');
}

/**
 * 创建 SSE Transform Stream（用于 Node.js）
 */
export function createSSETransformStream(
  transformerName: string,
): Transform {
  // 创建一个 Node.js Transform stream
  return new Transform({
    transform(chunk: Buffer, encoding: BufferEncoding, callback) {
      try {
        // 目前简单透传，后续实现实际的转换
        this.push(chunk);
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}
