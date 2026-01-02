/**
 * PromptXY Transformers 模块入口
 *
 * 导出所有协议转换相关的功能
 */

// 类型定义
export type {
  TransformerStep,
  TransformerChain,
  TransformerConfig,
  SupplierAuth,
  GatewayAuth,
} from '../types.js';

export type {
  TransformRequest,
  TransformResponse,
  TransformPreview,
  TransformTrace,
  TransformStepResult,
  TransformerMetadata,
  ITransformerRegistry,
} from './types.js';

// 注册表
export {
  TransformerRegistry,
  getGlobalRegistry,
} from './registry.js';

// 兼容层
export {
  ProtocolTransformer,
  createProtocolTransformer,
  selectChain,
  sanitizeHeaders,
} from './llms-compat.js';

// 配置验证
export {
  validateTransformerConfig,
  validateSupplierAuth,
  validateGatewayAuth,
} from './validation.js';

// SSE 转换
export {
  parseSSEChunk,
  serializeSSEEvent,
  isSSEResponse,
  transformOpenAIChunkToAnthropic,
  transformGeminiChunkToAnthropic,
  createSSETransformStream,
} from './sse.js';
export type { SSEEvent } from './sse.js';
