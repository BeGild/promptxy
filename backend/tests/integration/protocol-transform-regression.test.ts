/**
 * Protocol Transformation - Regression Tests
 *
 * 测试范围：
 * - 确保未启用 transformer 的 supplier 仍保持现有转发行为
 * - 验证向后兼容性
 * - 确保现有功能不受协议转换功能影响
 */

import { describe, it, expect } from 'vitest';
import { createProtocolTransformer } from '../../src/promptxy/transformers/llms-compat.js';
import type { TransformRequest } from '../../src/promptxy/transformers/types.js';

describe('Protocol Transformation - 回归测试', () => {
  describe('未配置 transformer 的透传行为', () => {
    const transformer = createProtocolTransformer();

    it('应直接透传 Anthropic 原始请求', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'claude-anthropic',
          name: 'Claude (Anthropic)',
          baseUrl: 'https://api.anthropic.com',
          // 没有 transformer 配置 - 应该透传
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: 'Hello, Claude!',
              },
            ],
          },
        },
      };

      const result = await transformer.transform(request);

      // 验证请求保持不变
      expect(result.request.method).toBe('POST');
      expect(result.request.path).toBe('/v1/messages');
      expect(result.request.body).toEqual(request.request.body);

      // 验证不需要响应转换
      expect(result.needsResponseTransform).toBe(false);

      // 验证 trace 包含警告
      expect(result.trace.warnings).toContain('未配置协议转换，直接透传请求');
    });

    it('应保持 OpenAI 格式请求不变（当目标为 OpenAI 时）', async () => {
      const openAIFormatRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
        temperature: 0.7,
      };

      const request: TransformRequest = {
        supplier: {
          id: 'openai-official',
          name: 'OpenAI Official',
          baseUrl: 'https://api.openai.com',
          // 没有 transformer 配置
        },
        request: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: {
            'content-type': 'application/json',
          },
          body: openAIFormatRequest,
        },
      };

      const result = await transformer.transform(request);

      // 验证请求保持完全不变
      expect(result.request.body).toEqual(openAIFormatRequest);
      expect(result.request.path).toBe('/v1/chat/completions');
      expect(result.needsResponseTransform).toBe(false);
    });

    it('应保持 Gemini 格式请求不变（当目标为 Gemini 时）', async () => {
      const geminiFormatRequest = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'What is the capital of France?' }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      };

      const request: TransformRequest = {
        supplier: {
          id: 'gemini-google',
          name: 'Gemini (Google)',
          baseUrl: 'https://generativelanguage.googleapis.com',
          // 没有 transformer 配置
        },
        request: {
          method: 'POST',
          path: '/v1beta/models/gemini-pro:generateContent',
          headers: {
            'content-type': 'application/json',
          },
          body: geminiFormatRequest,
        },
      };

      const result = await transformer.transform(request);

      // 验证请求保持完全不变
      expect(result.request.body).toEqual(geminiFormatRequest);
      expect(result.request.path).toBe('/v1beta/models/gemini-pro:generateContent');
      expect(result.needsResponseTransform).toBe(false);
    });
  });

  describe('上游认证注入的向后兼容性', () => {
    const transformer = createProtocolTransformer();

    it('应在没有 supplier.auth 时保持原始 headers', async () => {
      const originalHeaders = {
        'content-type': 'application/json',
        'custom-header': 'custom-value',
      };

      const request: TransformRequest = {
        supplier: {
          id: 'no-auth-supplier',
          name: 'No Auth Supplier',
          baseUrl: 'https://api.example.com',
          // 没有 auth 配置
        },
        request: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: originalHeaders,
          body: { model: 'test', messages: [] },
        },
      };

      const result = await transformer.transform(request);

      // headers 应保持不变（没有注入任何认证）
      expect(result.request.headers).toEqual(originalHeaders);
    });

    it('应正确注入上游认证而不影响其他 headers', async () => {
      const originalHeaders = {
        'content-type': 'application/json',
        'custom-header': 'custom-value',
      };

      const request: TransformRequest = {
        supplier: {
          id: 'with-auth-supplier',
          name: 'With Auth Supplier',
          baseUrl: 'https://api.deepseek.com',
          auth: {
            type: 'bearer',
            token: 'sk-deepseek-test-token',
          },
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: originalHeaders,
          body: { model: 'claude-sonnet-4', messages: [] },
        },
      };

      const result = await transformer.transform(request);

      // 验证认证被注入
      expect(result.request.headers['authorization']).toBe('Bearer sk-deepseek-test-token');

      // 验证其他 headers 保持不变
      expect(result.request.headers['content-type']).toBe('application/json');
      expect(result.request.headers['custom-header']).toBe('custom-value');
    });

    it('应使用 header 类型认证注入自定义 header', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'custom-auth-supplier',
          name: 'Custom Auth Supplier',
          baseUrl: 'https://api.example.com',
          auth: {
            type: 'header',
            headerName: 'x-custom-api-key',
            headerValue: 'my-custom-key-12345',
          },
        },
        request: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: { 'content-type': 'application/json' },
          body: { model: 'test', messages: [] },
        },
      };

      const result = await transformer.transform(request);

      // 验证自定义 header 被注入
      expect(result.request.headers['x-custom-api-key']).toBe('my-custom-key-12345');
    });
  });

  describe('边界情况和错误处理', () => {
    const transformer = createProtocolTransformer();

    it('应处理空的 messages 数组', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'test',
          name: 'Test',
          baseUrl: 'https://api.example.com',
          transformer: { default: ['deepseek'] },
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {},
          body: {
            model: 'claude-sonnet-4',
            max_tokens: 1024,
            messages: [],
          },
        },
      };

      const result = await transformer.transform(request);

      expect(result.trace.success).toBe(true);
      expect(result.request.body).toBeDefined();
    });

    it('应处理缺失的 model 字段', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'test',
          name: 'Test',
          baseUrl: 'https://api.example.com',
          transformer: { default: ['deepseek'] },
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {},
          body: {
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'Test' }],
          },
        },
      };

      const result = await transformer.transform(request);

      expect(result.trace.success).toBe(true);
      expect(result.request.body).toBeDefined();
    });

    it('应处理无效的转换器名称（透传请求）', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'test',
          name: 'Test',
          baseUrl: 'https://api.example.com',
          transformer: { default: ['nonexistent-transformer'] },
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {},
          body: {
            model: 'test',
            messages: [{ role: 'user', content: 'Test' }],
          },
        },
      };

      const result = await transformer.transform(request);

      // 无效的转换器会被忽略，请求被透传
      expect(result.trace.success).toBe(true);
      // 但会有警告
      expect(result.trace.warnings.length).toBeGreaterThan(0);
      expect(result.trace.warnings.some(w => w.includes('未知转换器') || w.includes('未知的转换器'))).toBe(true);
    });
  });

  describe('流式请求标记保持', () => {
    const transformer = createProtocolTransformer();

    it('应正确转换流式请求标记', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'test',
          name: 'Test',
          baseUrl: 'https://api.deepseek.com',
          transformer: { default: ['deepseek'] },
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {},
          body: {
            model: 'claude-sonnet-4',
            max_tokens: 1024,
            stream: true,
            messages: [{ role: 'user', content: 'Test' }],
          },
        },
        stream: true,
      };

      const result = await transformer.transform(request);

      const body = result.request.body as any;
      expect(body.stream).toBe(true);
      expect(result.needsResponseTransform).toBe(true);
    });

    it('应正确处理非流式请求', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'test',
          name: 'Test',
          baseUrl: 'https://api.deepseek.com',
          transformer: { default: ['deepseek'] },
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {},
          body: {
            model: 'claude-sonnet-4',
            max_tokens: 1024,
            stream: false,
            messages: [{ role: 'user', content: 'Test' }],
          },
        },
        stream: false,
      };

      const result = await transformer.transform(request);

      const body = result.request.body as any;
      expect(body.stream).toBe(false);
    });
  });

  describe('响应转换的向后兼容性', () => {
    const transformer = createProtocolTransformer();

    it('应在没有 transformer 时直接返回原始响应', async () => {
      const originalResponse = {
        id: 'msg-abc123',
        type: 'message',
        role: 'assistant',
        content: 'Hello! This is a direct response.',
        stop_reason: 'stop',
      };

      const result = await transformer.transformResponse(
        {
          id: 'test',
          name: 'Test',
          baseUrl: 'https://api.example.com',
          // 没有 transformer 配置
        },
        originalResponse,
        'application/json'
      );

      // 响应应该保持不变
      expect(result).toEqual(originalResponse);
    });

    it('应透传非 JSON 响应', async () => {
      const textResponse = 'Plain text response';

      const result = await transformer.transformResponse(
        {
          id: 'test',
          name: 'Test',
          baseUrl: 'https://api.example.com',
          transformer: { default: ['deepseek'] },
        },
        textResponse,
        'text/plain'
      );

      // 非 JSON 响应应该被透传
      expect(result).toEqual(textResponse);
    });

    it('应透传空响应', async () => {
      const emptyResponse = null;

      const result = await transformer.transformResponse(
        {
          id: 'test',
          name: 'Test',
          baseUrl: 'https://api.example.com',
          transformer: { default: ['deepseek'] },
        },
        emptyResponse,
        'application/json'
      );

      // 空响应应该被透传
      expect(result).toEqual(emptyResponse);
    });
  });

  describe('复杂请求结构保持', () => {
    const transformer = createProtocolTransformer();

    it('应保持嵌套的 content blocks 结构（无转换时）', async () => {
      const complexContent = [
        { type: 'text', text: 'First part' },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: 'base64encodeddata...',
          },
        },
        { type: 'text', text: 'Second part' },
      ];

      const request: TransformRequest = {
        supplier: {
          id: 'test',
          name: 'Test',
          baseUrl: 'https://api.anthropic.com',
          // 没有 transformer 配置
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {},
          body: {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content: complexContent,
              },
            ],
          },
        },
      };

      const result = await transformer.transform(request);

      // 验证复杂结构保持不变
      expect(result.request.body).toEqual(request.request.body);
    });
  });
});
