import { describe, it, expect } from 'vitest';
import { createOpenAIChatToClaudeSSETransformer } from '../../src/promptxy/transformers/protocols/openai-chat/sse/to-claude.js';
import type { ChatSSEEvent } from '../../src/promptxy/transformers/protocols/openai-chat/types.js';

describe('OpenAI Chat SSE → Claude SSE', () => {
  it('应发送 content_block_start 在第一个 content_block_delta 之前', () => {
    const transformer = createOpenAIChatToClaudeSSETransformer();

    // OpenAI 第一个 chunk：role + 初始内容
    const chunk1: ChatSSEEvent = {
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: { role: 'assistant', content: 'Hello' },
        finish_reason: null,
      }],
    };

    const result1 = transformer.pushEvent(chunk1);

    // 应该包含 message_start、content_block_start、content_block_delta
    const types1 = result1.events.map(e => e.type);
    expect(types1).toContain('message_start');
    expect(types1).toContain('content_block_start');
    expect(types1).toContain('content_block_delta');

    // content_block_start 必须在 content_block_delta 之前
    const startIdx = types1.indexOf('content_block_start');
    const deltaIdx = types1.indexOf('content_block_delta');
    expect(startIdx).toBeLessThan(deltaIdx);

    // content_block_start 的 index 应为 0
    const startEvent = result1.events.find(e => e.type === 'content_block_start');
    expect(startEvent).toMatchObject({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text' },
    });
  });

  it('应正确映射 stop_reason', () => {
    const transformer = createOpenAIChatToClaudeSSETransformer();

    // 初始化流
    transformer.pushEvent({
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null,
      }],
    });

    // 发送内容
    transformer.pushEvent({
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: { content: 'Hi' },
        finish_reason: null,
      }],
    });

    // 结束 chunk 带 finish_reason
    const finalChunk: ChatSSEEvent = {
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop',
      }],
    };

    const result = transformer.pushEvent(finalChunk);

    // 应该包含 message_delta 且 stop_reason 为 end_turn
    const messageDelta = result.events.find(e => e.type === 'message_delta');
    expect(messageDelta).toBeTruthy();
    expect((messageDelta as any).delta?.stop_reason).toBe('end_turn');
  });

  it('应将 tool_calls 映射为正确的 content_block_start (tool_use)', () => {
    const transformer = createOpenAIChatToClaudeSSETransformer();

    // 初始化流
    transformer.pushEvent({
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null,
      }],
    });

    // 工具调用开始
    const toolStartChunk: ChatSSEEvent = {
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            id: 'call_test123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '',
            },
          }],
        },
        finish_reason: null,
      }],
    };

    const result = transformer.pushEvent(toolStartChunk);

    // 应该包含 tool_use 类型的 content_block_start
    const startEvent = result.events.find(e => e.type === 'content_block_start');
    expect(startEvent).toMatchObject({
      type: 'content_block_start',
      index: 0,
      content_block: {
        type: 'tool_use',
        id: 'call_test123',
        name: 'get_weather',
      },
    });
  });

  it('应累积 arguments delta 并发送 input_json_delta', () => {
    const transformer = createOpenAIChatToClaudeSSETransformer();

    // 初始化
    transformer.pushEvent({
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null,
      }],
    });

    // 工具调用开始
    transformer.pushEvent({
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            id: 'call_test123',
            type: 'function',
            function: { name: 'get_weather', arguments: '' },
          }],
        },
        finish_reason: null,
      }],
    });

    // 发送 arguments delta
    const argsChunk: ChatSSEEvent = {
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            function: { arguments: '{"location":' },
          }],
        },
        finish_reason: null,
      }],
    };

    const result = transformer.pushEvent(argsChunk);

    // 应该包含 input_json_delta
    const jsonDelta = result.events.find(e => e.type === 'content_block_delta' && (e as any).delta?.type === 'input_json_delta');
    expect(jsonDelta).toMatchObject({
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'input_json_delta',
        partial_json: '{"location":',
      },
    });
  });

  it('content_block_stop 的 index 应为非负数', () => {
    const transformer = createOpenAIChatToClaudeSSETransformer();

    // 初始化 + 发送内容
    transformer.pushEvent({
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: { role: 'assistant', content: 'Hello' },
        finish_reason: null,
      }],
    });

    // 结束
    const result = transformer.pushEvent({
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-test',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop',
      }],
    });

    // 检查所有 content_block_stop 的 index
    const stopEvents = result.events.filter(e => e.type === 'content_block_stop');
    expect(stopEvents.length).toBeGreaterThan(0);
    for (const event of stopEvents) {
      expect((event as any).index).toBeGreaterThanOrEqual(0);
    }
  });
});
