/**
 * PromptXY Transformers 模块入口
 *
 * 可审计的协议转换流水线
 */

import { TransformerEngine } from './engine/index.js';
import { Transform } from 'node:stream';

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
  // 创建一个 Node.js Transform stream
  return new Transform({
    transform(chunk: Buffer, encoding: BufferEncoding, callback) {
      try {
        // 目前简单透传，后续实现实际的转换
        this.push(chunk);
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
