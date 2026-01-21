/**
 * Codex 渲染器单元测试
 *
 * 测试 Claude 请求到 Codex 请求的转换功能
 */

import { describe, it, expect } from 'vitest';
import { renderCodexRequest } from '../../../../src/promptxy/transformers/protocols/codex/render.js';
import type { FieldAuditCollector } from '../../../../src/promptxy/transformers/audit/field-audit.js';

// 简单的 audit collector mock
function createMockAudit(): FieldAuditCollector {
  return {
    addDefaulted: () => {},
    addDiff: () => {},
    setMetadata: () => {},
    addMissingRequiredTargetPaths: () => {},
  };
}

describe('Codex Render', () => {
  describe('Image Content', () => {
    it('should transform image block to input_image item', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'text',
                text: 'What is in this image?',
              },
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: 'https://example.com/image.png',
                },
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: 'You are a helpful assistant.' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      // 验证 input 包含 image
      const messageItems = result.input.filter(item => item.type === 'message');
      expect(messageItems.length).toBeGreaterThan(0);

      // 查找包含 input_image 的消息
      const imageMessage = messageItems.find(item =>
        item.type === 'message' &&
        item.content.some((c: any) => c.type === 'input_image')
      );
      expect(imageMessage).toBeDefined();

      if (imageMessage && imageMessage.type === 'message') {
        const imageContent = imageMessage.content.find((c: any) => c.type === 'input_image');
        expect(imageContent).toBeDefined();
        expect(imageContent.source).toEqual({
          type: 'url',
          url: 'https://example.com/image.png',
        });
      }
    });

    it('should handle base64 data URL images', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
                },
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: 'You are a helpful assistant.' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      // 验证 input 包含 base64 图片
      const messageItems = result.input.filter(item => item.type === 'message');
      const imageMessage = messageItems.find((item: any) =>
        item.content.some((c: any) => c.type === 'input_image')
      );

      expect(imageMessage).toBeDefined();
    });

    it('should handle multiple images in separate blocks', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: 'https://example.com/image1.png',
                },
              },
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: 'https://example.com/image2.png',
                },
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: 'You are a helpful assistant.' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      // 应该有两个包含图片的消息项
      const messageItems = result.input.filter(item => item.type === 'message');
      const imageMessages = messageItems.filter((item: any) =>
        item.content.some((c: any) => c.type === 'input_image')
      );

      expect(imageMessages.length).toBe(2);
    });

    it('should handle mixed text and image blocks', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'text',
                text: 'Look at this image:',
              },
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: 'https://example.com/image.png',
                },
              },
              {
                type: 'text',
                text: 'What do you see?',
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: 'You are a helpful assistant.' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      // 验证所有 block 都被正确转换
      const messageItems = result.input.filter((item: any) => item.type === 'message');
      expect(messageItems.length).toBe(3); // 3 个独立的 message items

      // 验证文本和图片都存在
      const textItems = messageItems.filter((item: any) =>
        item.content.some((c: any) => c.type === 'input_text' || c.type === 'output_text')
      );
      expect(textItems.length).toBe(2);

      const imageItems = messageItems.filter((item: any) =>
        item.content.some((c: any) => c.type === 'input_image')
      );
      expect(imageItems.length).toBe(1);
    });
  });

  describe('Text Content', () => {
    it('should transform text blocks to message items', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'text',
                text: 'Hello, how are you?',
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: 'You are a helpful assistant.' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      expect(result.input.length).toBe(1);
      const firstItem = result.input[0];
      expect(firstItem.type).toBe('message');
      if (firstItem.type === 'message') {
        expect(firstItem.role).toBe('user');
        expect(firstItem.content[0].type).toBe('input_text');
        expect(firstItem.content[0].text).toBe('Hello, how are you?');
      }
    });

    it('should use output_text for assistant role', () => {
      const messages = [
        {
          role: 'assistant' as const,
          content: {
            blocks: [
              {
                type: 'text',
                text: 'I am doing well!',
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: '' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      const firstItem = result.input[0];
      if (firstItem.type === 'message') {
        expect(firstItem.content[0].type).toBe('output_text');
      }
    });
  });

  describe('Tool Calls', () => {
    it('should transform tool_use blocks to function_call items', () => {
      const messages = [
        {
          role: 'assistant' as const,
          content: {
            blocks: [
              {
                type: 'tool_use',
                id: 'toolu_123',
                name: 'get_weather',
                input: { location: 'San Francisco' },
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: '' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      const toolItem = result.input[0];
      expect(toolItem.type).toBe('function_call');
      if (toolItem.type === 'function_call') {
        expect(toolItem.call_id).toBe('toolu_123');
        expect(toolItem.name).toBe('get_weather');
        expect(toolItem.arguments).toBe(JSON.stringify({ location: 'San Francisco' }));
      }
    });
  });

  describe('Tool Results', () => {
    it('should transform tool_result blocks to function_call_output items', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_123',
                content: 'The weather is sunny.',
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: '' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      const outputItem = result.input[0];
      expect(outputItem.type).toBe('function_call_output');
      if (outputItem.type === 'function_call_output') {
        expect(outputItem.call_id).toBe('toolu_123');
        expect(outputItem.output).toBe('The weather is sunny.');
      }
    });

    it('should stringify non-string tool_result content', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_123',
                content: { result: 'data', value: 42 },
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: '' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      const outputItem = result.input[0];
      if (outputItem.type === 'function_call_output') {
        expect(typeof outputItem.output).toBe('string');
        expect(outputItem.output).toBe('{"result":"data","value":42}');
      }
    });

    it('should fill output when tool_result.content is missing', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_missing',
                // content intentionally missing
              } as any,
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: '' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      const outputItem = result.input[0];
      expect(outputItem.type).toBe('function_call_output');
      if (outputItem.type === 'function_call_output') {
        expect(outputItem.call_id).toBe('toolu_missing');
        expect(typeof outputItem.output).toBe('string');
        expect((outputItem.output as string)).toContain('tool_result.content missing');
      }
    });
  });

  describe('Tools', () => {
    it('should transform Claude tools to Codex tools', () => {
      const tools = [
        {
          name: 'get_weather',
          description: 'Get weather information',
          inputSchema: {
            type: 'object' as const,
            properties: {
              location: {
                type: 'string',
              },
            },
            required: ['location'],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: '' },
          messages: [],
          tools,
          stream: true,
        },
        {},
        createMockAudit()
      );

      expect(result.tools.length).toBe(1);
      const codexTool = result.tools[0];
      expect(codexTool.type).toBe('function');
      expect(codexTool.name).toBe('get_weather');
      expect(codexTool.description).toBe('Get weather information');
      expect(codexTool.strict).toBe(true);
    });

    it('应将 web_search_20250305 转换为 web_search 类型', () => {
      const audit = createMockAudit();

      const result = renderCodexRequest(
        {
          model: 'gpt-4',
          system: { text: 'You are a helpful assistant.' },
          messages: [],
          tools: [{
            name: 'web_search_20250305',
            description: 'Web search tool',
            inputSchema: { type: 'object', properties: {} },
          }],
          stream: true,
        },
        {},
        audit
      );

      expect(result.tools[0]).toEqual({
        type: 'web_search',
      });
      expect(result.tools[0].name).toBeUndefined();
    });
  });

  describe('Basic Structure', () => {
    it('should create valid Codex request structure', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'text',
                text: 'Hello',
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: 'You are helpful.' },
          messages,
          tools: [],
          stream: true,
          sessionId: 'session_123',
        },
        {},
        createMockAudit()
      );

      expect(result.model).toBe('codex-gpt-5');
      expect(result.instructions).toBeDefined();
      expect(result.input).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(result.stream).toBe(true);
      expect(result.store).toBe(false);
      expect(result.prompt_cache_key).toBe('session_123');
    });

    it('should include reasoning configuration when specified', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [{ type: 'text', text: 'Hello' }],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: '' },
          messages,
          tools: [],
          stream: true,
        },
        {
          reasoningEffort: 'medium',
        },
        createMockAudit()
      );

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning?.effort).toBe('medium');
      expect(result.include).toContain('reasoning.encrypted_content');
    });
  });

  describe('Tool Name 缩短', () => {
    it('应缩短超过 64 字符的 tool name', () => {
      const longToolName = 'mcp__very_long_server_name_with_many_characters__extremely_long_tool_name_that_exceeds_limit';
      const audit = createMockAudit();

      const result = renderCodexRequest(
        {
          model: 'gpt-4',
          system: { text: 'You are a helpful assistant.' },
          messages: [],
          tools: [{
            name: longToolName,
            description: 'A tool with a very long name',
            inputSchema: { type: 'object', properties: {} },
          }],
          stream: true,
        },
        {},
        audit
      );

      expect(result.tools[0].name.length).toBeLessThanOrEqual(64);
      expect(result.tools[0].name).toMatch(/^mcp__/);
    });

    it('应在 tool_use 中使用缩短后的名称', () => {
      const longToolName = 'a'.repeat(100);
      const audit = createMockAudit();

      const result = renderCodexRequest(
        {
          model: 'gpt-4',
          system: { text: 'You are a helpful assistant.' },
          messages: [{
            role: 'assistant',
            content: {
              blocks: [{
                type: 'tool_use',
                id: 'call_123',
                name: longToolName,
                input: { arg: 'value' },
              }],
            },
          }],
          tools: [{
            name: longToolName,
            description: 'A tool',
            inputSchema: { type: 'object', properties: {} },
          }],
          stream: true,
        },
        {},
        audit
      );

      // 检查 input 中的 function_call 使用了缩短后的名称
      const fnCall = result.input.find(item => item.type === 'function_call');
      expect(fnCall).toBeDefined();
      if (fnCall && fnCall.type === 'function_call') {
        expect(fnCall.name.length).toBeLessThanOrEqual(64);
      }
    });

    it('应保持短名称不变', () => {
      const shortNames = ['short', 'tool_name', 'TestTool'];
      const audit = createMockAudit();

      const result = renderCodexRequest(
        {
          model: 'gpt-4',
          system: { text: 'You are a helpful assistant.' },
          messages: [],
          tools: shortNames.map(name => ({
            name,
            description: `Tool ${name}`,
            inputSchema: { type: 'object', properties: {} },
          })),
          stream: true,
        },
        {},
        audit
      );

      expect(result.tools.map(t => t.name)).toEqual(shortNames);
    });

    it('应正确处理 mcp__ 前缀的 tool name 缩短', () => {
      const mcpToolName = 'mcp__my_very_long_server_name_that_exceeds_limit__get_weather_info';
      const audit = createMockAudit();

      const result = renderCodexRequest(
        {
          model: 'gpt-4',
          system: { text: 'You are a helpful assistant.' },
          messages: [],
          tools: [{
            name: mcpToolName,
            description: 'MCP tool with long server name',
            inputSchema: { type: 'object', properties: {} },
          }],
          stream: true,
        },
        {},
        audit
      );

      // 应该保留 mcp__ 前缀和最后的 tool name 部分
      expect(result.tools[0].name).toMatch(/^mcp__get_weather_info/);
      expect(result.tools[0].name.length).toBeLessThanOrEqual(64);
    });

    it('应确保多个 tool name 缩短后的唯一性', () => {
      const toolNames = [
        'mcp__server_a__very_long_tool_name_that_might_conflict',
        'mcp__server_b__very_long_tool_name_that_might_conflict',
      ];
      const audit = createMockAudit();

      const result = renderCodexRequest(
        {
          model: 'gpt-4',
          system: { text: 'You are a helpful assistant.' },
          messages: [],
          tools: toolNames.map(name => ({
            name,
            description: `Tool ${name}`,
            inputSchema: { type: 'object', properties: {} },
          })),
          stream: true,
        },
        {},
        audit
      );

      // 两个工具的名称应该不同
      expect(result.tools[0].name).not.toBe(result.tools[1].name);
      // 两个名称都应该在 64 字符限制内
      expect(result.tools[0].name.length).toBeLessThanOrEqual(64);
      expect(result.tools[1].name.length).toBeLessThanOrEqual(64);
    });

    it('应在 tools 和 tool_use 中使用一致的短名称', () => {
      const longToolName = 'mcp__long_server_name__tool_name_that_is_also_long';
      const audit = createMockAudit();

      const result = renderCodexRequest(
        {
          model: 'gpt-4',
          system: { text: 'You are a helpful assistant.' },
          messages: [{
            role: 'assistant',
            content: {
              blocks: [{
                type: 'tool_use',
                id: 'call_123',
                name: longToolName,
                input: { arg: 'value' },
              }],
            },
          }],
          tools: [{
            name: longToolName,
            description: 'A tool',
            inputSchema: { type: 'object', properties: {} },
          }],
          stream: true,
        },
        {},
        audit
      );

      // tools 数组中的短名称
      const toolShortName = result.tools[0].name;
      // input 中的短名称
      const fnCall = result.input.find(item => item.type === 'function_call');

      expect(fnCall).toBeDefined();
      if (fnCall && fnCall.type === 'function_call') {
        // 两者应该使用相同的短名称
        expect(fnCall.name).toBe(toolShortName);
      }
    });
  });

  describe('特殊前置指令消息', () => {
    it('应在空 input 时添加特殊指令作为第一条消息', () => {
      const audit = createMockAudit();

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: 'You are helpful.' },
          messages: [],
          tools: [],
          stream: true,
        },
        {},
        audit
      );

      // 验证特殊指令被添加
      expect(result.input.length).toBe(1);
      const firstItem = result.input[0];
      expect(firstItem.type).toBe('message');
      if (firstItem.type === 'message') {
        expect(firstItem.role).toBe('user');
        expect(firstItem.content[0].type).toBe('input_text');
        expect(firstItem.content[0].text).toBe('EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!');
      }
    });

    it('应在非空 input 时在开头添加特殊指令', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'text',
                text: 'Hello, how are you?',
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: 'You are helpful.' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      // 验证 input 的第一条消息是特殊指令
      expect(result.input.length).toBe(2);
      const firstItem = result.input[0];
      expect(firstItem.type).toBe('message');
      if (firstItem.type === 'message') {
        expect(firstItem.role).toBe('user');
        expect(firstItem.content[0].type).toBe('input_text');
        expect(firstItem.content[0].text).toBe('EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!');
      }

      // 第二条消息是原始用户消息
      const secondItem = result.input[1];
      expect(secondItem.type).toBe('message');
      if (secondItem.type === 'message') {
        expect(secondItem.content[0].text).toBe('Hello, how are you?');
      }
    });

    it('当第一条消息已经是特殊指令时不应重复添加', () => {
      const messages = [
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'text',
                text: 'EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!',
              },
            ],
          },
        },
        {
          role: 'user' as const,
          content: {
            blocks: [
              {
                type: 'text',
                text: 'Hello',
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: 'You are helpful.' },
          messages,
          tools: [],
          stream: true,
        },
        {},
        createMockAudit()
      );

      // 应该只有 2 条消息（不会重复添加）
      expect(result.input.length).toBe(2);
      const firstItem = result.input[0];
      if (firstItem.type === 'message') {
        expect(firstItem.content[0].text).toBe('EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!');
      }
    });

    it('应在包含 tool_use 的 input 中添加特殊指令', () => {
      const messages = [
        {
          role: 'assistant' as const,
          content: {
            blocks: [
              {
                type: 'tool_use',
                id: 'toolu_123',
                name: 'get_weather',
                input: { location: 'San Francisco' },
              },
            ],
          },
        },
      ];

      const result = renderCodexRequest(
        {
          model: 'codex-gpt-5',
          system: { text: '' },
          messages,
          tools: [{ name: 'get_weather', description: 'Get weather', inputSchema: { type: 'object', properties: {} } }],
          stream: true,
        },
        {},
        createMockAudit()
      );

      // 第一条应该是特殊指令
      expect(result.input.length).toBe(2);
      const firstItem = result.input[0];
      expect(firstItem.type).toBe('message');
      if (firstItem.type === 'message') {
        expect(firstItem.content[0].text).toBe('EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!');
      }

      // 第二条应该是 tool_use
      const secondItem = result.input[1];
      expect(secondItem.type).toBe('function_call');
    });
  });
});
