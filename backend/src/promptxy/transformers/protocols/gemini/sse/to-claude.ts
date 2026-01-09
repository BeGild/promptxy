/**
 * Gemini SSE → Claude SSE 转换状态机
 *
 * 将 Gemini SSE 转换为 Claude Code 可消费的 SSE 事件序列
 */

import type { GeminiSSEChunk, GeminiPart, GeminiFunctionCallPart } from '../types.js';
import type {
  ClaudeSSEEvent,
  ClaudeMessageStartEvent,
  ClaudeContentBlockStartEvent,
  ClaudeContentBlockDeltaEvent,
  ClaudeContentBlockStopEvent,
  ClaudeMessageDeltaEvent,
  ClaudeMessageStopEvent,
} from '../../../protocols/claude/types.js';

/**
 * 状态机状态
 */
type State = {
  /** 是否已发送 message_start */
  messageStarted: boolean;
  /** 是否已开始文本 block */
  textBlockStarted: boolean;
  /** 当前 tool index（从 1 开始） */
  toolIndex: number;
  /** 是否已发送 message_stop */
  messageStopped: boolean;
  /** 待处理的工具调用（用于处理分片 args） */
  pendingToolCall: {
    name?: string;
    args: Record<string, unknown>;
    id?: string;
  } | null;
  /** 累积的 usage metadata */
  usageMetadata: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  /** finish reason */
  finishReason: string | null;
};

/**
 * 创建初始状态
 */
function createInitialState(): State {
  return {
    messageStarted: false,
    textBlockStarted: false,
    toolIndex: 1,
    messageStopped: false,
    pendingToolCall: null,
    usageMetadata: {},
    finishReason: null,
  };
}

/**
 * SSE 转换结果
 */
export type SSETransformResult = {
  /** Claude SSE 事件 */
  events: ClaudeSSEEvent[];
  /** 是否流结束 */
  streamEnd: boolean;
};

/**
 * 流式增量转换器（用于 Node Transform 流式 pipe：chunk-by-chunk）
 *
 * 说明：
 * - Gemini SSE 是逐 chunk 到达的；Gateway 需要“边读边转发”而不是等完整数组。
 * - 这里暴露一个轻量状态机，复用本文件的转换逻辑。
 */
export type GeminiSSEToClaudeStreamTransformer = {
  pushChunk: (chunk: GeminiSSEChunk) => { events: ClaudeSSEEvent[]; streamEnd: boolean };
  finalize: () => { events: ClaudeSSEEvent[]; streamEnd: boolean };
};

export function createGeminiSSEToClaudeStreamTransformer(): GeminiSSEToClaudeStreamTransformer {
  const state = createInitialState();
  let ended = false;

  function pushChunk(chunk: GeminiSSEChunk): { events: ClaudeSSEEvent[]; streamEnd: boolean } {
    if (ended) return { events: [], streamEnd: true };

    const events: ClaudeSSEEvent[] = [];

    const invalidType = detectInvalidStream(chunk);
    if (invalidType) {
      events.push({
        type: 'error',
        error: { message: `Invalid stream: ${invalidType}` },
      });
      events.push({ type: 'message_stop' });
      state.messageStopped = true;
      ended = true;
      return { events, streamEnd: true };
    }

    if (chunk.usageMetadata) {
      state.usageMetadata = {
        ...state.usageMetadata,
        ...chunk.usageMetadata,
      };
    }

    const candidate = chunk.candidates?.[0];
    if (!candidate) {
      return { events, streamEnd: false };
    }

    if (candidate.finishReason) {
      state.finishReason = transformFinishReason(candidate.finishReason);
    }

    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      events.push(...transformPart(part, state));
    }

    if (candidate.finishReason && state.textBlockStarted) {
      events.push(createContentBlockStopEvent(0));
      state.textBlockStarted = false;
    }

    return { events, streamEnd: false };
  }

  function finalize(): { events: ClaudeSSEEvent[]; streamEnd: boolean } {
    if (ended) return { events: [], streamEnd: true };

    const events: ClaudeSSEEvent[] = [];

    if (!state.messageStopped) {
      if (state.pendingToolCall) {
        events.push(...completePendingToolCall(state));
      }

      if (state.usageMetadata.candidatesTokenCount !== undefined) {
        events.push(
          createMessageDeltaEvent({
            stop_reason: state.finishReason ?? 'end_turn',
            usage: { output_tokens: state.usageMetadata.candidatesTokenCount },
          }),
        );
      } else if (state.finishReason) {
        events.push(
          createMessageDeltaEvent({
            stop_reason: state.finishReason,
          }),
        );
      }

      events.push({ type: 'message_stop' });
      state.messageStopped = true;
    }

    ended = true;
    return { events, streamEnd: true };
  }

  return { pushChunk, finalize };
}

