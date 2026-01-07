/**
 * Codex Responses API 类型定义
 *
 * 参考: refence/codex/codex-rs/protocol/src/models.rs
 */

/**
 * ResponseItem 类型
 */
export type CodexResponseItem =
  | CodexMessageItem
  | CodexFunctionCallItem
  | CodexFunctionCallOutputItem
  | CodexCustomToolCallItem
  | CodexCustomToolCallOutputItem
  | CodexLocalShellCallItem
  | CodexWebSearchCallItem;

/**
 * Message Item
 */
export type CodexMessageItem = {
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  content: CodexContentItem[];
};

/**
 * Content Item（用于 message.content）
 */
export type CodexContentItem =
  | CodexInputTextItem
  | CodexInputImageItem
  | CodexOutputTextItem;

/**
 * Input Text Item
 */
export type CodexInputTextItem = {
  type: 'input_text';
  text: string;
};

/**
 * Input Image Item
 */
export type CodexInputImageItem = {
  type: 'input_image';
  image_url?: string;
  source?: {
    type: 'url';
    url: string;
  };
};

/**
 * Output Text Item
 */
export type CodexOutputTextItem = {
  type: 'output_text';
  text: string;
};

/**
 * Function Call Item
 */
export type CodexFunctionCallItem = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string; // JSON string
};

/**
 * Function Call Output Item
 */
export type CodexFunctionCallOutputItem = {
  type: 'function_call_output';
  call_id: string;
  output: string | CodexContentItem[] | { content: string; success?: boolean };
};

/**
 * Custom Tool Call Item
 */
export type CodexCustomToolCallItem = {
  type: 'custom_tool_call';
  call_id: string;
  name: string;
  input: string; // JSON string
};

/**
 * Custom Tool Call Output Item
 */
export type CodexCustomToolCallOutputItem = {
  type: 'custom_tool_call_output';
  call_id: string;
  output: string | CodexContentItem[];
};

/**
 * Local Shell Call Item
 */
export type CodexLocalShellCallItem = {
  type: 'local_shell_call';
  call_id: string;
  name: string;
  arguments: string; // JSON string
};

/**
 * Web Search Call Item
 */
export type CodexWebSearchCallItem = {
  type: 'web_search_call';
  call_id: string;
  query: string;
};

/**
 * Tool Definition（Responses API）
 */
export type CodexResponsesApiTool = {
  type: 'function';
  name: string;
  description?: string;
  strict?: boolean;
  parameters?: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: unknown;
  };
};

/**
 * Reasoning 配置
 */
export type CodexReasoning = {
  effort?: string;
  summary?: {
    enable?: boolean;
    max_length?: number;
  };
};

/**
 * Text 配置
 */
export type CodexText = {
  verbosity?: 'low' | 'medium' | 'high';
  format?: {
    type: 'json_schema';
    strict: boolean;
    schema: Record<string, unknown>;
    name?: string;
  };
};

/**
 * Responses API 请求体
 */
export type CodexResponsesApiRequest = {
  model: string;
  instructions: string;
  input: CodexResponseItem[];
  tools: any[];
  tool_choice: string;
  parallel_tool_calls: boolean;
  reasoning?: CodexReasoning;
  store: boolean;
  stream: boolean;
  include: string[];
  prompt_cache_key?: string;
  text?: CodexText;
};

/**
 * SSE 事件类型（data.type 字段）
 */
export type CodexSSEEventType =
  | 'response.created'
  | 'response.output_text.delta'
  | 'response.output_item.added'
  | 'response.output_item.done'
  | 'response.reasoning_text.delta'
  | 'response.reasoning_summary_text.delta'
  | 'response.failed'
  | 'response.completed';

/**
 * response.created 事件
 */
export type CodexResponseCreatedEvent = {
  type: 'response.created';
  id: string;
  status: string;
};

/**
 * response.output_text.delta 事件
 */
export type CodexOutputTextDeltaEvent = {
  type: 'response.output_text.delta';
  delta: string;
};

/**
 * Output Item（用于 output_item.done）
 */
export type CodexOutputItem =
  | CodexOutputMessageItem
  | CodexOutputFunctionCallItem
  | CodexOutputCustomToolCallItem;

/**
 * Output Message Item
 */
export type CodexOutputMessageItem = {
  type: 'message';
  role: 'assistant';
  content: CodexContentItem[];
};

/**
 * Output Function Call Item
 */
export type CodexOutputFunctionCallItem = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string; // JSON string
};

/**
 * Output Custom Tool Call Item
 */
export type CodexOutputCustomToolCallItem = {
  type: 'custom_tool_call';
  call_id: string;
  name: string;
  input: string; // JSON string
};

/**
 * response.output_item.added 事件
 */
export type CodexOutputItemAddedEvent = {
  type: 'response.output_item.added';
  item: CodexOutputItem;
};

/**
 * response.output_item.done 事件
 */
export type CodexOutputItemDoneEvent = {
  type: 'response.output_item.done';
  item: CodexOutputItem;
};

/**
 * response.failed 事件
 */
export type CodexResponseFailedEvent = {
  type: 'response.failed';
  error: {
    message: string;
    code?: string;
  };
};

/**
 * response.completed 事件
 */
export type CodexResponseCompletedEvent = {
  type: 'response.completed';
  id: string;
};

/**
 * Codex SSE 事件
 */
export type CodexSSEEvent =
  | CodexResponseCreatedEvent
  | CodexOutputTextDeltaEvent
  | CodexOutputItemAddedEvent
  | CodexOutputItemDoneEvent
  | CodexResponseFailedEvent
  | CodexResponseCompletedEvent;
