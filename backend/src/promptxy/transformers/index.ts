/**
 * PromptXY Transformers 模块入口
 *
 * 可审计的协议转换流水线
 */

import { TransformerEngine } from './engine/index.js';
import { Transform } from 'node:stream';
import { createGeminiSSEToClaudeStreamTransformer } from './protocols/gemini/sse/index.js';

// ============================================================
// Public API（供 gateway/preview 调用）
// ============================================================

/**
 * 创建协议转换器
 *
 * 新实现：使用可审计的 TransformerEngine
 */
export function createProtocolTransformer(config?: {
  instructionsTemplate?: string;
  reasoningEffort?: string;
}) {
  return new TransformerEngine(config);
}

/**
 * 创建 SSE 转换流
 *
 * 将 Codex SSE 转换为 Claude SSE
 */
export function createSSETransformStream(transformerName: string) {
  // 仅支持 codex 转换器
  if (transformerName === 'gemini') {
    // Gemini SSE → Claude SSE 转换流（增量）
    let buffer = '';
    let streamEnded = false;

    const geminiTransformer = createGeminiSSEToClaudeStreamTransformer();

    function emitEvents(stream: Transform, events: Array<Record<string, unknown>>) {
      for (const event of events) {
        const eventType = (event as any).type;
        stream.push(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    }

    function processEventBlock(stream: Transform, eventBlock: string) {
      if (streamEnded) return;

      const lines = eventBlock.split('\n');
      const dataLines: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') return;
        dataLines.push(data);
      }

      if (dataLines.length === 0) return;

      // Gemini SSE 通常单行 data: JSON；多行时按 SSE 语义拼接
      const payload = dataLines.join('\n');

      try {
        const chunk = JSON.parse(payload);
        const res = geminiTransformer.pushChunk(chunk);
        emitEvents(stream, res.events as any);
        if (res.streamEnd) {
          streamEnded = true;
        }
      } catch {
        // 可能是分块导致的 JSON 不完整，留给下一次 buffer 补齐
      }
    }

    return new Transform({
      transform(chunk: Buffer, encoding: BufferEncoding, callback) {
        try {
          buffer += chunk.toString('utf-8').replace(/\r\n/g, '\n');

          // SSE 事件以空行分隔
          while (!streamEnded) {
            const idx = buffer.indexOf('\n\n');
            if (idx < 0) break;

            const eventBlock = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            if (eventBlock.trim() === '') continue;
            processEventBlock(this, eventBlock);
          }

          callback();
        } catch (error) {
          callback(error as Error);
        }
      },

      flush(callback) {
        try {
          if (!streamEnded && buffer.trim()) {
            processEventBlock(this, buffer);
            buffer = '';
          }

          if (!streamEnded) {
            const fin = geminiTransformer.finalize();
            emitEvents(this, fin.events as any);
            streamEnded = true;
          }

          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    });
  }

  if (transformerName !== 'codex') {
    // 其他转换器透传
    return new Transform({
      transform(chunk: Buffer, encoding: BufferEncoding, callback) {
        this.push(chunk);
        callback();
      },
    });
  }

  // Codex → Claude SSE 转换流
  let buffer = '';
  let messageStarted = false;
  let textBlockStarted = false;
  let messageStopped = false;
  let pingSent = false;

  return new Transform({
    transform(chunk: Buffer, encoding: BufferEncoding, callback) {
      try {
        buffer += chunk.toString('utf-8');

        // 按空行分割 SSE 事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个可能不完整的块

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (!line.trim().startsWith('data:')) continue;

          const dataContent = line.trim().slice(5).trim();
          if (dataContent === '[DONE]') {
            // 流结束
            if (!messageStopped && messageStarted) {
              this.push('event: message_stop\ndata: {"type":"message_stop"}\n\n');
              messageStopped = true;
            }
            continue;
          }

          try {
            const codexEvent = JSON.parse(dataContent);
            const claudeEvents = transformCodexEventToClaude(codexEvent, {
              messageStarted,
              textBlockStarted,
              pingSent,
            });

            // 更新状态
            messageStarted = claudeEvents.messageStarted;
            textBlockStarted = claudeEvents.textBlockStarted;
            pingSent = claudeEvents.pingSent;

            // 检查是否已经发送了 message_stop
            for (const event of claudeEvents.events) {
              if ((event as any).type === 'message_stop') {
                messageStopped = true;
              }
            }

            // 发送转换后的事件（使用 event: 前缀）
            for (const event of claudeEvents.events) {
              const eventType = (event as any).type;
              this.push(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
            }
          } catch (parseError) {
            // JSON 解析失败，可能是分块传输，继续累积
            // 不做处理，等待下一个 chunk
          }
        }

        callback();
      } catch (error) {
        callback(error as Error);
      }
    },

    flush(callback) {
      // 处理缓冲区中剩余的数据
      if (buffer.trim()) {
        try {
          const dataContent = buffer.trim().startsWith('data:')
            ? buffer.trim().slice(5).trim()
            : buffer.trim();

          if (dataContent && dataContent !== '[DONE]') {
            const codexEvent = JSON.parse(dataContent);
            const claudeEvents = transformCodexEventToClaude(codexEvent, {
              messageStarted,
              textBlockStarted,
              pingSent,
            });

            // 检查是否已经发送了 message_stop
            for (const event of claudeEvents.events) {
              if ((event as any).type === 'message_stop') {
                messageStopped = true;
              }
            }

            for (const event of claudeEvents.events) {
              const eventType = (event as any).type;
              this.push(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
            }
          }
        } catch {
          // 忽略解析错误
        }
      }

      // 仅在未发送 message_stop 时才发送
      if (messageStarted && !messageStopped) {
        this.push('event: message_stop\ndata: {"type":"message_stop"}\n\n');
      }

      callback();
    },
  });
}

/**
 * 转换单个 Codex 事件为 Claude SSE 事件数组
 */
interface TransformState {
  messageStarted: boolean;
  textBlockStarted: boolean;
  pingSent: boolean;
}

interface TransformResult {
  events: Array<Record<string, unknown>>;
  messageStarted: boolean;
  textBlockStarted: boolean;
  pingSent: boolean;
}

function transformCodexEventToClaude(
  codexEvent: Record<string, unknown>,
  state: TransformState,
): TransformResult {
  const events: Array<Record<string, unknown>> = [];
  let newState = { ...state };

  // 初始化 message_start, content_block_start 和 ping
  if (!state.messageStarted) {
    const messageId = `msg-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;

    // message_start 事件
    events.push({
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        model: '',  // TODO: 从原始请求获取模型名
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
        },
      },
    });

    // content_block_start 事件
    events.push({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    });

    // ping 事件
    events.push({
      type: 'ping',
    });

    newState.messageStarted = true;
    newState.textBlockStarted = true;
    newState.pingSent = true;
  }

  const eventType = (codexEvent as any).type;

  switch (eventType) {
    case 'response.created':
      // 已在初始化时处理
      break;

    case 'response.output_text.delta': {
      const delta = (codexEvent as any).delta || '';
      events.push({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: delta },
      });
      break;
    }

    case 'response.output_item.done': {
      const item = (codexEvent as any).item;
      if (item && (item.type === 'function_call' || item.type === 'custom_tool_call')) {
        // 工具调用：生成 tool_use 相关事件
        const toolIndex = 1; // 0 是文本块
        let argumentsJson: string;

        if (item.type === 'function_call') {
          argumentsJson = item.arguments || '{}';
        } else {
          // custom_tool_call: input 是 string，需要包装
          argumentsJson = JSON.stringify({ input: item.input || '' });
        }

        events.push({
          type: 'content_block_start',
          index: toolIndex,
          content_block: {
            type: 'tool_use',
            id: item.call_id,
            name: item.name,
            input: {},
          },
        });
        events.push({
          type: 'content_block_delta',
          index: toolIndex,
          delta: {
            type: 'input_json_delta',
            partial_json: argumentsJson,
          },
        });
        events.push({
          type: 'content_block_stop',
          index: toolIndex,
        });
        events.push({
          type: 'message_delta',
          delta: { stop_reason: 'tool_use', stop_sequence: null },
          usage: { output_tokens: 0 },
        });
      }
      break;
    }

    case 'response.completed':
      // 流正常结束
      events.push({
        type: 'content_block_stop',
        index: 0,
      });
      events.push({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 0 },
      });
      events.push({
        type: 'message_stop',
      });
      break;

    case 'response.failed':
      // 错误情况
      events.push({
        type: 'error',
        error: {
          type: 'api_error',
          message: (codexEvent as any).error?.message || 'Upstream request failed',
        },
      });
      break;

    default:
      // 其他事件类型忽略（如 response.output_item.added）
      break;
  }

  return { events, ...newState };
}

/**
 * 选择转换链（兼容旧 API）
 */
export function selectChain(
  supplier: { transformer?: { default?: string[] } },
  requestPath: string,
): string[] {
  // 简化处理：默认返回空数组
  return supplier?.transformer?.default || [];
}

/**
 * 清理 Headers（兼容旧 API）
 */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    // 跳过某些敏感头
    if (key.toLowerCase() === 'authorization') {
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}

// ============================================================
// 类型导出
// ============================================================

export type {
  // Audit
  JsonPointer,
  EvidenceSource,
  EvidenceRef,
  FieldDiff,
  DefaultSource,
  DefaultedField,
  FieldAudit,
} from './audit/index.js';

export type {
  // Claude
  ClaudeMessagesRequest,
  ClaudeMessage,
  ClaudeContentBlock,
  ClaudeTool,
  ClaudeSSEEvent,
  NormalizedSystem,
  NormalizedMessageContent,
} from './protocols/claude/index.js';

export type {
  // Codex
  CodexResponsesApiRequest,
  CodexResponseItem,
  CodexSSEEvent,
} from './protocols/codex/index.js';

export type {
  // Engine
  TransformRequest,
  TransformResponse,
  TransformTrace,
  TransformConfig,
  ProtocolPair,
} from './engine/index.js';

export type {
  // SSE
  SSEEvent,
} from './sse/index.js';

// ============================================================
// 验证函数（兼容旧 API）
// ============================================================

/**
 * 验证转换器配置（兼容旧 API）
 */
export function validateTransformerConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  // 简化处理
  return {
    valid: true,
    errors: [],
  };
}

/**
 * 验证供应商认证（兼容旧 API）
 */
export function validateSupplierAuth(auth: unknown): {
  valid: boolean;
  errors: string[];
} {
  // 简化处理
  return {
    valid: true,
    errors: [],
  };
}

/**
 * 验证网关认证（兼容旧 API）
 */
export function validateGatewayAuth(auth: unknown): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  // 简化处理
  return {
    valid: true,
    errors: [],
    warnings: [],
  };
}

// ============================================================
// SSE 工具函数导出
// ============================================================

export {
  parseSSEChunk,
  serializeSSEEvent,
  isSSEResponse,
} from './sse/index.js';
