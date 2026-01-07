/**
 * Codex SSE → Claude SSE 转换状态机
 *
 * 将 Codex Responses SSE 转换为 Claude Code 可消费的 SSE 事件序列
 * 参考:
 * - refence/codex/codex-rs/codex-api/src/sse/responses.rs (Codex SSE)
 * - refence/claude-code-router/src/index.ts:216 (Claude Code 消费)
 */

import type { CodexSSEEvent } from '../types.js';
import type {
  ClaudeSSEEvent,
  ClaudeMessageStartEvent,
  ClaudeContentBlockStartEvent,
  ClaudeContentBlockDeltaEvent,
  ClaudeContentBlockStopEvent,
  ClaudeMessageDeltaEvent,
  ClaudeMessageStopEvent,
} from '../../../protocols/claude/types.js';
import type { FieldAuditCollector } from '../../../audit/field-audit.js';
import { isStreamEndEvent } from './parse.js';

/**
 * 状态机状态
 */
type State = {
  /** 是否已发送 message_start */
  messageStarted: boolean;
  /** 是否已开始文本 block */
  textBlockStarted: boolean;
  /** 当前 tool index（从 1 开始，0 预留给文本） */
  currentToolIndex: number;
  /** 是否已发送 message_stop */
  messageStopped: boolean;
  /** 是否已收到 response.completed */
  completedReceived: boolean;
};

/**
 * 创建初始状态
 */
function createInitialState(): State {
  return {
    messageStarted: false,
    textBlockStarted: false,
    currentToolIndex: 1,
    messageStopped: false,
    completedReceived: false,
  };
}

/**
 * SSE 转换配置
 */
export type SSETransformConfig = {
  /** stop_reason 策略 */
  stopReasonStrategy: 'end_turn' | 'tool_use';
  /** custom_tool_call 映射策略 */
  customToolCallStrategy: 'wrap_object' | 'error';
};

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
 * 转换 Codex SSE 事件为 Claude SSE 事件序列
 *
 * 映射规则（参考 design.md 第 7.4 节）：
 *
 * **初始化**
 * - 首次看到任何事件时：发送 message_start + content_block_start(index=0, type=text)
 *
 * **文本增量**
 * - response.output_text.delta → content_block_delta(index=0, delta.type=text_delta)
 *
 * **工具调用**
 * - response.output_item.done 且 item.type=function_call/custom_tool_call:
 *   - content_block_start(index=toolIndex, type=tool_use, name, id)
 *   - content_block_delta(index=toolIndex, delta.type=input_json_delta, partial_json=arguments)
 *   - content_block_stop(index=toolIndex)
 *   - message_delta(stop_reason=end_turn)
 *
 * **结束**
 * - response.completed → content_block_stop(index=0) + message_stop
 * - 若缺失 completed → 补齐 message_stop 并标记 missingUpstreamCompleted=true
 */
export function transformCodexSSEToClaude(
  codexEvents: CodexSSEEvent[],
  config: SSETransformConfig,
  audit: FieldAuditCollector,
): SSETransformResult {
  const claudeEvents: ClaudeSSEEvent[] = [];

  // 使用闭包维护状态
  const state = createInitialState();

  for (const codexEvent of codexEvents) {
    const transformed = transformSingleEvent(codexEvent, state, config, audit);
    claudeEvents.push(...transformed);

    // 更新 completed 状态
    if (codexEvent.type === 'response.completed') {
      state.completedReceived = true;
    }

    // 检查是否流结束
    if (isStreamEndEvent(codexEvent)) {
      state.messageStopped = true;
      break;
    }
  }

  // 处理流结束但缺失 completed 的情况
  if (!state.completedReceived && !state.messageStopped) {
    // 补齐 message_stop
    claudeEvents.push(createMessageStopEvent());
    audit.setMetadata('missingUpstreamCompleted', true);
  } else if (state.completedReceived && !state.messageStopped) {
    // 正常结束，补齐 content_block_stop 和 message_stop
    if (state.textBlockStarted) {
      claudeEvents.push(createContentBlockStopEvent(0));
    }
    claudeEvents.push(createMessageStopEvent());
  }

  return {
    events: claudeEvents,
    streamEnd: state.messageStopped || state.completedReceived,
  };
}

