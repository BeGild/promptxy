/**
 * Claude Messages API 类型定义
 *
 * 参考: refence/claude-code-router
 */

/**
 * System Block（Claude 支持 string 或 blocks 数组）
 */
export type ClaudeSystemBlock =
  | { type: 'text'; text: string | string[] }
  | { type: 'image'; source: { type: 'url'; url: string } };

/**
 * Content Block 类型
 */
export type ClaudeContentBlock =
  | ClaudeTextBlock
  | ClaudeImageBlock
  | ClaudeToolUseBlock
  | ClaudeToolResultBlock;

/**
 * Text Block
 */
export type ClaudeTextBlock = {
  type: 'text';
  text: string;
};

/**
 * Image Block
 */
export type ClaudeImageBlock = {
  type: 'image';
  source: {
    type: 'url';
    url: string;
  };
};

/**
 * Tool Use Block
 */
export type ClaudeToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};

/**
 * Tool Result Block
 */
export type ClaudeToolResultBlock = {
  type: 'tool_result';
  tool_use_id: string;
  content?: string | Array<ClaudeTextBlock | ClaudeImageBlock>;
  is_error?: boolean;
};

/**
 * Message
 */
export type ClaudeMessage = {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
};

/**
 * Tool Definition
 */
export type ClaudeTool = {
  name: string;
  description?: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
};

/**
 * Claude Messages API 请求体
 */
export type ClaudeMessagesRequest = {
  model: string;
  messages: ClaudeMessage[];
  system?: string | ClaudeSystemBlock[];
  tools?: ClaudeTool[];
  metadata?: {
    user_id?: string;
    [key: string]: unknown;
  };
  thinking?: {
    type: 'enabled';
    budget_tokens?: number;
  };
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  [key: string]: unknown;
};

/**
 * SSE 事件类型
 */
export type ClaudeSSEEventType =
  | 'message_start'
  | 'message_delta'
  | 'message_stop'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'error'
  | 'ping';

/**
 * Content Block 类型
 */
export type ClaudeContentBlockType = 'text' | 'tool_use';

/**
 * Delta 类型
 */
export type ClaudeDeltaType = 'text_delta' | 'input_json_delta';

/**
 * message_start 事件
 */
export type ClaudeMessageStartEvent = {
  type: 'message_start';
  message: {
    id: string;
    role: 'assistant';
    content: Array<{ type: ClaudeContentBlockType }>;
    model: string;
    stop_reason: string | null;
  };
};

/**
 * content_block_start 事件
 */
export type ClaudeContentBlockStartEvent = {
  type: 'content_block_start';
  index: number;
  content_block: {
    type: ClaudeContentBlockType;
    text?: string;
    id?: string;
    name?: string;
  };
};

/**
 * content_block_delta 事件
 */
export type ClaudeContentBlockDeltaEvent = {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: ClaudeDeltaType;
    text?: string;
    partial_json?: string;
  };
};

/**
 * content_block_stop 事件
 */
export type ClaudeContentBlockStopEvent = {
  type: 'content_block_stop';
  index: number;
};

/**
 * message_delta 事件
 */
export type ClaudeMessageDeltaEvent = {
  type: 'message_delta';
  delta: {
    stop_reason?: string;
    stop_sequence?: number;
  };
  usage?: {
    output_tokens: number;
  };
};

/**
 * message_stop 事件
 */
export type ClaudeMessageStopEvent = {
  type: 'message_stop';
};

/**
 * Claude SSE 事件
 */
export type ClaudeSSEEvent =
  | ClaudeMessageStartEvent
  | ClaudeContentBlockStartEvent
  | ClaudeContentBlockDeltaEvent
  | ClaudeContentBlockStopEvent
  | ClaudeMessageDeltaEvent
  | ClaudeMessageStopEvent
  | { type: 'error'; error: { message: string } }
  | { type: 'ping' };

/**
 * 规范化后的 System（统一转为 string）
 */
export type NormalizedSystem = {
  text: string;
  originalType: 'string' | 'blocks';
  hasEnvSeparator: boolean;
};

/**
 * 规范化后的 Message Content（统一转为 blocks）
 */
export type NormalizedMessageContent = {
  blocks: ClaudeContentBlock[];
  originalType: 'string' | 'blocks';
};
