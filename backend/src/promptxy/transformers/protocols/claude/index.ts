/**
 * Claude 协议模块入口
 */

export type {
  ClaudeSystemBlock,
  ClaudeContentBlock,
  ClaudeTextBlock,
  ClaudeImageBlock,
  ClaudeToolUseBlock,
  ClaudeToolResultBlock,
  ClaudeMessage,
  ClaudeTool,
  ClaudeMessagesRequest,
  ClaudeSSEEventType,
  ClaudeContentBlockType,
  ClaudeDeltaType,
  ClaudeMessageStartEvent,
  ClaudeContentBlockStartEvent,
  ClaudeContentBlockDeltaEvent,
  ClaudeContentBlockStopEvent,
  ClaudeMessageDeltaEvent,
  ClaudeMessageStopEvent,
  ClaudeSSEEvent,
  NormalizedSystem,
  NormalizedMessageContent,
} from './types.js';

export {
  normalizeSystem,
  normalizeMessageContent,
  parseClaudeRequest,
  extractSessionId,
} from './parse.js';
