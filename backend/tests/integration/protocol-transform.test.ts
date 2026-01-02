/**
 * Protocol Transformation Integration Tests
 *
 * 测试范围：
 * - 完整的协议转换流程（Anthropic ↔ OpenAI compatible）
 * - 工具调用（tools）的转换
 * - 流式（SSE）响应的转换
 * - Trace 生成与验证
 */

import { describe, it, expect } from 'vitest';
import { createProtocolTransformer } from '../../src/promptxy/transformers/llms-compat.js';
import type { TransformRequest } from '../../src/promptxy/transformers/types.js';
import type { TransformerConfig } from '../../src/promptxy/types.js';

describe('Protocol Transformation - 集成测试', () => {
  describe('Anthropic → DeepSeek (OpenAI compatible)', () => {
    const transformer = createProtocolTransformer();

    const createBaseRequest = (): TransformRequest => ({
      supplier: {
        id: 'deepseek-test',
        name: 'DeepSeek Test',
        baseUrl: 'https://api.deepseek.com',
        auth: {
          type: 'bearer',
          token: 'sk-test-token',
        },
        transformer: {
          default: ['deepseek'],
        },
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
              content: 'Hello, how are you?',
            },
          ],
        },
      },
      stream: false,
    });

    it('应转换简单的 Anthropic Messages 请求到 DeepSeek 格式', async () => {
      const request = createBaseRequest();
      const result = await transformer.transform(request);

      expect(result.trace.success).toBe(true);
      expect(result.trace.supplierId).toBe('deepseek-test');
      expect(result.trace.chainType).toBe('default');
      expect(result.trace.chain).toEqual(['deepseek']);

      // 验证转换后的请求
      expect(result.request.method).toBe('POST');
      expect(result.request.path).toBe('/chat/completions');

      const body = result.request.body as any;
      expect(body.model).toBe('claude-sonnet-4-20250514');
      expect(body.max_tokens).toBe(1024);
      expect(body.messages).toEqual([
        { role: 'user', content: 'Hello, how are you?' },
      ]);

      // 验证上游认证已注入
      expect(result.request.headers['authorization']).toBe('Bearer sk-test-token');
    });

    it('应转换包含工具调用的 Anthropic 请求', async () => {
      const request = createBaseRequest();
      (request.request.body as any).tools = [
        {
          name: 'get_weather',
          description: 'Get the current weather',
          input_schema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      ];

      const result = await transformer.transform(request);

      const body = result.request.body as any;
      expect(body.tools).toBeDefined();
      expect(body.tools).toHaveLength(1);
      expect(body.tools[0].type).toBe('function');
      expect(body.tools[0].function.name).toBe('get_weather');
      expect(body.tools[0].function.parameters).toEqual({
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
        required: ['location'],
      });
    });

    it('应转换包含 tool_result 的消息', async () => {
      const request = createBaseRequest();
      (request.request.body as any).messages = [
        {
          role: 'user',
          content: 'What is the weather in Tokyo?',
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_abc123',
              name: 'get_weather',
              input: { location: 'Tokyo' },
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_abc123',
              content: 'The weather in Tokyo is 22°C',
            },
          ],
        },
      ];

      const result = await transformer.transform(request);

      const body = result.request.body as any;
      expect(body.messages).toHaveLength(3);

      // 验证 tool_use 转换为 tool_calls
      expect(body.messages[1].role).toBe('assistant');
      expect(body.messages[1].tool_calls).toBeDefined();
      expect(body.messages[1].tool_calls).toHaveLength(1);
      expect(body.messages[1].tool_calls[0].id).toBe('toolu_abc123');
      expect(body.messages[1].tool_calls[0].type).toBe('function');
      expect(body.messages[1].tool_calls[0].function.name).toBe('get_weather');
      expect(body.messages[1].tool_calls[0].function.arguments).toBe(
        JSON.stringify({ location: 'Tokyo' })
      );

      // 验证 tool_result 转换为 tool 消息
      expect(body.messages[2].role).toBe('tool');
      expect(body.messages[2].tool_call_id).toBe('toolu_abc123');
      expect(body.messages[2].content).toBe('The weather in Tokyo is 22°C');
    });

    it('应正确转换流式请求标记', async () => {
      const request = createBaseRequest();
      (request.request.body as any).stream = true;
      request.stream = true;

      const result = await transformer.transform(request);

      const body = result.request.body as any;
      expect(body.stream).toBe(true);
      expect(result.needsResponseTransform).toBe(true);
    });
  });

  describe('DeepSeek → Anthropic 响应转换', () => {
    const transformer = createProtocolTransformer();

    it('应转换简单的 DeepSeek 响应到 Anthropic 格式', async () => {
      const deepseekResponse = {
        id: 'chatcmpl-abc123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'claude-sonnet-4-20250514',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! I am doing well, thank you for asking.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      const result = await transformer.transformResponse(
        {
          id: 'deepseek-test',
          name: 'DeepSeek Test',
          baseUrl: 'https://api.deepseek.com',
          transformer: {
            default: ['deepseek'],
          },
        },
        deepseekResponse,
        'application/json'
      );

      const response = result as any;
      expect(response.id).toBe('chatcmpl-abc123');
      expect(response.type).toBe('message');
      expect(response.role).toBe('assistant');
      // Anthropic 格式：content 可以是字符串（单文本块）或数组（多块）
      if (typeof response.content === 'string') {
        expect(response.content).toBe('Hello! I am doing well, thank you for asking.');
      } else if (Array.isArray(response.content)) {
        expect(response.content).toHaveLength(1);
        expect(response.content[0].type).toBe('text');
        expect(response.content[0].text).toBe('Hello! I am doing well, thank you for asking.');
      }
      expect(response.stop_reason).toBe('stop');
    });

    it('应转换包含 tool_calls 的响应', async () => {
      const deepseekResponse = {
        id: 'chatcmpl-xyz789',
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
                    arguments: '{"location":"Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      const result = await transformer.transformResponse(
        {
          id: 'deepseek-test',
          name: 'DeepSeek Test',
          baseUrl: 'https://api.deepseek.com',
          transformer: {
            default: ['deepseek'],
          },
        },
        deepseekResponse,
        'application/json'
      );

      const response = result as any;
      expect(response.content).toBeDefined();
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('tool_use');
      expect(response.content[0].id).toBe('call_abc123');
      expect(response.content[0].name).toBe('get_weather');
      expect(response.content[0].input).toEqual({ location: 'Tokyo' });
      expect(response.stop_reason).toBe('tool_calls');
    });
  });

  describe('模型特定覆盖链', () => {
    const transformer = createProtocolTransformer();

    it('应使用模型特定的转换链', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'multi-transformer-test',
          name: 'Multi Transformer Test',
          baseUrl: 'https://api.example.com',
          transformer: {
            default: ['deepseek'],
            models: {
              'gpt-4': ['deepseek', 'tooluse'],
            },
          },
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {},
          body: {
            model: 'gpt-4',
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'Test' }],
          },
        },
      };

      const result = await transformer.transform(request);

      expect(result.trace.chainType).toBe('gpt-4');
      expect(result.trace.chain).toEqual(['deepseek', 'tooluse']);
    });

    it('应回退到 default 链当模型没有匹配时', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'multi-transformer-test',
          name: 'Multi Transformer Test',
          baseUrl: 'https://api.example.com',
          transformer: {
            default: ['deepseek'],
            models: {
              'gpt-4': ['deepseek', 'tooluse'],
            },
          },
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {},
          body: {
            model: 'claude-sonnet-4',
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'Test' }],
          },
        },
      };

      const result = await transformer.transform(request);

      expect(result.trace.chainType).toBe('default');
      expect(result.trace.chain).toEqual(['deepseek']);
    });
  });

  describe('Trace 生成', () => {
    const transformer = createProtocolTransformer();

    it('应生成完整的转换 trace', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'trace-test',
          name: 'Trace Test',
          baseUrl: 'https://api.example.com',
          transformer: {
            default: ['deepseek', 'tooluse'],
          },
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {
            'authorization': 'Bearer sk-test-token',
            'x-api-key': 'key-test',
          },
          body: {
            model: 'claude-sonnet-4',
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'Test' }],
          },
        },
      };

      const result = await transformer.transform(request);

      // 验证 trace 结构
      expect(result.trace.supplierId).toBe('trace-test');
      expect(result.trace.supplierName).toBe('Trace Test');
      expect(result.trace.chainType).toBe('default');
      expect(result.trace.chain).toEqual(['deepseek', 'tooluse']);
      expect(result.trace.steps).toHaveLength(2);
      expect(result.trace.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.trace.success).toBe(true);
      expect(result.trace.errors).toHaveLength(0);

      // 验证鉴权头检测（仅名称，不包含值）
      expect(result.trace.authHeaderDetected).toBeDefined();
      expect(result.trace.authHeaderDetected).toContain('authorization');
      expect(result.trace.authHeaderDetected).toContain('x-api-key');
    });

    it('应记录转换步骤的详细信息', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'step-trace-test',
          name: 'Step Trace Test',
          baseUrl: 'https://api.example.com',
          transformer: {
            default: ['deepseek', 'tooluse'],
          },
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {},
          body: {
            model: 'claude-sonnet-4',
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'Test' }],
          },
        },
      };

      const result = await transformer.transform(request);

      // 验证每个步骤
      expect(result.trace.steps).toHaveLength(2);

      const step1 = result.trace.steps[0];
      expect(step1.name).toBe('deepseek');
      expect(step1.success).toBe(true);
      expect(step1.duration).toBeGreaterThanOrEqual(0);

      const step2 = result.trace.steps[1];
      expect(step2.name).toBe('tooluse');
      expect(step2.success).toBe(true);
      expect(step2.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('未配置 transformer 的透传行为', () => {
    const transformer = createProtocolTransformer();

    it('应直接透传请求当未配置 transformer 时', async () => {
      const request: TransformRequest = {
        supplier: {
          id: 'passthrough-test',
          name: 'Passthrough Test',
          baseUrl: 'https://api.anthropic.com',
          // 没有 transformer 配置
        },
        request: {
          method: 'POST',
          path: '/v1/messages',
          headers: {
            'content-type': 'application/json',
          },
          body: {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'Test' }],
          },
        },
      };

      const result = await transformer.transform(request);

      // 请求应保持不变
      expect(result.request.method).toBe('POST');
      expect(result.request.path).toBe('/v1/messages');
      expect(result.request.body).toEqual(request.request.body);

      // Trace 应显示警告
      expect(result.trace.warnings).toContain('未配置协议转换，直接透传请求');

      // 不需要响应转换
      expect(result.needsResponseTransform).toBe(false);
    });
  });
});
