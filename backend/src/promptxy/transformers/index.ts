/**
 * PromptXY Transformers 模块入口
 *
 * 可审计的协议转换流水线
 */

import { TransformerEngine } from './engine/index.js';
import { Transform } from 'node:stream';
import { createGeminiSSEToClaudeStreamTransformer } from './protocols/gemini/sse/index.js';
import { parseSSEChunk, serializeSSEEvent } from './sse/index.js';
import { createCodexSSEToClaudeStreamTransformer } from './protocols/codex/sse/to-claude.js';
import { createOpenAIChatToClaudeSSETransformer } from './protocols/openai-chat/sse/to-claude.js';
import { FieldAuditCollector } from './audit/field-audit.js';
import type { CodexSSEEvent } from './protocols/codex/types.js';
import type { ClaudeSSEEvent } from './protocols/claude/types.js';
import type { ChatSSEEvent } from './protocols/openai-chat/types.js';

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
 * SSE 转换流上下文参数
 */
export type SSETransformStreamOptions = {
  /** 请求侧注入的 input_tokens（用于上游缺失 usage 时兜底） */
  estimatedInputTokens?: number;
};

/**
 * 创建 SSE 转换流
 *
 * 将 Codex SSE 转换为 Claude SSE
 */
export function createSSETransformStream(transformerName: string, options?: SSETransformStreamOptions) {
  // OpenAI Chat SSE → Claude SSE 转换流
  if (transformerName === 'openai-chat') {
    let buffer = '';
    let streamEnded = false;

    const transformer = createOpenAIChatToClaudeSSETransformer(
      {},
      { estimatedInputTokens: options?.estimatedInputTokens },
    );

    function pushOpenAIChatEvent(stream: Transform, event: ChatSSEEvent) {
      const res = transformer.pushEvent(event);
      emitClaudeEvents(stream, res.events);
      if (res.streamEnd) {
        streamEnded = true;
      }
    }

    function finalizeTransformer(stream: Transform) {
      const res = transformer.finalize();
      emitClaudeEvents(stream, res.events);
      streamEnded = true;
    }

    function processEventBlock(stream: Transform, eventBlock: string) {
      if (streamEnded) return;

      const sseEvents = parseSSEChunk(eventBlock + '\n\n');
      for (const sseEvent of sseEvents) {
        const data = sseEvent.data.trim();
        if (!data) continue;
        if (data === '[DONE]') {
          finalizeTransformer(stream);
          return;
        }

        try {
          const event = JSON.parse(data) as ChatSSEEvent;
          pushOpenAIChatEvent(stream, event);
        } catch {
          // 解析失败：忽略
        }
      }
    }

    return new Transform({
      transform(chunk: Buffer, encoding: BufferEncoding, callback) {
        try {
          buffer += chunk.toString('utf-8').replace(/\r\n/g, '\n');

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
            finalizeTransformer(this);
          }

          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    });
  }

  // Gemini SSE → Claude SSE 转换流（增量）
  if (transformerName === 'gemini') {
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

  // 其他转换器透传（不包括 codex，codex 在下面处理）
  if (transformerName !== 'codex') {
    return new Transform({
      transform(chunk: Buffer, encoding: BufferEncoding, callback) {
        this.push(chunk);
        callback();
      },
    });
  }

  // Codex → Claude SSE 转换流（统一使用 protocols/codex/sse/to-claude.ts 状态机）
  let buffer = '';
  let streamEnded = false;

  const audit = new FieldAuditCollector();
  const transformer = createCodexSSEToClaudeStreamTransformer(
    { customToolCallStrategy: 'wrap_object' },
    audit,
    { estimatedInputTokens: options?.estimatedInputTokens },
  );

  function pushCodexEvent(stream: Transform, event: CodexSSEEvent) {
    const res = transformer.pushEvent(event);
    emitClaudeEvents(stream, res.events);
    if (res.streamEnd) {
      streamEnded = true;
    }
  }

  function finalizeTransformer(stream: Transform) {
    const res = transformer.finalize();
    emitClaudeEvents(stream, res.events);
    streamEnded = true;
  }

  function emitClaudeEvents(stream: Transform, events: ClaudeSSEEvent[]) {
    for (const event of events) {
      stream.push(serializeSSEEvent({ event: event.type, data: JSON.stringify(event) }));
    }
  }

  function processEventBlock(stream: Transform, eventBlock: string) {
    if (streamEnded) return;

    // 复用通用 SSE 解析：正确处理多行 data:
    const sseEvents = parseSSEChunk(eventBlock + '\n\n');
    for (const sseEvent of sseEvents) {
      const data = sseEvent.data.trim();
      if (!data) continue;
      if (data === '[DONE]') {
        // 某些上游/代理会用 [DONE] 作为 SSE 终止信号。
        // 但 Claude 侧需要 message_stop 才能结束等待，因此这里必须 finalize 状态机补齐收尾事件。
        finalizeTransformer(stream);
        return;
      }

      try {
        const event = JSON.parse(data) as CodexSSEEvent;
        pushCodexEvent(stream, event);
      } catch {
        // 解析失败：忽略（上游可能发送非 JSON 的 data 行）
      }
    }
  }

  return new Transform({
    transform(chunk: Buffer, encoding: BufferEncoding, callback) {
      try {
        buffer += chunk.toString('utf-8').replace(/\r\n/g, '\n');

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

        // 若 upstream 没有显式结束，也让状态机补齐 message_stop
        if (!streamEnded) {
          finalizeTransformer(this);
        }

        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
  });
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
