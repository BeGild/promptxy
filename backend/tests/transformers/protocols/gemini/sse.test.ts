/**
 * Gemini 协议转换单元测试 - SSE 流式转换
 */

import { describe, it, expect } from 'vitest';
import {
  parseGeminiSSEChunk,
  transformGeminiSSEToClaude,
  transformGeminiSSEWithRetry,
  createTraceSummary,
  isTransformSuccessful,
} from '../../../../src/promptxy/transformers/protocols/gemini/sse/index.js';
import type { GeminiSSEChunk } from '../../../../src/promptxy/transformers/protocols/gemini/types.js';

describe('Gemini SSE Parse', () => {
  it('should parse SSE chunk with data line', () => {
    const chunk = 'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n';

    const parsed = parseGeminiSSEChunk(chunk);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].candidates?.[0].content?.parts?.[0]).toEqual({
      text: 'Hello',
    });
  });

  it('should parse multiple SSE chunks', () => {
    const chunk =
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}]}\n\n';

    const parsed = parseGeminiSSEChunk(chunk);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].candidates?.[0].content?.parts?.[0].text).toBe('Hello');
    expect(parsed[1].candidates?.[0].content?.parts?.[0].text).toBe(' world');
  });

  it('should ignore [DONE] marker', () => {
    const chunk = 'data: [DONE]\n\n';

    const parsed = parseGeminiSSEChunk(chunk);

    expect(parsed).toHaveLength(0);
  });
});

describe('Gemini SSE Transform to Claude', () => {
  it('should transform simple text streaming', () => {
    const chunks: GeminiSSEChunk[] = [
      {
        candidates: [
          {
            content: { parts: [{ text: 'Hello' }] },
          },
        ],
      },
      {
        candidates: [
          {
            content: { parts: [{ text: ' there' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      },
    ];

    const result = transformGeminiSSEToClaude(chunks);

    expect(result.events.length).toBeGreaterThan(0);

    // 验证事件序列
    const eventTypes = result.events.map((e) => e.type);
    expect(eventTypes).toContain('message_start');
    expect(eventTypes).toContain('content_block_delta');

    // 验证最终有 message_stop
    expect(eventTypes[eventTypes.length - 1]).toBe('message_stop');
  });

  it('should transform tool call streaming', () => {
    const chunks: GeminiSSEChunk[] = [
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'get_weather',
                    args: { location: 'San Francisco' },
                  },
                },
              ],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    args: { unit: 'fahrenheit' },
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          candidatesTokenCount: 10,
        },
      },
    ];

    const result = transformGeminiSSEToClaude(chunks);

    // 验证有 tool_use 相关事件
    const hasToolUse = result.events.some(
      (e) =>
        e.type === 'content_block_start' &&
        'content_block' in e &&
        e.content_block?.type === 'tool_use'
    );
    expect(hasToolUse).toBe(true);
  });

  it('should handle fragmented function call args', () => {
    const chunks: GeminiSSEChunk[] = [
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'test_tool',
                    args: { param1: 'value1' },
                  },
                },
              ],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    args: { param2: 'value2' }, // 分片到达
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      },
    ];

    const result = transformGeminiSSEToClaude(chunks);

    // 验证只有一个 tool_use block
    const toolUseStarts = result.events.filter(
      (e) =>
        e.type === 'content_block_start' &&
        'content_block' in e &&
        e.content_block?.type === 'tool_use'
    );
    expect(toolUseStarts).toHaveLength(1);
  });

  it('should filter thought parts in streaming', () => {
    const chunks: GeminiSSEChunk[] = [
      {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Let me think' },
                { thought: true },
                { text: 'Here is my answer' },
              ],
            },
          },
        ],
      },
    ];

    const result = transformGeminiSSEToClaude(chunks);

    // 验证 text delta 事件不包含 thought
    const textDeltas = result.events.filter((e) => e.type === 'content_block_delta');
    expect(textDeltas.length).toBeGreaterThan(0);
  });

  it('should detect and handle invalid stream', () => {
    const chunks: GeminiSSEChunk[] = [
      {
        candidates: [
          {
            content: { parts: [] }, // 空响应
          },
        ],
      },
    ];

    const result = transformGeminiSSEToClaude(chunks);

    // 应该有错误事件
    const hasError = result.events.some((e) => e.type === 'error');
    expect(hasError).toBe(true);
  });
});

describe('Gemini SSE Transform with Retry', () => {
  it('should not retry when stream is valid', () => {
    const chunks: GeminiSSEChunk[] = [
      {
        candidates: [
          {
            content: { parts: [{ text: 'Hello' }] },
            finishReason: 'STOP',
          },
        ],
      },
    ];

    const result = transformGeminiSSEWithRetry(chunks, {
      enableRetry: true,
      maxAttempts: 2,
    });

    expect(result.trace.retried).toBe(false);
    expect(result.trace.retryCount).toBe(0);
    expect(isTransformSuccessful(result.trace)).toBe(true);
  });

  it('should detect invalid stream and mark for retry', () => {
    const chunks: GeminiSSEChunk[] = [
      {
        candidates: [
          {
            content: { parts: [] }, // 无内容
          },
        ],
      },
    ];

    const result = transformGeminiSSEWithRetry(chunks, {
      enableRetry: true,
    });

    // 应该检测到需要重试
    expect(result.trace.retried).toBe(true);
    expect(result.trace.retryReason).toBeDefined();
  });

  it('should create trace summary', () => {
    const trace = {
      retried: true,
      retryReason: 'EMPTY_RESPONSE',
      retryCount: 1,
      eventsGenerated: 2,
      streamEnded: true,
      originalError: 'Invalid stream',
    };

    const summary = createTraceSummary(trace);

    expect(summary).toContain('retried=true');
    expect(summary).toContain('retry_reason=EMPTY_RESPONSE');
    expect(summary).toContain('retry_count=1');
    expect(summary).toContain('original_error=Invalid stream');
  });

  it('should identify unsuccessful transformation', () => {
    const failedTrace = {
      retried: false,
      retryCount: 0,
      eventsGenerated: 0, // 无事件
      streamEnded: false,
    };

    expect(isTransformSuccessful(failedTrace)).toBe(false);

    const errorTrace = {
      retried: false,
      retryCount: 0,
      eventsGenerated: 2,
      streamEnded: false,
      originalError: 'Some error',
    };

    expect(isTransformSuccessful(errorTrace)).toBe(false);
  });
});
