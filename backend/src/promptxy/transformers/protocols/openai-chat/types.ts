/**
 * OpenAI Chat Completions 类型定义
 *
 * 参考: https://platform.openai.com/docs/api-reference/chat/create
 */

/**
 * Chat 消息角色
 */
export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Chat 消息内容
 */
export type ChatMessageContent =
  | string
  | Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: {
        url: string;
      };
    }>;

/**
 * Chat 消息
 */
export type ChatMessage = {
  role: ChatMessageRole;
  content: ChatMessageContent;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string; // 用于 tool 角色消息
  name?: string; // tool 角色时可指定工具名称
};

/**
 * Chat 工具定义
 */
export type ChatTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    strict?: boolean;
  };
};

/**
 * Tool choice
 */
export type ChatToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function'; function_name: string };

/**
 * Finish reason
 */
export type ChatFinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'function_call'; // 旧版兼容

/**
 * Usage 信息
 */
export type ChatUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
};

/**
 * Choice
 */
export type ChatChoice = {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
  finish_reason: ChatFinishReason | null;
};

/**
 * Chat Completions 请求
 */
export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  tool_choice?: ChatToolChoice;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string | string[];
};

/**
 * Chat Completions 响应
 */
export type ChatCompletionResponse = {
  id: string;
  choices: ChatChoice[];
  usage?: ChatUsage;
  model?: string;
};

/**
 * Chat Completion SSE 事件类型
 */
export type ChatSSEEventType =
  | 'message'
  | 'delta'
  | 'done'
  | 'error';

/**
 * SSE Delta
 */
export type ChatSSEDelta = {
  role?: 'assistant';
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
};

/**
 * SSE Choice
 */
export type ChatSSEChoice = {
  index: number;
  delta: ChatSSEDelta;
  finish_reason: ChatFinishReason | null;
};

/**
 * SSE 事件（data 字段解析后的 JSON）
 */
export type ChatSSEEvent =
  | {
      choices: ChatSSEChoice[];
      usage?: ChatUsage;
    }
  | { [key: string]: never }; // [DONE] 标记
