/**
 * Codex 响应转换器单元测试
 *
 * 测试 OpenAI 格式的 Codex 响应到 Claude 响应的转换功能
 */

import { describe, it, expect } from 'vitest';
import { transformCodexResponseToClaude } from '../../../../src/promptxy/transformers/protocols/codex/response.js';

describe('Codex Response Transform', () => {
  describe('Responses Format (non-stream)', () => {
    it('should transform OpenAI Responses object to Claude message response', () => {
      const responsesObj = {
        id: 'resp_123',
        model: 'gpt-5.2-codex',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Hello from responses' }],
          },
        ],
        usage: {
          input_tokens: 10,
          input_tokens_details: { cached_tokens: 4 },
          output_tokens: 3,
          total_tokens: 13,
        },
      };

      const result = transformCodexResponseToClaude(responsesObj) as any;
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.id).toBe('resp_123');
      expect(result.model).toBe('gpt-5.2-codex');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Hello from responses');

      // usage input_tokens should subtract cached_tokens (CLIProxyAPI/codex-rs TokenUsage semantics)
      expect(result.usage).toBeDefined();
      expect(result.usage.input_tokens).toBe(6);
      expect(result.usage.cache_read_input_tokens).toBe(4);
      expect(result.usage.output_tokens).toBe(3);
    });

    it('should transform response.completed wrapper shape (codex-rs style)', () => {
      const wrapper = {
        type: 'response.completed',
        response: {
          id: 'resp_1',
          model: 'gpt-5.2-codex',
          output: [
            {
              type: 'function_call',
              call_id: 'call_1',
              name: 'short_tool',
              arguments: '{"a":1}',
            },
          ],
          usage: {
            input_tokens: 1,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: 2,
            total_tokens: 3,
          },
        },
      };

      const result = transformCodexResponseToClaude(wrapper, {
        reverseShortNameMap: { short_tool: 'mcp__very_long_server__tool_name' },
      }) as any;

      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('tool_use');
      expect(result.content[0].id).toBe('call_1');
      expect(result.content[0].name).toBe('mcp__very_long_server__tool_name');
      expect(result.content[0].input).toEqual({ a: 1 });
    });
  });
  describe('Stop Reason Mapping', () => {
    it('should map tool_calls to tool_use', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'test_tool',
                    arguments: '{"arg":"value"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.stop_reason).toBe('tool_use');
    });

    it('should map stop to end_turn', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello, how can I help?',
            },
            finish_reason: 'stop',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.stop_reason).toBe('end_turn');
    });

    it('should map length to max_tokens', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a long response...',
            },
            finish_reason: 'length',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.stop_reason).toBe('max_tokens');
    });

    it('should map content_filter to end_turn', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Filtered content',
            },
            finish_reason: 'content_filter',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.stop_reason).toBe('end_turn');
    });

    it('should map null finish_reason to end_turn', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Some content',
            },
            finish_reason: null,
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.stop_reason).toBe('end_turn');
    });

    it('should map unknown finish_reason to end_turn', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Some content',
            },
            finish_reason: 'unknown_reason',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.stop_reason).toBe('end_turn');
    });
  });

  describe('Text Content', () => {
    it('should transform text content', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello, how can I help you today?',
            },
            finish_reason: 'stop',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Hello, how can I help you today?');
    });

    it('should handle empty content', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
            },
            finish_reason: 'stop',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.content).toBe('');
    });
  });

  describe('Tool Calls', () => {
    it('should transform tool_calls to tool_use blocks', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_abc123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"San Francisco","units":"celsius"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('tool_use');
      expect(result.content[0].id).toBe('call_abc123');
      expect(result.content[0].name).toBe('get_weather');
      expect(result.content[0].input).toEqual({
        location: 'San Francisco',
        units: 'celsius',
      });
    });

    it('should handle multiple tool calls', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I will help you with that.',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"SF"}',
                  },
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: {
                    name: 'get_time',
                    arguments: '{"timezone":"UTC"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.content).toHaveLength(3); // text + 2 tool_use
      expect(result.content[0].type).toBe('text');
      expect(result.content[1].type).toBe('tool_use');
      expect(result.content[2].type).toBe('tool_use');
    });

    it('should handle invalid JSON in tool arguments', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'test_tool',
                    arguments: 'invalid json{{{',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      // 应该回退到空对象而不是抛出错误
      expect(result.content[0].type).toBe('tool_use');
      expect(result.content[0].input).toEqual({});
    });
  });

  describe('Usage Information', () => {
    it('should transform usage information', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response text',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.usage).toBeDefined();
      expect(result.usage.input_tokens).toBe(100);
      expect(result.usage.output_tokens).toBe(50);
    });

    it('should handle missing usage gracefully', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.usage).toBeUndefined();
    });
  });

  describe('Message Structure', () => {
    it('should create valid Claude message structure', () => {
      const openaiResponse = {
        id: 'chatcmpl_abc123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello!',
            },
            finish_reason: 'stop',
          },
        ],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result.id).toBe('chatcmpl_abc123');
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(Array.isArray(result.content)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null response', () => {
      const result = transformCodexResponseToClaude(null);
      expect(result).toBe(null);
    });

    it('should handle undefined response', () => {
      const result = transformCodexResponseToClaude(undefined);
      expect(result).toBe(undefined);
    });

    it('should handle response without choices', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result).toBeDefined();
    });

    it('should handle empty choices array', () => {
      const openaiResponse = {
        id: 'chatcmpl_123',
        choices: [],
      };

      const result = transformCodexResponseToClaude(openaiResponse) as any;

      expect(result).toBeDefined();
    });
  });
});
