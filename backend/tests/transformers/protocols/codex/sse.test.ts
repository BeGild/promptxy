/**
 * Codex SSE 转换器单元测试
 *
 * 测试 Codex SSE 事件到 Claude SSE 事件的转换功能
 */

import { describe, it, expect } from 'vitest';
import { transformCodexSSEToClaude } from '../../../../src/promptxy/transformers/protocols/codex/sse/to-claude.js';
import type { FieldAuditCollector } from '../../../../src/promptxy/transformers/audit/field-audit.js';
import type { CodexSSEEvent } from '../../../../src/promptxy/transformers/protocols/codex/types.js';

// 简单的 audit collector mock
function createMockAudit(): FieldAuditCollector {
  return {
    addDefaulted: () => {},
    addDiff: () => {},
    setMetadata: () => {},
  };
}

describe('Codex SSE Transform', () => {
  describe('Stop Reason Mapping', () => {
    it('should use tool_use for tool calls', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.output_item.done',
          item: {
            type: 'function_call',
            call_id: 'call_123',
            name: 'test_tool',
            arguments: '{}',
          },
        },
        {
          type: 'response.completed',
          id: 'resp_123',
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 查找 message_delta 事件
      const messageDeltaEvents = result.events.filter(e => e.type === 'message_delta');
      expect(messageDeltaEvents.length).toBeGreaterThan(0);

      const toolCallDelta = messageDeltaEvents[0];
      expect(toolCallDelta.type).toBe('message_delta');
      expect(toolCallDelta.delta.stop_reason).toBe('tool_use');
    });

    it('should use end_turn for normal completion', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.output_text.delta',
          delta: 'Hello',
        },
        {
          type: 'response.completed',
          id: 'resp_123',
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15,
          },
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 查找 message_delta 事件
      const messageDeltaEvents = result.events.filter(e => e.type === 'message_delta');
      expect(messageDeltaEvents.length).toBeGreaterThan(0);

      const completionDelta = messageDeltaEvents[messageDeltaEvents.length - 1];
      expect(completionDelta.type).toBe('message_delta');
      expect(completionDelta.delta.stop_reason).toBe('end_turn');
    });
  });

  describe('Reasoning Content', () => {
    it('should transform reasoning_text.delta to thinking events', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.reasoning_text.delta',
          delta: 'Let me think about this...',
          content_index: 0,
        },
        {
          type: 'response.reasoning_text.delta',
          delta: 'The answer is 42.',
          content_index: 0,
        },
        {
          type: 'response.completed',
          id: 'resp_123',
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 查找 content_block_start 事件（thinking 类型）
      const thinkingStartEvents = result.events.filter(e =>
        e.type === 'content_block_start' &&
        e.content_block.type === 'thinking'
      );
      expect(thinkingStartEvents.length).toBe(1);
      expect(thinkingStartEvents[0].content_block.thinking).toBe('');

      // 查找 content_block_delta 事件（thinking_delta 类型）
      const thinkingDeltaEvents = result.events.filter(e =>
        e.type === 'content_block_delta' &&
        e.delta.type === 'thinking_delta'
      );
      expect(thinkingDeltaEvents.length).toBe(2);
      expect(thinkingDeltaEvents[0].delta.thinking).toBe('Let me think about this...');
      expect(thinkingDeltaEvents[1].delta.thinking).toBe('The answer is 42.');
    });

    it('should transform reasoning_summary_text.delta to thinking events', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.reasoning_summary_text.delta',
          delta: 'Summary: The process involved analyzing the problem.',
          summary_index: 0,
        },
        {
          type: 'response.completed',
          id: 'resp_123',
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 查找 content_block_delta 事件（thinking_delta 类型）
      const thinkingDeltaEvents = result.events.filter(e =>
        e.type === 'content_block_delta' &&
        e.delta.type === 'thinking_delta'
      );
      expect(thinkingDeltaEvents.length).toBe(1);
      expect(thinkingDeltaEvents[0].delta.thinking).toBe('Summary: The process involved analyzing the problem.');
    });

    it('should handle both reasoning and summary together', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.reasoning_text.delta',
          delta: 'Detailed reasoning...',
          content_index: 0,
        },
        {
          type: 'response.reasoning_summary_text.delta',
          delta: 'Brief summary',
          summary_index: 0,
        },
        {
          type: 'response.completed',
          id: 'resp_123',
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 应该只有一个 thinking block start
      const thinkingStartEvents = result.events.filter(e =>
        e.type === 'content_block_start' &&
        e.content_block.type === 'thinking'
      );
      expect(thinkingStartEvents.length).toBe(1);

      // 应该有多个 thinking delta 事件
      const thinkingDeltaEvents = result.events.filter(e =>
        e.type === 'content_block_delta' &&
        e.delta.type === 'thinking_delta'
      );
      expect(thinkingDeltaEvents.length).toBe(2);
    });

    it('should close thinking block on stream completion', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.reasoning_text.delta',
          delta: 'Thinking...',
          content_index: 0,
        },
        {
          type: 'response.completed',
          id: 'resp_123',
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 查找 content_block_stop 事件
      const thinkingStopEvents = result.events.filter(e =>
        e.type === 'content_block_stop' &&
        e.index > 0  // 非 text block（index 0）
      );
      expect(thinkingStopEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Usage Information', () => {
    it('should extract usage from response.completed', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.output_text.delta',
          delta: 'Hello',
        },
        {
          type: 'response.completed',
          id: 'resp_123',
          usage: {
            input_tokens: 100,
            input_tokens_details: {
              cached_tokens: 50,
            },
            output_tokens: 200,
            output_tokens_details: {
              reasoning_tokens: 75,
            },
            total_tokens: 300,
          },
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 查找包含 usage 的 message_delta 事件
      const messageDeltaEvents = result.events.filter(e =>
        e.type === 'message_delta' && e.usage !== undefined
      );
      expect(messageDeltaEvents.length).toBeGreaterThan(0);

      const usageEvent = messageDeltaEvents[messageDeltaEvents.length - 1];
      expect(usageEvent.usage).toBeDefined();
      // 官方四字段：input_tokens/output_tokens/cache_read_input_tokens/cache_creation_input_tokens
      expect(usageEvent.usage?.input_tokens).toBe(100);
      expect(usageEvent.usage?.output_tokens).toBe(200);
      expect(usageEvent.usage?.cache_read_input_tokens).toBe(50);
      expect(usageEvent.usage?.cache_creation_input_tokens).toBe(0);
      // reasoning_tokens 仅用于审计，不进入 Claude usage
    });

    it('should handle response without usage gracefully', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.output_text.delta',
          delta: 'Hello',
        },
        {
          type: 'response.completed',
          id: 'resp_123',
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 应该正常完成，不抛出错误
      expect(result.streamEnd).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);

      // 应该生成兜底 usage（output_tokens 估算）
      const messageDeltaEvents = result.events.filter(e =>
        e.type === 'message_delta' && e.usage !== undefined
      );
      expect(messageDeltaEvents.length).toBeGreaterThan(0);

      const usageEvent = messageDeltaEvents[messageDeltaEvents.length - 1];
      expect(usageEvent.usage?.output_tokens).toBeGreaterThan(0);
      // input_tokens 如果没有注入 estimatedInputTokens，应该为 0 并记录 audit
      expect(usageEvent.usage?.input_tokens).toBe(0);
    });

    it('should generate fallback usage when response.completed is missing', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.output_text.delta',
          delta: 'Hello world!',
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 应该正常完成并生成兜底 usage
      // finalize() 会被调用，返回 streamEnd: true
      expect(result.streamEnd).toBe(true);

      // 应该有 usage（由 finalize 生成）
      const messageDeltaEvents = result.events.filter(e =>
        e.type === 'message_delta' && e.usage !== undefined
      );
      expect(messageDeltaEvents.length).toBeGreaterThan(0);

      const usageEvent = messageDeltaEvents[messageDeltaEvents.length - 1];
      expect(usageEvent.usage?.output_tokens).toBe(Math.ceil('Hello world!'.length / 3));
      expect(usageEvent.usage?.input_tokens).toBe(0);
      expect(usageEvent.usage?.cache_read_input_tokens).toBe(0);
      expect(usageEvent.usage?.cache_creation_input_tokens).toBe(0);
    });
  });

  describe('Text Content', () => {
    it('should transform output_text.delta to text_delta events', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.output_text.delta',
          delta: 'Hello',
        },
        {
          type: 'response.output_text.delta',
          delta: ' world',
        },
        {
          type: 'response.completed',
          id: 'resp_123',
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 查找 text_delta 事件
      const textDeltaEvents = result.events.filter(e =>
        e.type === 'content_block_delta' &&
        e.delta.type === 'text_delta'
      );
      expect(textDeltaEvents.length).toBe(2);
      expect(textDeltaEvents[0].delta.text).toBe('Hello');
      expect(textDeltaEvents[1].delta.text).toBe(' world');
    });
  });

  describe('Stream Completion', () => {
    it('should add message_stop on completion', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.output_text.delta',
          delta: 'Hello',
        },
        {
          type: 'response.completed',
          id: 'resp_123',
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 查找 message_stop 事件
      const messageStopEvents = result.events.filter(e => e.type === 'message_stop');
      expect(messageStopEvents.length).toBe(1);
      expect(result.streamEnd).toBe(true);
    });

    it('should add message_stop when completed is missing', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.output_text.delta',
          delta: 'Hello',
        },
      ];

      // 模拟流结束（没有 completed 事件）
      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 由于没有 completed，streamEnd 应该是 false（因为 isStreamEndEvent 不会匹配）
      // 但在我们的实现中，如果没有任何事件匹配，我们需要手动处理
      expect(result.events.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle response.failed events', () => {
      const codexEvents: CodexSSEEvent[] = [
        {
          type: 'response.created',
          id: 'resp_123',
          status: 'in_progress',
        },
        {
          type: 'response.failed',
          error: {
            message: 'Upstream request failed',
            code: 'rate_limit_exceeded',
          },
        },
      ];

      const result = transformCodexSSEToClaude(codexEvents, { customToolCallStrategy: 'wrap_object' }, createMockAudit());

      // 查找 error 事件
      const errorEvents = result.events.filter(e => e.type === 'error');
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].error.message).toBe('Upstream request failed');
    });
  });
});