/**
 * Invalid Stream 类型
 */
type InvalidStreamType =
  | 'NO_FINISH_REASON'
  | 'NO_RESPONSE_TEXT'
  | 'MALFORMED_FUNCTION_CALL';

/**
 * 检测 Invalid Stream
 */
function detectInvalidStream(chunk: GeminiSSEChunk): InvalidStreamType | null {
  const candidate = chunk.candidates?.[0];

  if (!candidate) {
    return 'NO_RESPONSE_TEXT';
  }

  const finishReason = candidate.finishReason;
  const parts = candidate.content?.parts ?? [];

  // 检查是否有 functionCall
  const hasFunctionCall = parts.some(
    p => 'functionCall' in p && p.functionCall
  );

  // 检查是否有文本
  const hasText = parts.some(
    p => 'text' in p && p.text
  );

  if (!hasFunctionCall && !hasText) {
    return 'NO_RESPONSE_TEXT';
  }

  if (finishReason === 'MALFORMED_FUNCTION_CALL') {
    return 'MALFORMED_FUNCTION_CALL';
  }

  if (!finishReason && !hasFunctionCall && !hasText) {
    return 'NO_FINISH_REASON';
  }

  return null;
}

/**
 * 转换 Gemini SSE chunk 为 Claude SSE 事件序列
 */
export function transformGeminiSSEToClaude(
  geminiChunks: GeminiSSEChunk[],
): SSETransformResult {
  const transformer = createGeminiSSEToClaudeStreamTransformer();
  const events: ClaudeSSEEvent[] = [];

  for (const chunk of geminiChunks) {
    const res = transformer.pushChunk(chunk);
    events.push(...res.events);
    if (res.streamEnd) return { events, streamEnd: true };
  }

  const fin = transformer.finalize();
  events.push(...fin.events);
  return { events, streamEnd: fin.streamEnd };
}

/**
 * 转换单个 Part
 */
function transformPart(part: GeminiPart, state: State): ClaudeSSEEvent[] {
  const events: ClaudeSSEEvent[] = [];

  // 如果有待处理的 tool call，且遇到非 functionCall part，先完成它
  if (state.pendingToolCall && !('functionCall' in part)) {
    const completeEvents = completePendingToolCall(state);
    events.push(...completeEvents);
  }

  // 过滤 thought part
  if ('thought' in part && part.thought === true) {
    return events;
  }

  // 初始化 message_start
  if (!state.messageStarted) {
    events.push(createMessageStartEvent());
    events.push(createContentBlockStartEvent(0, 'text'));
    state.messageStarted = true;
    state.textBlockStarted = true;
  }

  if ('text' in part && part.text) {
    // 文本增量
    events.push(
      createContentBlockDeltaEvent(0, 'text_delta', {
        text: part.text,
      })
    );
  } else if ('functionCall' in part) {
    // 工具调用
    const functionCall = (part as GeminiFunctionCallPart).functionCall;

    // 判断是否是分片 args：
    // 1. 有 pendingToolCall 且名称相同
    // 2. 或者有 pendingToolCall 且当前 functionCall 没有 name（只有 args）
    const isFragmentedArgs =
      state.pendingToolCall &&
      (state.pendingToolCall.name === functionCall.name ||
        (functionCall.name === undefined && functionCall.args));

    if (isFragmentedArgs) {
      // 累积 args（分片到达）
      if (state.pendingToolCall) {
        state.pendingToolCall.args = {
          ...state.pendingToolCall.args,
          ...(functionCall.args ?? {}),
        };
      }
    } else {
      // 新的工具调用，先完成之前的
      if (state.pendingToolCall) {
        const completeEvents = completePendingToolCall(state);
        events.push(...completeEvents);
      }

      // 开始新的 tool call
      const toolUseId = generateToolUseId(functionCall.name);
      state.pendingToolCall = {
        name: functionCall.name,
        args: functionCall.args ?? {},
        id: toolUseId,
      };

      // 发送 content_block_start
      events.push(
        createContentBlockStartEvent(state.toolIndex, 'tool_use', {
          id: toolUseId,
          name: functionCall.name,
        })
      );
    }

    // 发送 input_json_delta
    events.push(
      createContentBlockDeltaEvent(state.toolIndex, 'input_json_delta', {
        partial_json: JSON.stringify(functionCall.args ?? {}),
      })
    );
  }

  return events;
}

