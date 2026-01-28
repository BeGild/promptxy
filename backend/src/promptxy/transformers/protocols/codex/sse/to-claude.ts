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
  /** message_start.message.id（尽量稳定） */
  messageId?: string;
  /** message_start.message.model（尽量来自上游） */
  model?: string;

  /**
   * 当前内容块 index（对齐 CLIProxyAPI：单调递增的 BlockIndex，text/thinking/tool 共用一套 index）
   * - 打开任意 block 时使用当前 blockIndex
   * - 关闭时发送 content_block_stop，并 blockIndex++
   */
  blockIndex: number;

  /** 当前是否有活跃的内容块（与 blockIndex 对应） */
  activeBlockType?: 'text' | 'thinking' | 'tool';

  /** 是否发生过 tool call（用于决定最终 stop_reason） */
  hasToolCall: boolean;

  /** 是否已发送 message_stop */
  messageStopped: boolean;
  /** 是否已收到 response.completed */
  completedReceived: boolean;
  /** 上游 response.completed 中携带的 stop_reason（若存在） */
  upstreamStopReasonRaw?: string;

  /** 最终 usage 是否已输出（防止重复输出 message_delta） */
  finalUsageEmitted: boolean;
  /** 来自上游 response.completed 的 usage（已映射为 Claude 官方字段） */
  upstreamUsage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
  /** 请求侧注入的 input_tokens（用于上游缺失 usage 时兜底） */
  estimatedInputTokens?: number;
  /** 累计已发送到 Claude 的 delta 字符数（用于估算 output_tokens） */
  outputCharCount: number;
};

/**
 * 创建初始状态
 */
function createInitialState(): State {
  return {
    messageStarted: false,
    messageId: undefined,
    model: undefined,

    blockIndex: 0,
    activeBlockType: undefined,

    hasToolCall: false,
    messageStopped: false,
    completedReceived: false,
    upstreamStopReasonRaw: undefined,

    finalUsageEmitted: false,
    upstreamUsage: undefined,
    estimatedInputTokens: undefined,
    outputCharCount: 0,
  };
}

/**
 * 映射 Codex finish_reason 到 Claude stop_reason
 *
 * 参考: refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:327-338
 *
 * 映射规则:
 * - tool_calls → tool_use (模型想要调用工具)
 * - stop → end_turn (模型自然完成响应)
 * - length → max_tokens (达到 max_tokens 限制)
 * - content_filter → end_turn (内容过滤停止)
 * - null/其他 → end_turn (默认情况)
 */
function mapStopReason(codexFinishReason: string | null | undefined): string {
  const mapping: Record<string, string> = {
    'tool_calls': 'tool_use',
    'stop': 'end_turn',
    'length': 'max_tokens',
    'content_filter': 'end_turn',
  };

  if (!codexFinishReason) {
    return 'end_turn';
  }

  return mapping[codexFinishReason] || 'end_turn';
}

/**
 * SSE 转换配置
 */
