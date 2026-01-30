/**
 * OpenAI Chat → Claude SSE 转换器
 *
 * 将 OpenAI Chat Completions SSE 转换为 Claude Messages SSE
 */

import type { ChatSSEChoice, ChatSSEEvent } from '../types.js';
import type { ClaudeSSEEvent } from '../../claude/types.js';

/**
 * 状态机内部状态
 */
type State =
  | 'init'           // 初始状态
  | 'streaming'      // 流式输出中
  | 'done';          // 已完成

/**
 * 转换器结果
 */
type TransformerResult = {
  events: ClaudeSSEEvent[];
  streamEnd: boolean;
};

/**
 * 转换器配置
 */
type TransformerConfig = {
  customToolCallStrategy?: 'wrap_object' | 'error';
};

/**
 * 转换器选项
 */
type TransformerOptions = {
  estimatedInputTokens?: number;
};

/**
 * OpenAI Chat → Claude SSE 转换器
 */
export class OpenAIChatToClaudeSSETransformer {
  private state: State = 'init';
  private messageId: string | null = null;
  private hasContent: boolean = false;
  private hasTextBlockStarted: boolean = false;
  private contentBuffer: string[] = [];
  private toolCallsBuffer: Map<number, { id?: string; name?: string; arguments: string }> = new Map();
  private config: TransformerConfig;
  private options: TransformerOptions;
  private inputTokens: number | undefined;

  constructor(
    config: TransformerConfig = {},
    options: TransformerOptions = {},
  ) {
    this.config = config;
    this.options = options;
    this.inputTokens = options.estimatedInputTokens;
  }

  /**
   * 推送 OpenAI Chat SSE 事件
   */
  pushEvent(event: ChatSSEEvent): TransformerResult {
    const events: ClaudeSSEEvent[] = [];

    // 检查 [DONE] 标记
    if ((event as any) === '[DONE]' || Object.keys(event).length === 0) {
      return this.finalize();
    }

    const choices = event.choices;
    if (!choices || choices.length === 0) {
      return { events, streamEnd: false };
    }

    const choice = choices[0];
    const delta = choice.delta;

    // 状态转换
    if (this.state === 'init') {
      // 初始化：发送 message_start
      this.messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      this.state = 'streaming';

      events.push({
        type: 'message_start',
        message: {
          id: this.messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: '',
          stop_reason: null,
          usage: undefined,
        },
      });
    }

    if (this.state === 'streaming') {
      // 处理内容增量
      if (delta.content) {
        this.hasContent = true;

        // 第一个文本块：先发送 content_block_start
        if (!this.hasTextBlockStarted) {
          this.hasTextBlockStarted = true;
          events.push({
            type: 'content_block_start',
            index: 0,
            content_block: {
              type: 'text',
              text: '',
            },
          });
        }

        if (!this.contentBuffer.includes(delta.content)) {
          this.contentBuffer.push(delta.content);
          events.push({
            type: 'content_block_delta',
            index: 0,
            delta: {
              type: 'text_delta',
              text: delta.content,
            },
          });
        }
      }

      // 处理工具调用增量
      if (delta.tool_calls && delta.tool_calls.length > 0) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;
          let buffer = this.toolCallsBuffer.get(index);

          if (!buffer) {
            buffer = { id: toolCall.id, name: toolCall.function?.name, arguments: '' };
            this.toolCallsBuffer.set(index, buffer);

            // 发送 content_block_start
            events.push({
              type: 'content_block_start',
              index: this.hasContent ? 1 : 0,
              content_block: {
                type: 'tool_use',
                id: toolCall.id || '',
                name: toolCall.function?.name || '',
              } as any,
            });
          }

          // 更新 id 和 name
          if (toolCall.id && !buffer.id) {
            buffer.id = toolCall.id;
          }
          if (toolCall.function?.name && !buffer.name) {
            buffer.name = toolCall.function.name;
          }

          // 追加 arguments
          if (toolCall.function?.arguments) {
            buffer.arguments += toolCall.function.arguments;

            // 发送 input_json_delta
            events.push({
              type: 'content_block_delta',
              index: this.hasContent ? 1 : 0,
              delta: {
                type: 'input_json_delta',
                partial_json: toolCall.function.arguments,
              },
            });
          }
        }
      }

      // 检查是否完成
      if (choice.finish_reason) {
        return this.finalize();
      }
    }

    return { events, streamEnd: false };
  }

  /**
   * 完成流
   */
  finalize(): TransformerResult {
    const events: ClaudeSSEEvent[] = [];

    if (this.state === 'done') {
      return { events, streamEnd: true };
    }

    // 发送 content_block_stop（如果有文本内容）
    if (this.hasContent) {
      events.push({
        type: 'content_block_stop',
        index: 0,
      });
    }

    // 发送工具调用的 content_block_stop
    if (this.toolCallsBuffer.size > 0) {
      const baseIndex = this.hasContent ? 1 : 0;
      // 按索引顺序发送 stop 事件
      const indices = Array.from(this.toolCallsBuffer.keys()).sort((a, b) => a - b);
      for (const idx of indices) {
        events.push({
          type: 'content_block_stop',
          index: baseIndex + idx,
        });
      }
    }

    // 映射 finish_reason
    const finishReason = this.mapStopReason('stop'); // 默认 stop

    // 发送 message_delta（带 stop_reason）
    events.push({
      type: 'message_delta',
      delta: {
        stop_reason: finishReason ?? undefined,
        stop_sequence: undefined,
      },
      usage: this.inputTokens !== undefined ? {
        input_tokens: this.inputTokens,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      } : undefined,
    });

    // 发送 message_stop
    events.push({
      type: 'message_stop',
    });

    this.state = 'done';

    return { events, streamEnd: true };
  }

  /**
   * 映射 OpenAI finish_reason 到 Claude stop_reason
   */
  private mapStopReason(finishReason: string | null | undefined): string | null {
    const mapping: Record<string, string> = {
      'tool_calls': 'tool_use',
      'stop': 'end_turn',
      'length': 'max_tokens',
      'content_filter': 'end_turn',
    };

    if (!finishReason) {
      return 'end_turn';
    }

    return mapping[finishReason] || 'end_turn';
  }
}

/**
 * 创建转换器
 */
export function createOpenAIChatToClaudeSSETransformer(
  config?: TransformerConfig,
  options?: TransformerOptions,
): OpenAIChatToClaudeSSETransformer {
  return new OpenAIChatToClaudeSSETransformer(config, options);
}