/**
 * 完成待处理的工具调用
 */
function completePendingToolCall(state: State): ClaudeSSEEvent[] {
  const events: ClaudeSSEEvent[] = [];

  if (!state.pendingToolCall) {
    return events;
  }

  // content_block_stop
  events.push(createContentBlockStopEvent(state.toolIndex));

  // message_delta（触发 tool loop）
  events.push(
    createMessageDeltaEvent({
      stop_reason: 'tool_use',
    })
  );

  state.pendingToolCall = null;
  state.toolIndex++;

  return events;
}

/**
 * 生成 tool_use_id（Claude Code 兼容）
 */
function generateToolUseId(toolName: string): string {
  const timestamp = Date.now();
  const index = Math.floor(Math.random() * 1000);
  return `toolu_${timestamp}_${index}`;
}

/**
 * 转换 Finish Reason
 */
function transformFinishReason(finishReason: string): string | null {
  const finishReasonMap: Record<string, string> = {
    'STOP': 'end_turn',
    'MAX_TOKENS': 'max_tokens',
    'SAFETY': 'stop_sequence',
    'RECITATION': 'stop_sequence',
    'OTHER': 'end_turn',
    'BLOCKLIST': 'stop_sequence',
    'PROHIBITED_CONTENT': 'stop_sequence',
    'SPII': 'stop_sequence',
    'MALFORMED_FUNCTION_CALL': 'error',
    'LANGUAGE': 'stop_sequence',
    'IMAGE_PROHIBITED_CONTENT': 'stop_sequence',
    'NO_IMAGE': 'error',
    'UNEXPECTED_TOOL_CALL': 'error',
  };

  const mapped = finishReasonMap[finishReason];
  if (mapped === 'error') {
    return 'end_turn'; // 降级
  }

  return mapped ?? 'end_turn';
}

// ===== Claude SSE 事件工厂函数 =====

function createMessageStartEvent(): ClaudeMessageStartEvent {
  return {
    type: 'message_start',
    message: {
      id: '',
      role: 'assistant',
      content: [],
      model: '',
      stop_reason: null,
    },
  };
}

function createContentBlockStartEvent(
  index: number,
  blockType: 'text' | 'tool_use',
  extras?: { id?: string; name?: string },
): ClaudeContentBlockStartEvent {
  const event: ClaudeContentBlockStartEvent = {
    type: 'content_block_start',
    index,
    content_block: {
      type: blockType,
    },
  };

  if (blockType === 'text') {
    event.content_block.text = '';
  } else if (blockType === 'tool_use' && extras) {
    event.content_block.id = extras.id;
    event.content_block.name = extras.name;
  }

  return event;
}

function createContentBlockDeltaEvent(
  index: number,
  deltaType: 'text_delta' | 'input_json_delta',
  content: { text?: string; partial_json?: string },
): ClaudeContentBlockDeltaEvent {
  const event: ClaudeContentBlockDeltaEvent = {
    type: 'content_block_delta',
    index,
    delta: {
      type: deltaType,
    },
  };

  if (deltaType === 'text_delta' && content.text !== undefined) {
    event.delta.text = content.text;
  } else if (deltaType === 'input_json_delta' && content.partial_json !== undefined) {
    event.delta.partial_json = content.partial_json;
  }

  return event;
}

function createContentBlockStopEvent(
  index: number,
): ClaudeContentBlockStopEvent {
  return {
    type: 'content_block_stop',
    index,
  };
}

function createMessageDeltaEvent(
  delta: { stop_reason?: string; usage?: { output_tokens: number } },
): ClaudeMessageDeltaEvent {
  return {
    type: 'message_delta',
    delta: {
      stop_reason: delta.stop_reason,
    },
    usage: delta.usage,
  };
}

function createMessageStopEvent(): ClaudeMessageStopEvent {
  return {
    type: 'message_stop',
  };
}
