/**
 * Claude → Codex 转换 Fixtures
 *
 * 端到端测试样例，用于验证 tool call 闭环
 */

import type { ClaudeMessagesRequest } from '../protocols/claude/types.js';
import type { CodexResponsesApiRequest } from '../protocols/codex/types.js';

/**
 * Fixture 1: 纯文本请求（无工具调用）
 */
export const pureTextRequestFixture: {
  claude: ClaudeMessagesRequest;
  expectedCodex: Partial<CodexResponsesApiRequest>;
} = {
  claude: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: 'Hello, how are you?',
      },
    ],
  },
  expectedCodex: {
    model: 'claude-sonnet-4-20250514',
    instructions: '',
    input: [
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Hello, how are you?',
          },
        ],
      },
    ],
    tools: [],
    tool_choice: 'auto',
    parallel_tool_calls: false,
    stream: true,
    include: [],
    store: true,
  },
};

/**
 * Fixture 2: 单次工具调用（tool_use + tool_result）
 */
export const singleToolCallFixture: {
  claude: ClaudeMessagesRequest;
  expectedCodex: Partial<CodexResponsesApiRequest>;
} = {
  claude: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: 'What is the weather in Tokyo?',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01D27FLF7CT8KTFM8K2V6KV9',
            name: 'get_weather',
            input: {
              location: 'Tokyo',
              unit: 'celsius',
            },
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_01D27FLF7CT8KTFM8K2V6KV9',
            content: '{"temperature": 22, "condition": "sunny"}',
          },
        ],
      },
    ],
  },
  expectedCodex: {
    model: 'claude-sonnet-4-20250514',
    instructions: '',
    input: [
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'What is the weather in Tokyo?',
          },
        ],
      },
      {
        type: 'function_call',
        call_id: 'toolu_01D27FLF7CT8KTFM8K2V6KV9',
        name: 'get_weather',
        arguments: '{"location":"Tokyo","unit":"celsius"}',
      },
      {
        type: 'function_call_output',
        call_id: 'toolu_01D27FLF7CT8KTFM8K2V6KV9',
        output: '{"temperature": 22, "condition": "sunny"}',
      },
    ],
    tools: [],
    tool_choice: 'auto',
    parallel_tool_calls: false,
    stream: true,
    include: [],
    store: true,
  },
};

/**
 * Fixture 3: 多次工具调用（call_id 对称性）
 */
export const multipleToolCallsFixture: {
  claude: ClaudeMessagesRequest;
  expectedCodex: Partial<CodexResponsesApiRequest>;
} = {
  claude: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: 'Get weather for Tokyo and Paris',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01ABC123DEF456',
            name: 'get_weather',
            input: {
              location: 'Tokyo',
            },
          },
          {
            type: 'tool_use',
            id: 'toolu_01XYZ789ABC012',
            name: 'get_weather',
            input: {
              location: 'Paris',
            },
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_01ABC123DEF456',
            content: '22°C, sunny',
          },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_01XYZ789ABC012',
            content: '18°C, cloudy',
          },
        ],
      },
    ],
  },
  expectedCodex: {
    model: 'claude-sonnet-4-20250514',
    instructions: '',
    input: [
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Get weather for Tokyo and Paris',
          },
        ],
      },
      {
        type: 'function_call',
        call_id: 'toolu_01ABC123DEF456',
        name: 'get_weather',
        arguments: '{"location":"Tokyo"}',
      },
      {
        type: 'function_call',
        call_id: 'toolu_01XYZ789ABC012',
        name: 'get_weather',
        arguments: '{"location":"Paris"}',
      },
      {
        type: 'function_call_output',
        call_id: 'toolu_01ABC123DEF456',
        output: '22°C, sunny',
      },
      {
        type: 'function_call_output',
        call_id: 'toolu_01XYZ789ABC012',
        output: '18°C, cloudy',
      },
    ],
    tools: [],
    tool_choice: 'auto',
    parallel_tool_calls: false,
    stream: true,
    include: [],
    store: true,
  },
};

/**
 * Fixture 4: 带 system 的请求
 */
export const withSystemFixture: {
  claude: ClaudeMessagesRequest;
  template?: string;
  expectedCodex: Partial<CodexResponsesApiRequest>;
} = {
  claude: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: 'You are a helpful assistant.',
    messages: [
      {
        role: 'user',
        content: 'Hello',
      },
    ],
  },
  template: 'You are Claude, an AI assistant.',
  expectedCodex: {
    model: 'claude-sonnet-4-20250514',
    instructions: 'You are Claude, an AI assistant.\n\nYou are a helpful assistant.',
    input: [
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Hello',
          },
        ],
      },
    ],
    tools: [],
    tool_choice: 'auto',
    parallel_tool_calls: false,
    stream: true,
    include: [],
    store: true,
  },
};

/**
 * Fixture 5: 带 tools 的请求
 */
export const withToolsFixture: {
  claude: ClaudeMessagesRequest;
  expectedCodex: Partial<CodexResponsesApiRequest>;
} = {
  claude: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: 'What is the weather in Tokyo?',
      },
    ],
    tools: [
      {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        input_schema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state',
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
            },
          },
          required: ['location'],
        },
      },
    ],
  },
  expectedCodex: {
    model: 'claude-sonnet-4-20250514',
    instructions: '',
    input: [
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'What is the weather in Tokyo?',
          },
        ],
      },
    ],
    tools: [
      {
        type: 'function',
        name: 'get_weather',
        description: 'Get the current weather for a location',
        strict: true,
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state',
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
            },
          },
          required: ['location'],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: 'auto',
    parallel_tool_calls: false,
    stream: true,
    include: [],
    store: true,
  },
};

/**
 * Fixture 6: Codex SSE 响应样例（带 tool call）
 */
export const codexSSEResponseFixture = {
  chunks: [
    'data: {"type":"response.created","id":"resp_123","status":"in_progress"}\n\n',
    'data: {"type":"response.output_text.delta","delta":"I\'ll check"}\n\n',
    'data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"toolu_01ABC","name":"get_weather","arguments":"{\\"location\\": \\"Tokyo\\"}"}}\n\n',
    'data: {"type":"response.completed","id":"resp_123"}\n\n',
  ],
  expectedClaudeSSE: [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"","role":"assistant","content":[],"model":"","stop_reason":null}}\n\n',
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"I\'ll check"}}\n\n',
    'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_01ABC","name":"get_weather"}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"location\\": \\"Tokyo\\"}"}}\n\n',
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":1}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ],
};

/**
 * 测试用例导出
 */
export const testFixtures = {
  pureText: pureTextRequestFixture,
  singleToolCall: singleToolCallFixture,
  multipleToolCalls: multipleToolCallsFixture,
  withSystem: withSystemFixture,
  withTools: withToolsFixture,
  codexSSE: codexSSEResponseFixture,
};
