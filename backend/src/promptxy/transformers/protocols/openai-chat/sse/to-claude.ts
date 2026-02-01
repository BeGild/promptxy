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

type ToolCallState = {
  contentBlockIndex: number;
  id?: string;
  name?: string;
  arguments: string;
  emittedArgsLength: number;
  started: boolean;
};

/**
 * OpenAI Chat → Claude SSE 转换器
 */
export class OpenAIChatToClaudeSSETransformer {
  private state: State = 'init';
  private messageId: string | null = null;

  private nextContentBlockIndex: number = 0;
  private textContentBlockIndex: number | null = null;

  private toolCallsBuffer: Map<number, ToolCallState> = new Map();
  private finishReason: string | null | undefined;

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

    const choice: ChatSSEChoice = choices[0];
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
      // 处理内容增量（注意：不能对 delta.content 做字符串去重，否则会静默丢失合法重复片段）
      if (delta.content) {
        this.ensureTextBlockStarted(events);
        events.push({
          type: 'content_block_delta',
          index: this.textContentBlockIndex!,
          delta: {
            type: 'text_delta',
            text: delta.content,
          },
        });
      }

      // 处理工具调用增量
      if (delta.tool_calls && delta.tool_calls.length > 0) {
        for (const toolCall of delta.tool_calls) {
          const openAIIndex = toolCall.index;
          const buffer = this.getOrCreateToolCallState(openAIIndex);

          // 更新 id / name
          if (toolCall.id) {
            buffer.id = toolCall.id;
          }
          if (toolCall.function?.name) {
            buffer.name = toolCall.function.name;
          }

          // 追加 arguments
          if (toolCall.function?.arguments) {
            buffer.arguments += toolCall.function.arguments;
          }

          // 尝试启动 tool_use block（需要 id + name）
          this.maybeStartToolUseBlock(buffer, events);

          // 如果已经 started，则发送本次增量（或补发未发送的缓存）
          this.flushToolArgumentsDelta(buffer, events);
        }
      }

      // 检查是否完成
      if (choice.finish_reason !== null && choice.finish_reason !== undefined) {
        this.finishReason = choice.finish_reason;
        return this.finalize();
      }
    }

    return { events, streamEnd: false };
  }

  private ensureTextBlockStarted(events: ClaudeSSEEvent[]): void {
    if (this.textContentBlockIndex !== null) {
      return;
    }

    this.textContentBlockIndex = this.nextContentBlockIndex++;
    events.push({
      type: 'content_block_start',
      index: this.textContentBlockIndex,
      content_block: {
        type: 'text',
        text: '',
      },
    });
  }

  private getOrCreateToolCallState(openAIIndex: number): ToolCallState {
    const existing = this.toolCallsBuffer.get(openAIIndex);
    if (existing) {
      return existing;
    }

    const state: ToolCallState = {
      contentBlockIndex: this.nextContentBlockIndex++,
      id: undefined,
      name: undefined,
      arguments: '',
      emittedArgsLength: 0,
      started: false,
    };

    this.toolCallsBuffer.set(openAIIndex, state);
    return state;
  }

  private maybeStartToolUseBlock(state: ToolCallState, events: ClaudeSSEEvent[]): void {
    if (state.started) {
      return;
    }

    if (!state.id || !state.name) {
      return;
    }

    events.push({
      type: 'content_block_start',
      index: state.contentBlockIndex,
      content_block: {
        type: 'tool_use',
        id: state.id,
        name: state.name,
      } as any,
    });

    state.started = true;
  }

  private flushToolArgumentsDelta(state: ToolCallState, events: ClaudeSSEEvent[]): void {
    if (!state.started) {
      return;
    }

    if (state.arguments.length <= state.emittedArgsLength) {
      return;
    }

    const newArgs = state.arguments.slice(state.emittedArgsLength);
    state.emittedArgsLength = state.arguments.length;

    events.push({
      type: 'content_block_delta',
      index: state.contentBlockIndex,
      delta: {
        type: 'input_json_delta',
        partial_json: newArgs,
      },
    });
  }

  /**
   * 完成流
   */
  finalize(): TransformerResult {
    const events: ClaudeSSEEvent[] = [];

    if (this.state === 'done') {
      return { events, streamEnd: true };
    }

    // 发送 content_block_stop（按 index 升序，保证序列确定）
    const stopIndices: number[] = [];

    if (this.textContentBlockIndex !== null) {
      stopIndices.push(this.textContentBlockIndex);
    }

    for (const state of this.toolCallsBuffer.values()) {
      if (state.started) {
        stopIndices.push(state.contentBlockIndex);
      }
    }

    stopIndices.sort((a, b) => a - b);

    for (const index of stopIndices) {
      events.push({
        type: 'content_block_stop',
        index,
      });
    }

    // 映射 finish_reason
    const finishReason = this.mapStopReason(this.finishReason);

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
      'function_call': 'tool_use',
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
