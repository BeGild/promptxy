/**
 * Codex Responses SSE 解析
 *
 * 参考: refence/codex/codex-rs/codex-api/src/sse/responses.rs
 */

import type { CodexSSEEvent } from '../types.js';

/**
 * 解析 SSE chunk 为 Codex 事件
 *
 * Codex SSE 特点：
 * - 以 data JSON 的 `type` 字段分发事件（不依赖 event: 行）
 * - data 必须是有效的 JSON
 */
export function parseCodexSSEChunk(chunk: string): CodexSSEEvent[] {
  const events: CodexSSEEvent[] = [];

  // SSE 格式: "data: {...}\n\n"
  const lines = chunk.split('\n');
  let currentData = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('data:')) {
      const dataContent = trimmed.slice(5).trim();

      // [DONE] 表示流结束
      if (dataContent === '[DONE]') {
        continue;
      }

      currentData = dataContent;

      // 尝试解析 JSON
      try {
        const event = JSON.parse(currentData) as CodexSSEEvent;
        events.push(event);
      } catch (e) {
        // JSON 解析失败，可能是分块传输，继续累积
        // 这里简化处理，实际应该处理多行 JSON
      }
    } else if (trimmed === '' && currentData) {
      // 空行表示事件结束
      try {
        const event = JSON.parse(currentData) as CodexSSEEvent;
        events.push(event);
      } catch (e) {
        // 忽略解析错误
      }
      currentData = '';
    }
  }

  return events;
}

/**
 * 判断是否为 Codex SSE 响应
 */
export function isCodexSSEResponse(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return contentType.includes('text/event-stream') ||
    contentType.includes('text/event-stream');
}

/**
 * 从 SSE 流中提取事件的 type 字段
 */
export function getEventType(event: CodexSSEEvent): string {
  return (event as any).type || '';
}

/**
 * 判断是否为流结束事件
 */
export function isStreamEndEvent(event: CodexSSEEvent): boolean {
  return event.type === 'response.completed' ||
    event.type === 'response.failed';
}
