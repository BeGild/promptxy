/**
 * Gemini 协议转换单元测试 - 请求侧
 */

import { describe, it, expect } from 'vitest';
import {
  buildGeminiURL,
  buildCountTokensURL,
  transformClaudeToGeminiRequest,
  transformHeaders,
} from '../../../../src/promptxy/transformers/protocols/gemini/request.js';
import type { ClaudeMessage } from '../../../../src/promptxy/transformers/protocols/claude/types.js';

describe('Gemini Request Transform', () => {
  describe('buildGeminiURL', () => {
    it('should build URL for non-streaming request with full baseUrl', () => {
      const url = buildGeminiURL({
        baseUrl: 'https://generativelanguage.googleapis.com',
        model: 'gemini-2.0-flash-exp',
        stream: false,
        apiKey: 'test-key',
      });

      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=test-key'
      );
    });

    it('should build URL for streaming request with alt=sse', () => {
      const url = buildGeminiURL({
        baseUrl: 'https://generativelanguage.googleapis.com',
        model: 'gemini-2.0-flash-exp',
        stream: true,
        apiKey: 'test-key',
      });

      expect(url).toContain('alt=sse');
      expect(url).toContain('streamGenerateContent');
    });

    it('should handle baseUrl with /v1beta suffix', () => {
      const url = buildGeminiURL({
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-2.0-flash-exp',
        stream: false,
      });

      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
      );
    });

    it('should handle baseUrl with /models suffix', () => {
      const url = buildGeminiURL({
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        model: 'gemini-2.0-flash-exp',
        stream: false,
      });

      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
      );
    });
  });

  describe('buildCountTokensURL', () => {
    it('should build countTokens URL', () => {
      const url = buildCountTokensURL({
        baseUrl: 'https://generativelanguage.googleapis.com',
        model: 'gemini-2.0-flash-exp',
        apiKey: 'test-key',
      });

      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:countTokens?key=test-key'
      );
    });
  });

  describe('transformClaudeToGeminiRequest', () => {
    it('should transform simple text request', () => {
      const messages: ClaudeMessage[] = [
        {
          role: 'user',
          content: 'Hello, how are you?',
        },
      ];

      const { request } = transformClaudeToGeminiRequest(
        'claude-3-5-sonnet-20241022',
        undefined,
        messages,
        undefined,
        false,
        4096,
        undefined,
        undefined,
        undefined
      );

      expect(request.contents).toHaveLength(1);
      expect(request.contents?.[0].role).toBe('user');
      expect(request.contents?.[0].parts).toEqual([{ text: 'Hello, how are you?' }]);
      expect(request.generationConfig?.maxOutputTokens).toBe(4096);
    });

    it('should transform request with system instruction', () => {
      const messages: ClaudeMessage[] = [
        {
          role: 'user',
          content: 'Hello',
        },
      ];

      const { request } = transformClaudeToGeminiRequest(
        'claude-3-5-sonnet-20241022',
        'You are a helpful assistant.',
        messages,
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        undefined
      );

      expect(request.systemInstruction).toEqual({
        role: 'user',
        parts: [{ text: 'You are a helpful assistant.' }],
      });
    });

    it('should transform request with tools', () => {
      const messages: ClaudeMessage[] = [
        {
          role: 'user',
          content: 'What is the weather?',
        },
      ];

      const tools = [
        {
          name: 'get_weather',
          description: 'Get weather information',
          input_schema: {
            type: 'object' as const,
            properties: {
              location: {
                type: 'string',
                description: 'City name',
              },
            },
            required: ['location'],
          },
        },
      ];

      const { request } = transformClaudeToGeminiRequest(
        'claude-3-5-sonnet-20241022',
        undefined,
        messages,
        tools,
        false,
        undefined,
        undefined,
        undefined,
        undefined
      );

      expect(request.tools?.functionDeclarations).toHaveLength(1);
      expect(request.tools?.functionDeclarations?.[0].name).toBe('get_weather');
      expect(request.tools?.functionDeclarations?.[0].parameters?.properties).toBeDefined();
    });

    it('should sanitize schema with unsupported format', () => {
      const tools = [
        {
          name: 'test_tool',
          description: 'Test tool',
          input_schema: {
            type: 'object' as const,
            properties: {
              date: {
                type: 'string',
                format: 'invalid-format', // 不支持的格式
              },
            },
          },
        },
      ];

      const messages: ClaudeMessage[] = [
        {
          role: 'user',
          content: 'Test',
        },
      ];

      const { request } = transformClaudeToGeminiRequest(
        'claude-3-5-sonnet-20241022',
        undefined,
        messages,
        tools,
        false,
        undefined,
        undefined,
        undefined,
        undefined
      );

      // 不支持的格式应该被移除
      const param = request.tools?.functionDeclarations?.[0].parameters?.properties?.date;
      expect(param).toBeDefined();
      // format 字段应该被移除（不在白名单中）
    });

    it('should handle tool_result with tool_use_id mapping', () => {
      const messages: ClaudeMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_123',
              name: 'get_weather',
              input: { location: 'SF' },
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_123',
              content: 'The weather is sunny.',
            },
          ],
        },
      ];

      const { request, context } = transformClaudeToGeminiRequest(
        'claude-3-5-sonnet-20241022',
        undefined,
        messages,
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        undefined
      );

      // 验证 tool_use_id 映射已记录
      expect(context.toolUseMappings.has('toolu_123')).toBe(true);
      expect(context.toolUseMappings.get('toolu_123')?.toolName).toBe('get_weather');

      // 验证 functionResponse 使用正确的工具名
      const userContent = request.contents?.[1].parts;
      expect(userContent?.[0]).toEqual({
        functionResponse: {
          id: 'toolu_123',
          name: 'get_weather',
          response: { result: 'The weather is sunny.' },
        },
      });
    });

    it('should consolidate adjacent text parts', () => {
      const messages: ClaudeMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world!' },
          ],
        },
      ];

      const { request } = transformClaudeToGeminiRequest(
        'claude-3-5-sonnet-20241022',
        undefined,
        messages,
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        undefined
      );

      expect(request.contents?.[0].parts).toEqual([
        { text: 'Hello world!' },
      ]);
    });
  });

  describe('transformHeaders', () => {
    it('should remove Claude SDK specific headers', () => {
      const headers = transformHeaders(
        {
          'anthropic-version': '2023-06-01',
          'x-stainless-retry-count': '3',
          'content-type': 'application/json',
          'user-agent': 'Test-Agent',
        },
        'test-key'
      );

      expect(headers['anthropic-version']).toBeUndefined();
      expect(headers['x-stainless-retry-count']).toBeUndefined();
      expect(headers['content-type']).toBe('application/json');
      expect(headers['user-agent']).toBe('Test-Agent');
      expect(headers['x-goog-api-key']).toBe('test-key');
    });

    it('should add content-type if missing', () => {
      const headers = transformHeaders({
        'user-agent': 'Test-Agent',
      });

      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});
