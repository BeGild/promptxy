/**
 * Gemini 协议模块入口
 */

export type {
  GeminiGenerateContentRequest,
  GeminiSystemInstruction,
  GeminiContent,
  GeminiPart,
  GeminiTextPart,
  GeminiFunctionCallPart,
  GeminiFunctionCall,
  GeminiFunctionResponsePart,
  GeminiFunctionResponse,
  GeminiInlineDataPart,
  GeminiFileDataPart,
  GeminiExecutableCodePart,
  GeminiCodeExecutionResultPart,
  GeminiThoughtPart,
  GeminiTool,
  GeminiFunctionDeclaration,
  GeminiSchema,
  GeminiGenerationConfig,
  GeminiSafetySetting,
  GeminiToolConfig,
  GeminiGenerateContentResponse,
  GeminiCandidate,
  GeminiFinishReason,
  GeminiUsageMetadata,
  GeminiPromptFeedback,
  GeminiSafetyRating,
  GeminiCountTokensRequest,
  GeminiCountTokensResponse,
  GeminiSSEEventType,
  GeminiSSEChunk,
} from './types.js';

export {
  buildGeminiURL,
  buildGeminiPath,
  buildCountTokensURL,
  transformClaudeToGeminiRequest,
  transformHeaders,
  type URLConfig,
  type TransformRequestConfig,
  type TransformContext,
  type SchemaAuditResult,
} from './request.js';

export {
  transformGeminiResponseToClaude,
  type ClaudeMessageResponse,
} from './response.js';

export {
  parseGeminiSSEChunk,
  isGeminiSSEResponse,
  transformGeminiSSEToClaude,
} from './sse/index.js';

export {
  transformClaudeCountTokens,
  transformGeminiCountTokensResponse,
  estimateTokensLocally,
  type CountTokensResult,
} from './count-tokens.js';

export {
  GeminiTransformAuditCollector,
  createGeminiEvidence,
  type GeminiTransformAudit,
} from './audit.js';

export {
  GeminiTransformer,
  type GeminiTransformerConfig,
  type TransformResult,
} from './transformer.js';
