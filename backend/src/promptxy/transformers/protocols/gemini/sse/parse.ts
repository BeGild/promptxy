/**
 * Gemini SSE 解析
 *
 * Gemini SSE 特点：
 * - 使用标准 SSE 格式 (data: JSON)
 * - 流式: streamGenerateContent?alt=sse
 */

import type { GeminiSSEChunk } from '../types.js';

/**
 * 解析 SSE chunk 为 Gemini 事件
 */
export function parseGeminiSSEChunk(chunk: string): GeminiSSEChunk[] {
  const chunks: GeminiSSEChunk[] = [];

  // SSE 格式: "data: {...}\n\n"
  const lines = chunk.split('\n');
  let currentData = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('data:')) {
      const dataContent = trimmed.slice(5).trim();

      // 跳过空 data
      if (!dataContent) {
        continue;
      }

      // 跳过 [DONE] 标记
      if (dataContent === '[DONE]') {
        currentData = '';
        continue;
      }

      currentData = dataContent;
    } else if (trimmed === '' && currentData) {
      // 空行表示事件结束，解析并重置
      try {
        const chunkData = JSON.parse(currentData) as GeminiSSEChunk;
        chunks.push(chunkData);
      } catch (e) {
        // 忽略解析错误
      }
      currentData = '';
    }
  }

  // 处理最后一个没有空行结尾的事件
  if (currentData) {
    try {
      const chunkData = JSON.parse(currentData) as GeminiSSEChunk;
      chunks.push(chunkData);
    } catch (e) {
      // 忽略解析错误
    }
  }

  return chunks;
}

/**
 * 判断是否为 Gemini SSE 响应
 */
export function isGeminiSSEResponse(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return contentType.includes('text/event-stream');
}
