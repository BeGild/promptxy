/**
 * Gemini 协议转换单元测试 - 响应侧（非流式）
 */

import { describe, it, expect } from 'vitest';
import { transformGeminiResponseToClaude } from '../../../../src/promptxy/transformers/protocols/gemini/response.js';
import type { GeminiGenerateContentResponse } from '../../../../src/promptxy/transformers/protocols/gemini/types.js';

describe('Gemini Response Transform (Non-Streaming)', () => {
  it('should transform simple text response', () => {
    const geminiResponse: GeminiGenerateContentResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Hello! How can I help you today?' }],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 15,
        totalTokenCount: 25,
      },
    };

    const claudeResponse = transformGeminiResponseToClaude(geminiResponse, 'gemini-2.0-flash-exp');

    expect(claudeResponse.role).toBe('assistant');
    expect(claudeResponse.content).toEqual([
      { type: 'text', text: 'Hello! How can I help you today?' },
    ]);
    expect(claudeResponse.stop_reason).toBe('end_turn');
    expect(claudeResponse.usage).toEqual({
      input_tokens: 10,
      output_tokens: 15,
    });
  });

  it('should transform response with tool call', () => {
    const geminiResponse: GeminiGenerateContentResponse = {
      candidates: [
        {
          content: {
            parts: [
              { text: 'I will check the weather for you.' },
              {
                functionCall: {
                  name: 'get_weather',
                  args: { location: 'San Francisco, CA', unit: 'fahrenheit' },
                },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 20,
        candidatesTokenCount: 25,
        totalTokenCount: 45,
      },
    };

    const claudeResponse = transformGeminiResponseToClaude(geminiResponse);

    expect(claudeResponse.content).toHaveLength(2);
    expect(claudeResponse.content[0]).toEqual({
      type: 'text',
      text: 'I will check the weather for you.',
    });
    expect(claudeResponse.content[1]).toEqual({
      type: 'tool_use',
      id: expect.stringMatching(/^toolu_\d+_\d+$/),
      name: 'get_weather',
      input: { location: 'San Francisco, CA', unit: 'fahrenheit' },
    });
  });

  it('should consolidate adjacent text parts', () => {
    const geminiResponse: GeminiGenerateContentResponse = {
      candidates: [
        {
          content: {
            parts: [
              { text: 'Hello ' },
              { text: 'there! ' },
              { text: 'How are you?' },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    };

    const claudeResponse = transformGeminiResponseToClaude(geminiResponse);

    expect(claudeResponse.content).toEqual([
      { type: 'text', text: 'Hello there! How are you?' },
    ]);
  });

  it('should filter thought parts and consolidate text', () => {
    const geminiResponse: GeminiGenerateContentResponse = {
      candidates: [
        {
          content: {
            parts: [
              { text: 'Let me think about this.' },
              { thought: true },
              { text: 'Based on my analysis...' },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    };

    const claudeResponse = transformGeminiResponseToClaude(geminiResponse);

    // Thought part 应该被过滤，文本应该被合并
    expect(claudeResponse.content).toEqual([
      { type: 'text', text: 'Let me think about this.Based on my analysis...' },
    ]);
  });

  it('should map finish reasons correctly', () => {
    const testCases: Array<[string, string]> = [
      ['STOP', 'end_turn'],
      ['MAX_TOKENS', 'max_tokens'],
      ['SAFETY', 'stop_sequence'],
      ['MALFORMED_FUNCTION_CALL', 'end_turn'], // 降级为 end_turn
      ['LANGUAGE', 'stop_sequence'],
    ];

    for (const [geminiReason, expectedClaudeReason] of testCases) {
      const response: GeminiGenerateContentResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'Test' }] },
            finishReason: geminiReason as any,
          },
        ],
      };

      const result = transformGeminiResponseToClaude(response);
      expect(result.stop_reason).toBe(expectedClaudeReason);
    }
  });

  it('should handle missing usage metadata', () => {
    const geminiResponse: GeminiGenerateContentResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Hello!' }],
          },
          finishReason: 'STOP',
        },
      ],
    };

    const claudeResponse = transformGeminiResponseToClaude(geminiResponse);

    expect(claudeResponse.usage).toBeUndefined();
  });

  it('should generate unique tool_use_id for each tool call', () => {
    const geminiResponse: GeminiGenerateContentResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: 'tool1',
                  args: {},
                },
              },
              {
                functionCall: {
                  name: 'tool2',
                  args: {},
                },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    };

    const claudeResponse = transformGeminiResponseToClaude(geminiResponse);

    const tool1 = claudeResponse.content[0] as any;
    const tool2 = claudeResponse.content[1] as any;

    expect(tool1.type).toBe('tool_use');
    expect(tool2.type).toBe('tool_use');
    expect(tool1.id).not.toBe(tool2.id); // ID 应该不同
    expect(tool1.id).toMatch(/^toolu_/);
    expect(tool2.id).toMatch(/^toolu_/);
  });
});