/**
 * 转换单个 Codex 事件
 */
function transformSingleEvent(
  event: CodexSSEEvent,
  state: State,
  config: SSETransformConfig,
  audit: FieldAuditCollector,
): ClaudeSSEEvent[] {
  const claudeEvents: ClaudeSSEEvent[] = [];

  // 初始化 message_start
  if (!state.messageStarted) {
    claudeEvents.push(createMessageStartEvent());
    claudeEvents.push(createContentBlockStartEvent(0, 'text'));
    state.messageStarted = true;
    state.textBlockStarted = true;
  }

  switch (event.type) {
    case 'response.created':
      // 已在初始化时处理
      break;

    case 'response.output_text.delta': {
      // 文本增量
      claudeEvents.push(createContentBlockDeltaEvent(0, 'text_delta', {
        text: (event as any).delta || '',
      }));
      break;
    }

    case 'response.output_item.done': {
      const item = (event as any).item;

      if (item.type === 'message') {
        // message 类型，可以作为文本输出的一部分
        // 已经处理过 text delta，这里不需要额外处理
      } else if (
        item.type === 'function_call' ||
        item.type === 'custom_tool_call'
      ) {
        // 工具调用
        const toolEvents = transformToolCall(
          item,
          state.currentToolIndex,
          config,
          audit,
        );
        claudeEvents.push(...toolEvents);
        state.currentToolIndex++;
      }
      break;
    }

    case 'response.completed':
      // 流结束标记，在主循环处理
      break;

    case 'response.failed':
      // 错误情况，也要结束流
      claudeEvents.push({
        type: 'error',
        error: {
          message: (event as any).error?.message || 'Upstream request failed',
        },
      });
      break;

    default:
      // 其他事件类型暂不处理
      break;
  }

  return claudeEvents;
}

/**
 * 转换工具调用事件
 */
function transformToolCall(
  item: any,
  toolIndex: number,
  config: SSETransformConfig,
  audit: FieldAuditCollector,
): ClaudeSSEEvent[] {
  const events: ClaudeSSEEvent[] = [];

  let inputJson: string;

  if (item.type === 'function_call') {
    // function_call: arguments 已经是 JSON string
    inputJson = item.arguments || '{}';
  } else {
    // custom_tool_call: input 是 string
    // 根据策略决定如何处理
    if (config.customToolCallStrategy === 'wrap_object') {
      inputJson = JSON.stringify({ input: item.input || '' });
      audit.setMetadata('customToolCallStrategy', 'wrap_object');
    } else {
      // error 策略：抛出错误
      events.push({
        type: 'error',
        error: {
          message: `custom_tool_call.input is string, cannot map to Claude tool_use.input (object required)`,
        },
      });
      return events;
    }
  }

  // content_block_start
  events.push(createContentBlockStartEvent(toolIndex, 'tool_use', {
    id: item.call_id,
    name: item.name,
  }));

  // content_block_delta (input_json_delta)
  events.push(
    createContentBlockDeltaEvent(toolIndex, 'input_json_delta', {
      partial_json: inputJson,
    }),
  );

  // content_block_stop
  events.push(createContentBlockStopEvent(toolIndex));

  // message_delta (触发 tool loop)
  events.push(
    createMessageDeltaEvent({
      stop_reason: config.stopReasonStrategy,
    }),
  );

  return events;
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
  delta: { stop_reason?: string; stop_sequence?: number },
): ClaudeMessageDeltaEvent {
  return {
    type: 'message_delta',
    delta,
  };
}

function createMessageStopEvent(): ClaudeMessageStopEvent {
  return {
    type: 'message_stop',
  };
}