export type SSETransformConfig = {
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
 * 流式增量转换器（用于 Node Transform 流式 pipe：event-by-event）
 */
export type CodexSSEToClaudeStreamTransformer = {
  pushEvent: (event: CodexSSEEvent) => { events: ClaudeSSEEvent[]; streamEnd: boolean };
  finalize: () => { events: ClaudeSSEEvent[]; streamEnd: boolean };
};

export type SSETransformContext = {
  /** 请求侧注入的 input_tokens（上游缺失 usage 时兜底） */
  estimatedInputTokens?: number;
  /** tool name 反向映射（short -> original） */
  reverseShortNameMap?: Record<string, string>;
};

export function createCodexSSEToClaudeStreamTransformer(
  config: SSETransformConfig,
  audit: FieldAuditCollector,
  context?: SSETransformContext,
): CodexSSEToClaudeStreamTransformer {
  const state = createInitialState();
  state.estimatedInputTokens = context?.estimatedInputTokens;
  // 存储反向映射供后续使用
  const reverseShortNameMap = context?.reverseShortNameMap;
  let ended = false;

  function getResponseObject(event: any): any | undefined {
    const r = event?.response;
    return r && typeof r === 'object' ? r : undefined;
  }

  function maybeCaptureMessageMetadata(event: any) {
    const resp = getResponseObject(event);
    const id = (resp?.id ?? event?.id) as unknown;
    if (typeof id === 'string' && id && !state.messageId) {
      state.messageId = id;
    }

    const model = (resp?.model ?? event?.model) as unknown;
    if (typeof model === 'string' && model && !state.model) {
      state.model = model;
    }
  }

  function normalizeClaudeStopReason(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const s = raw.trim();
    if (!s) return undefined;
    if (s === 'tool_use' || s === 'end_turn' || s === 'max_tokens') return s;
    return undefined;
  }

  function buildFinalStopReason(): string {
    const upstream = normalizeClaudeStopReason(state.upstreamStopReasonRaw);
    if (upstream) return upstream;

    // 上游字段若不是 Claude stop_reason（例如 tool_calls/stop/length），按映射兜底。
    if (typeof state.upstreamStopReasonRaw === 'string' && state.upstreamStopReasonRaw.trim()) {
      return mapStopReason(state.upstreamStopReasonRaw.trim());
    }

    // 与 refence/CLIProxyAPI 对齐：是否发生过 tool call 决定 tool_use / end_turn。
    return state.hasToolCall ? 'tool_use' : 'end_turn';
  }

  function closeOpenBlockIfAny(): ClaudeSSEEvent[] {
    const events: ClaudeSSEEvent[] = [];

    if (state.activeBlockType) {
      events.push(createContentBlockStopEvent(state.blockIndex));
      state.activeBlockType = undefined;
      state.blockIndex++;
    }

    return events;
  }

  function closeMessage(): ClaudeSSEEvent[] {
    if (state.messageStopped) return [];
    state.messageStopped = true;
    return [createMessageStopEvent()];
  }

  function estimateTokensFromChars(chars: number): number {
    return Math.ceil(chars / 3);
  }

  function buildFinalUsage(): {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  } {
    if (state.upstreamUsage) return state.upstreamUsage;

    if (state.estimatedInputTokens === undefined) {
      audit.setMetadata('missingEstimatedInputTokens', true);
    }

    return {
      input_tokens: state.estimatedInputTokens ?? 0,
      output_tokens: estimateTokensFromChars(state.outputCharCount),
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
  }

  function maybeEmitFinalUsageDelta(): ClaudeSSEEvent[] {
    if (state.finalUsageEmitted) return [];
    state.finalUsageEmitted = true;
    return [
      createMessageDeltaEventWithUsage(
        {
          stop_reason: buildFinalStopReason(),
        },
        buildFinalUsage(),
      ),
    ];
  }

  function closeStreamEvents(options?: { emitUsage: boolean }): ClaudeSSEEvent[] {
    const events: ClaudeSSEEvent[] = [];
    events.push(...closeOpenBlockIfAny());
    if (options?.emitUsage !== false) {
      events.push(...maybeEmitFinalUsageDelta());
    }
    events.push(...closeMessage());
    return events;
  }

  function pushEvent(event: CodexSSEEvent): { events: ClaudeSSEEvent[]; streamEnd: boolean } {
    if (ended) return { events: [], streamEnd: true };

    // 尽早捕获 id/model（兼容 flat 与 response.* 嵌套形态）
    maybeCaptureMessageMetadata(event as any);

    const events = transformSingleEvent(event, state, config, audit, reverseShortNameMap);

    if (event.type === 'response.completed') {
      state.completedReceived = true;
    }

    if (event.type === 'response.failed') {
      // 失败场景：对齐参考实现，发 error 后补齐 message_stop（不强制补 usage）
      events.push(...closeStreamEvents({ emitUsage: false }));
      ended = true;
      return { events, streamEnd: true };
    }

    if (isStreamEndEvent(event)) {
      events.push(...closeStreamEvents({ emitUsage: true }));
      ended = true;
      return { events, streamEnd: true };
    }

    return { events, streamEnd: false };
  }

  function finalize(): { events: ClaudeSSEEvent[]; streamEnd: boolean } {
    if (ended) return { events: [], streamEnd: true };

    if (!state.messageStarted) {
      ended = true;
      return { events: [], streamEnd: true };
    }

    const events = closeStreamEvents();

    // finalize 说明上游已经结束但没有显式 response.completed/failed
    if (!state.completedReceived) {
      audit.setMetadata('missingUpstreamCompleted', true);
    }

    ended = true;
    return { events, streamEnd: true };
  }

  return { pushEvent, finalize };
}

/**
 * 转换 Codex SSE 事件为 Claude SSE 事件序列
 *
 * 说明：保留原有"批量转换" API，但内部复用增量状态机，避免与 gateway 流式实现漂移。
 */
export function transformCodexSSEToClaude(
  codexEvents: CodexSSEEvent[],
  config: SSETransformConfig,
  audit: FieldAuditCollector,
  context?: SSETransformContext,
): SSETransformResult {
  const transformer = createCodexSSEToClaudeStreamTransformer(config, audit, context);

  const events: ClaudeSSEEvent[] = [];
  let streamEnd = false;

  for (const codexEvent of codexEvents) {
    const res = transformer.pushEvent(codexEvent);
    events.push(...res.events);
    if (res.streamEnd) {
      streamEnd = true;
    }
  }

  if (!streamEnd) {
    const fin = transformer.finalize();
    events.push(...fin.events);
    streamEnd = fin.streamEnd;
  }

  return { events, streamEnd };
}
/**
 * 转换单个 Codex 事件
 */
function transformSingleEvent(
  event: CodexSSEEvent,
  state: State,
  config: SSETransformConfig,
  audit: FieldAuditCollector,
  reverseShortNameMap?: Record<string, string>,
): ClaudeSSEEvent[] {
  const claudeEvents: ClaudeSSEEvent[] = [];

  // 初始化 message_start（对齐参考：不强制提前创建 text block）
  if (!state.messageStarted) {
    claudeEvents.push(createMessageStartEvent(state.messageId, state.model));
    state.messageStarted = true;
  }

  function ensureTextBlockOpen() {
    if (state.activeBlockType === 'text') return;
    // 确保不会与 tool/thinking block 重叠
    claudeEvents.push(...closeOpenBlockIfAnyForTransform(state, audit));
    claudeEvents.push(createContentBlockStartEvent(state.blockIndex, 'text'));
    state.activeBlockType = 'text';
  }

  function ensureThinkingBlockOpen() {
    if (state.activeBlockType === 'thinking') return;
    claudeEvents.push(...closeOpenBlockIfAnyForTransform(state, audit));
    claudeEvents.push(createContentBlockStartEvent(state.blockIndex, 'thinking'));
    state.activeBlockType = 'thinking';
  }

  switch (event.type) {
    case 'response.created':
      // 已在初始化时处理
      break;

    case 'response.content_part.added': {
      // 对齐 CLIProxyAPI：显式开始 text block
      ensureTextBlockOpen();
      break;
    }

    case 'response.output_text.delta': {
      // 文本增量
      const delta = (event as any).delta || '';
      state.outputCharCount += delta.length;
      ensureTextBlockOpen();
      claudeEvents.push(createContentBlockDeltaEvent(state.blockIndex, 'text_delta', {
        text: delta,
      }));
      break;
    }

    case 'response.content_part.done': {
      // 对齐 CLIProxyAPI：显式关闭 text block
      if (state.activeBlockType === 'text') {
        claudeEvents.push(createContentBlockStopEvent(state.blockIndex));
        state.activeBlockType = undefined;
        state.blockIndex++;
      }
      break;
    }

    case 'response.output_item.added': {
      // 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go:117-144
      const item = (event as any).item;

      if (item.type === 'function_call' || item.type === 'custom_tool_call') {
        state.hasToolCall = true;
        claudeEvents.push(...closeOpenBlockIfAnyForTransform(state, audit));

        // 恢复原始 tool name（如果有反向映射）
        // 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go:126-134
        const originalName = reverseShortNameMap?.[item.name] || item.name;

        // content_block_start (tool_use)
        claudeEvents.push(createContentBlockStartEvent(state.blockIndex, 'tool_use', {
          id: item.call_id,
          name: originalName,
        }));

        // content_block_delta (空字符串，关键！)
        claudeEvents.push(createContentBlockDeltaEvent(state.blockIndex, 'input_json_delta', {
          partial_json: '',
        }));

        state.activeBlockType = 'tool';
      }
      break;
    }

    case 'response.function_call_arguments.delta': {
      // 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go:155-162
      if (state.activeBlockType !== 'tool') {
        audit.setMetadata('unexpectedFunctionCallDelta', true);
        break;
      }

      const delta = (event as any).delta || '';
      state.outputCharCount += delta.length;

      claudeEvents.push(createContentBlockDeltaEvent(
        state.blockIndex,
        'input_json_delta',
        { partial_json: delta }
      ));
      break;
    }

    case 'response.output_item.done': {
      // 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go:145-154
      const item = (event as any).item;

      if (item.type === 'message') {
        // message 类型：如仍有 text block 未关闭，关闭它
        if (state.activeBlockType === 'text') {
          claudeEvents.push(createContentBlockStopEvent(state.blockIndex));
          state.activeBlockType = undefined;
          state.blockIndex++;
        }
      } else if (
        item.type === 'function_call' ||
        item.type === 'custom_tool_call'
      ) {
        // 工具调用：发送 content_block_stop 并推进 blockIndex
        if (state.activeBlockType === 'tool') {
          claudeEvents.push(createContentBlockStopEvent(state.blockIndex));
          state.activeBlockType = undefined;
          state.blockIndex++;
        }
      }
      break;
    }

    case 'response.reasoning_text.delta': {
      // 推理内容增量
      // 参考: refence/cc-switch/src-tauri/src/proxy/providers/streaming.rs:147-175
      const reasoningEvent = event as any;
      const delta = reasoningEvent.delta || '';
      state.outputCharCount += delta.length;
      ensureThinkingBlockOpen();
      claudeEvents.push(createContentBlockDeltaEvent(state.blockIndex, 'thinking_delta', {
        thinking: delta,
      }));
      break;
    }

    case 'response.reasoning_summary_part.added': {
      // 对齐 CLIProxyAPI：显式开始 thinking block（summary）
      ensureThinkingBlockOpen();
      break;
    }

    case 'response.reasoning_summary_text.delta': {
      // 推理摘要增量（与 reasoning_text.delta 类似处理）
      const reasoningEvent = event as any;
      const delta = reasoningEvent.delta || '';
      state.outputCharCount += delta.length;
      ensureThinkingBlockOpen();
      claudeEvents.push(createContentBlockDeltaEvent(state.blockIndex, 'thinking_delta', {
        thinking: delta,
      }));
      break;
    }

    case 'response.reasoning_summary_part.done': {
      // 对齐 CLIProxyAPI：显式关闭 thinking block（summary）
      if (state.activeBlockType === 'thinking') {
        claudeEvents.push(createContentBlockStopEvent(state.blockIndex));
        state.activeBlockType = undefined;
        state.blockIndex++;
      }
      break;
    }

    case 'response.completed': {
      // 从 response.completed 中提取 usage 信息
      const completedEvent = event as any;
      const resp = completedEvent?.response && typeof completedEvent.response === 'object'
        ? completedEvent.response
        : undefined;
      const codexUsage = resp?.usage ?? completedEvent.usage;

      // 尝试读取上游 stop_reason（不同实现可能放在不同位置；若不存在则由 hasToolCall 决定）
      const upstreamStopReasonCandidate =
        resp?.stop_reason ??
        completedEvent?.stop_reason ??
        resp?.metadata?.stop_reason;
      if (typeof upstreamStopReasonCandidate === 'string' && upstreamStopReasonCandidate.trim()) {
        state.upstreamStopReasonRaw = upstreamStopReasonCandidate.trim();
      }

      if (codexUsage) {
        const cachedTokens = codexUsage.input_tokens_details?.cached_tokens || 0;
        const inputTokens = codexUsage.input_tokens || 0;
        const adjustedInputTokens = Math.max(inputTokens - cachedTokens, 0);

        // 对齐 Claude 官方 usage 字段
        state.upstreamUsage = {
          // 对齐 CLIProxyAPI：input_tokens 扣除 cached_tokens，cache_read_input_tokens 单独反映命中
          input_tokens: adjustedInputTokens,
          output_tokens: codexUsage.output_tokens || 0,
          cache_read_input_tokens: cachedTokens,
          cache_creation_input_tokens: 0,
        };

        // reasoning_tokens 仅用于审计，不进入 Claude SSE usage
        const reasoningTokens = codexUsage.output_tokens_details?.reasoning_tokens;
        if (typeof reasoningTokens === 'number' && reasoningTokens > 0) {
          audit.setMetadata('upstream_reasoning_tokens', reasoningTokens);
        }
      }

      // 结束时的 message_delta(usage) 由 closeStreamEvents/finalize 统一补发
      break;
    }

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

function closeOpenBlockIfAnyForTransform(state: State, audit: FieldAuditCollector): ClaudeSSEEvent[] {
  if (!state.activeBlockType) return [];
  audit.setMetadata('closedOverlappingBlock', true);
  const events: ClaudeSSEEvent[] = [
    createContentBlockStopEvent(state.blockIndex),
  ];
  state.activeBlockType = undefined;
  state.blockIndex++;
  return events;
}

// ===== Claude SSE 事件工厂函数 =====

function createMessageStartEvent(messageId?: string, model?: string): ClaudeMessageStartEvent {
  return {
    type: 'message_start',
    message: {
      id: messageId ?? '',
      type: 'message',
      role: 'assistant',
      content: [],
      model: model ?? '',
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      },
    },
  };
}

function createContentBlockStartEvent(
  index: number,
  blockType: 'text' | 'tool_use' | 'thinking',
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
  } else if (blockType === 'thinking') {
    event.content_block.thinking = '';
  } else if (blockType === 'tool_use' && extras) {
    event.content_block.id = extras.id;
    event.content_block.name = extras.name;
  }

  return event;
}

function createContentBlockDeltaEvent(
  index: number,
  deltaType: 'text_delta' | 'input_json_delta' | 'thinking_delta',
  content: { text?: string; partial_json?: string; thinking?: string },
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
  } else if (deltaType === 'thinking_delta' && content.thinking !== undefined) {
    event.delta.thinking = content.thinking;
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

function createMessageDeltaEventWithUsage(
  delta: { stop_reason?: string; stop_sequence?: number },
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  },
): ClaudeMessageDeltaEvent {
  return {
    type: 'message_delta',
    delta,
    usage,
  };
}

function createMessageStopEvent(): ClaudeMessageStopEvent {
  return {
    type: 'message_stop',
  };
}
