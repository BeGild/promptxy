/**
 * Gemini API v1beta 类型定义
 *
 * 参考: https://ai.google.dev/api/rest/v1beta
 */

/**
 * Gemini 请求体 (generateContent / streamGenerateContent)
 */
export type GeminiGenerateContentRequest = {
  contents?: GeminiContent[];
  systemInstruction?: GeminiSystemInstruction;
  tools?: GeminiTool;
  generationConfig?: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySetting[];
  toolConfig?: GeminiToolConfig;
  cachedContent?: string;
};

/**
 * System Instruction
 */
export type GeminiSystemInstruction = {
  role?: string; // 'user' | 'model' - 固定使用 'user'
  parts: GeminiPart[];
};

/**
 * Content (消息)
 */
export type GeminiContent = {
  role: 'user' | 'model';
  parts: GeminiPart[];
};

/**
 * Part 类型联合
 */
export type GeminiPart =
  | GeminiTextPart
  | GeminiFunctionCallPart
  | GeminiFunctionResponsePart
  | GeminiInlineDataPart
  | GeminiFileDataPart
  | GeminiExecutableCodePart
  | GeminiCodeExecutionResultPart
  | GeminiThoughtPart;

/**
 * Text Part
 */
export type GeminiTextPart = {
  text: string;
};

/**
 * Function Call Part
 */
export type GeminiFunctionCallPart = {
  functionCall: GeminiFunctionCall;
};

/**
 * Function Call
 */
export type GeminiFunctionCall = {
  name: string;
  args?: Record<string, unknown>;
};

/**
 * Function Response Part
 */
export type GeminiFunctionResponsePart = {
  functionResponse: GeminiFunctionResponse;
};

/**
 * Function Response
 */
export type GeminiFunctionResponse = {
  id?: string; // Claude tool_use_id
  name: string;
  response: unknown;
};

/**
 * Inline Data Part (图片等)
 */
export type GeminiInlineDataPart = {
  inlineData: {
    mimeType: string;
    data: string; // base64
  };
};

/**
 * File Data Part
 */
export type GeminiFileDataPart = {
  fileData: {
    mimeType: string;
    fileUri: string;
  };
};

/**
 * Executable Code Part
 */
export type GeminiExecutableCodePart = {
  executableCode: {
    language: string;
    code: string;
  };
};

/**
 * Code Execution Result Part
 */
export type GeminiCodeExecutionResultPart = {
  codeExecutionResult: {
    outcome: 'OUTCOME_OK' | 'OUTCOME_FAILED' | 'OUTCOME_DEADLINE_EXCEEDED';
    output?: string;
  };
};

/**
 * Thought Part (内部思考，需过滤)
 */
export type GeminiThoughtPart = {
  thought: boolean;
};

/**
 * Tool 定义
 */
export type GeminiTool = {
  functionDeclarations?: GeminiFunctionDeclaration[];
};

/**
 * Function Declaration
 */
export type GeminiFunctionDeclaration = {
  name: string;
  description?: string;
  parameters?: GeminiSchema;
};

/**
 * JSON Schema (Gemini 版本)
 */
export type GeminiSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
  enum?: unknown[];
  format?: string;
  // 组合关键字 (需 sanitize)
  anyOf?: GeminiSchema[];
  oneOf?: GeminiSchema[];
  allOf?: GeminiSchema[];
  [key: string]: unknown;
};

/**
 * Generation Config
 */
export type GeminiGenerationConfig = {
  stopSequences?: string[];
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  candidateCount?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseMimeType?: string;
  responseSchema?: GeminiSchema;
};

/**
 * Safety Setting
 */
export type GeminiSafetySetting = {
  category: string;
  threshold: string;
};

/**
 * Tool Config
 */
export type GeminiToolConfig = {
  functionCallingConfig?: {
    mode?: 'MODE_UNSPECIFIED' | 'AUTO' | 'ANY' | 'NONE';
    allowedFunctionNames?: string[];
  };
};

/**
 * Generate Content Response (非流式)
 */
export type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  promptFeedback?: GeminiPromptFeedback;
};

/**
 * Candidate (候选响应)
 */
export type GeminiCandidate = {
  content?: GeminiContent;
  finishReason?: GeminiFinishReason;
  index?: number;
  safetyRatings?: GeminiSafetyRating[];
};

/**
 * Finish Reason 枚举
 */
export type GeminiFinishReason =
  | 'FINISH_REASON_UNSPECIFIED'
  | 'STOP'
  | 'MAX_TOKENS'
  | 'SAFETY'
  | 'RECITATION'
  | 'OTHER'
  | 'BLOCKLIST'
  | 'PROHIBITED_CONTENT'
  | 'SPII'
  | 'MALFORMED_FUNCTION_CALL'
  | 'LANGUAGE'
  | 'IMAGE_PROHIBITED_CONTENT'
  | 'NO_IMAGE'
  | 'UNEXPECTED_TOOL_CALL';

/**
 * Usage Metadata
 */
export type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
};

/**
 * Prompt Feedback
 */
export type GeminiPromptFeedback = {
  blockReason?: string;
  safetyRatings?: GeminiSafetyRating[];
};

/**
 * Safety Rating
 */
export type GeminiSafetyRating = {
  category: string;
  probability: string;
};

/**
 * Count Tokens Request
 */
export type GeminiCountTokensRequest = {
  contents: GeminiContent[];
  systemInstruction?: GeminiSystemInstruction;
  tools?: GeminiTool[];
};

/**
 * Count Tokens Response
 */
export type GeminiCountTokensResponse = {
  totalTokens: number;
};

/**
 * SSE 事件类型
 */
export type GeminiSSEEventType =
  | 'chunk'
  | 'error'
  | 'done';

/**
 * Gemini SSE Chunk
 */
export type GeminiSSEChunk = {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  promptFeedback?: GeminiPromptFeedback;
};
