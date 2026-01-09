/**
 * Claude → Gemini 请求转换
 */

import type {
  GeminiGenerateContentRequest,
  GeminiContent,
  GeminiPart,
  GeminiTextPart,
  GeminiFunctionCallPart,
  GeminiFunctionResponsePart,
  GeminiSystemInstruction,
  GeminiTool,
  GeminiFunctionDeclaration,
  GeminiSchema,
  GeminiGenerationConfig,
} from './types.js';
import type {
  ClaudeMessage,
  ClaudeContentBlock,
  ClaudeToolUseBlock,
  ClaudeToolResultBlock,
  ClaudeTool,
  ClaudeTextBlock,
  ClaudeImageBlock,
} from '../claude/types.js';

/**
 * URL 构造配置
 */
export interface URLConfig {
  baseUrl: string;
  model: string;
  stream: boolean;
  apiKey?: string;
}

/**
 * 构造 Gemini 上游 Path（不含 baseUrl）
 *
 * 说明：
 * - Gateway 当前使用 joinUrl(baseUrl, path, search) 的拼接方式。
 * - 为避免密钥在 trace/历史里出现明文，这里不注入 `key=` 查询参数，认证统一走 supplier.auth 注入。
 * - 仅在 stream 时追加 `?alt=sse`（Gemini v1beta 标准行为）。
 */
export function buildGeminiPath(config: Omit<URLConfig, 'apiKey'>): string {
  const { baseUrl, model, stream } = config;

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const hasVersion = normalizedBase.includes('/v1beta');
  const hasModels = normalizedBase.includes('/models');

  const action = stream ? 'streamGenerateContent' : 'generateContent';

  let path: string;
  if (hasModels) {
    path = `/${model}:${action}`;
  } else if (hasVersion) {
    path = `/models/${model}:${action}`;
  } else {
    path = `/v1beta/models/${model}:${action}`;
  }

  if (!stream) return path;
  return `${path}?alt=sse`;
}

/**
 * 请求转换配置
 */
export interface TransformRequestConfig {
  claudeModelMap?: Record<string, string>;
}

/**
 * Tool Use ID 映射
 */
interface ToolUseMapping {
  toolUseId: string;
  toolName: string;
  argsDigest: string;
}

/**
 * 转换上下文（用于维护状态）
 */
export interface TransformContext {
  toolUseMappings: Map<string, ToolUseMapping>;
}

/**
 * Schema Sanitize 审计结果
 */
export interface SchemaAuditResult {
  removedFields: string[];
  warnings: string[];
}

/**
 * 构造 Gemini 请求 URL
 */
export function buildGeminiURL(config: URLConfig): string {
  const { baseUrl, model, stream, apiKey } = config;

  // 处理 baseUrl
  let normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  // 确定是否需要添加路径前缀
  const hasVersion = normalizedBase.includes('/v1beta');
  const hasModels = normalizedBase.includes('/models');

  let url: string;
  if (hasModels) {
    // baseUrl 已包含 /models，直接添加 action
    url = `${normalizedBase}/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}`;
  } else if (hasVersion) {
    // baseUrl 包含 /v1beta，需要添加 /models
    url = `${normalizedBase}/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}`;
  } else {
    // 完整路径
    url = `${normalizedBase}/v1beta/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}`;
  }

  // 添加流式参数
  const params = new URLSearchParams();
  if (stream) {
    params.append('alt', 'sse');
  }

  // 添加 API Key (优先使用 query 参数)
  if (apiKey) {
    params.append('key', apiKey);
  }

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * 构造 Count Tokens URL
 */
export function buildCountTokensURL(config: Omit<URLConfig, 'stream'>): string {
  const { baseUrl, model, apiKey } = config;

  let normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const hasVersion = normalizedBase.includes('/v1beta');
  const hasModels = normalizedBase.includes('/models');

  let url: string;
  if (hasModels) {
    url = `${normalizedBase}/${model}:countTokens`;
  } else if (hasVersion) {
    url = `${normalizedBase}/models/${model}:countTokens`;
  } else {
    url = `${normalizedBase}/v1beta/models/${model}:countTokens`;
  }

  if (apiKey) {
    return `${url}?key=${apiKey}`;
  }
  return url;
}

/**
 * 转换 Claude 请求到 Gemini 请求
 */
export function transformClaudeToGeminiRequest(
  claudeModel: string,
  system: string | ClaudeContentBlock[] | undefined,
  messages: ClaudeMessage[],
  tools: ClaudeTool[] | undefined,
  stream: boolean,
  maxTokens: number | undefined,
  temperature: number | undefined,
  topP: number | undefined,
  stopSequences: string[] | undefined,
  config: TransformRequestConfig = {}
): { request: GeminiGenerateContentRequest; context: TransformContext } {
  const request: GeminiGenerateContentRequest = {};
  const context: TransformContext = {
    toolUseMappings: new Map(),
  };

  // System Instruction
  if (system) {
    request.systemInstruction = transformSystemInstruction(system);
  }

  // Contents (收集 tool_use 映射)
  request.contents = messages.map(msg => transformMessage(msg, context));

  // Tools
  if (tools && tools.length > 0) {
    request.tools = transformTools(tools);
  }

  // Generation Config
  const generationConfig: GeminiGenerationConfig = {};
  if (maxTokens !== undefined) {
    generationConfig.maxOutputTokens = maxTokens;
  }
  if (temperature !== undefined) {
    generationConfig.temperature = temperature;
  }
  if (topP !== undefined) {
    generationConfig.topP = topP;
  }
  if (stopSequences && stopSequences.length > 0) {
    generationConfig.stopSequences = stopSequences;
  }

  if (Object.keys(generationConfig).length > 0) {
    request.generationConfig = generationConfig;
  }

  return { request, context };
}

/**
 * 转换 System Instruction
 */
function transformSystemInstruction(
  system: string | ClaudeContentBlock[]
): GeminiSystemInstruction {
  let text: string;

  if (typeof system === 'string') {
    text = system;
  } else {
    // 提取所有 text block
    text = system
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('\n\n');
  }

  return {
    role: 'user', // 固定使用 'user'
    parts: [{ text }],
  };
}

/**
 * 转换 Message
 */
function transformMessage(message: ClaudeMessage, context: TransformContext): GeminiContent {
  const role = message.role === 'assistant' ? 'model' : 'user';
  const parts = transformContent(message.content, context);

  return { role, parts };
}

/**
 * 转换 Content (string 或 blocks) 到 Parts
 */
function transformContent(content: string | ClaudeContentBlock[], context: TransformContext): GeminiPart[] {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  const parts: GeminiPart[] = [];
  for (const block of content) {
    const part = transformBlock(block, context);
    if (part) {
      parts.push(part);
    }
  }

  return consolidateTextParts(parts);
}

/**
 * 转换单个 Content Block
 */
function transformBlock(block: ClaudeContentBlock, context: TransformContext): GeminiPart | null {
  switch (block.type) {
    case 'text':
      return { text: block.text };

    case 'tool_use': {
      const toolUseBlock = block as ClaudeToolUseBlock;
      const argsDigest = JSON.stringify(toolUseBlock.input);

      // 记录 tool_use_id 映射
      context.toolUseMappings.set(toolUseBlock.id, {
        toolUseId: toolUseBlock.id,
        toolName: toolUseBlock.name,
        argsDigest,
      });

      return {
        functionCall: {
          name: toolUseBlock.name,
          args: toolUseBlock.input,
        },
      };
    }

    case 'tool_result': {
      const toolResultBlock = block as ClaudeToolResultBlock;

      // 从映射表获取实际工具名
      const mapping = context.toolUseMappings.get(toolResultBlock.tool_use_id);
      const toolName = mapping?.toolName ?? toolResultBlock.tool_use_id;

      return {
        functionResponse: {
          id: toolResultBlock.tool_use_id,
          name: toolName,
          response: transformToolResultContent(toolResultBlock.content),
        },
      };
    }

    case 'image':
      // 图片处理 - v1 暂时跳过或转换为 inlineData
      return null;

    default:
      return null;
  }
}

/**
 * 转换 Tool Result Content
 */
function transformToolResultContent(
  content?: string | Array<ClaudeTextBlock | ClaudeImageBlock>
): unknown {
  // content 可能是 undefined
  if (!content) {
    return { result: '' };
  }

  if (typeof content === 'string') {
    return { result: content };
  }

  // 检查是否为错误
  const isError = content.some(block =>
    block.type === 'text' && block.text.startsWith('Error:')
  );

  if (isError) {
    return {
      error: content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('\n'),
      is_error: true,
    };
  }

  // JSON object
  return content;
}

/**
 * 合并相邻的纯 text parts
 */
function consolidateTextParts(parts: GeminiPart[]): GeminiPart[] {
  const consolidated: GeminiPart[] = [];
  let pendingText = '';

  for (const part of parts) {
    if ('text' in part) {
      pendingText += part.text;
    } else {
      if (pendingText) {
        consolidated.push({ text: pendingText });
        pendingText = '';
      }
      consolidated.push(part);
    }
  }

  if (pendingText) {
    consolidated.push({ text: pendingText });
  }

  return consolidated;
}

/**
 * 转换 Tools
 */
function transformTools(tools: ClaudeTool[]): GeminiTool {
  const functionDeclarations: GeminiFunctionDeclaration[] = [];

  for (const tool of tools) {
    const declaration: GeminiFunctionDeclaration = {
      name: tool.name,
    };

    if (tool.description) {
      declaration.description = tool.description;
    }

    if (tool.input_schema) {
      const sanitizeResult = sanitizeSchema(tool.input_schema);
      declaration.parameters = sanitizeResult.schema;
      // TODO: 记录审计结果到 trace
    }

    functionDeclarations.push(declaration);
  }

  return { functionDeclarations };
}

/**
 * Schema Sanitize (白名单 + 安全检查)
 */
function sanitizeSchema(
  schema: Record<string, unknown>
): { schema: GeminiSchema; audit: SchemaAuditResult } {
  const audit: SchemaAuditResult = {
    removedFields: [],
    warnings: [],
  };

  const sanitized = _sanitizeSchema(schema, [], audit);

  return { schema: sanitized, audit };
}

/**
 * 递归 sanitize schema
 */
function _sanitizeSchema(
  schema: Record<string, unknown>,
  path: string[],
  audit: SchemaAuditResult
): GeminiSchema {
  const result: GeminiSchema = {};

  // 白名单字段
  const allowedFields = new Set([
    'type',
    'description',
    'properties',
    'required',
    'items',
    'enum',
    'format',
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
    'pattern',
    'additionalProperties',
  ]);

  for (const [key, value] of Object.entries(schema)) {
    if (allowedFields.has(key)) {
      if (key === 'format') {
        // Format 白名单
        const allowedFormats = new Set([
          'int8', 'int16', 'int32', 'int64',
          'uint8', 'uint16', 'uint32', 'uint64',
          'float', 'double', 'date-time', 'time', 'date',
        ]);

        if (typeof value === 'string' && !allowedFormats.has(value)) {
          audit.removedFields.push([...path, key].join('.'));
          continue;
        }
      }

      if (key === 'properties' && typeof value === 'object') {
        result[key] = _sanitizeProperties(value as Record<string, unknown>, path, audit);
      } else if (key === 'items' && typeof value === 'object') {
        result[key] = _sanitizeSchema(value as Record<string, unknown>, [...path, key], audit);
      } else {
        result[key] = value;
      }
    } else if (key === 'anyOf' || key === 'oneOf' || key === 'allOf') {
      // 组合关键字 - v1 保留第一个分支并警告
      audit.warnings.push(`Combining keyword "${key}" at ${path.join('.')}: using first branch only`);
      const schemas = value as Record<string, unknown>[];
      if (schemas.length > 0) {
        result[key] = [_sanitizeSchema(schemas[0], [...path, key, '0'], audit)];
      }
    } else {
      audit.removedFields.push([...path, key].join('.'));
    }
  }

  return result;
}

/**
 * Sanitize properties
 */
function _sanitizeProperties(
  properties: Record<string, unknown>,
  path: string[],
  audit: SchemaAuditResult
): Record<string, GeminiSchema> {
  const result: Record<string, GeminiSchema> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'object' && value !== null) {
      result[key] = _sanitizeSchema(value as Record<string, unknown>, [...path, key], audit);
    }
  }

  return result;
}

/**
 * 转换 Headers
 */
export function transformHeaders(
  headers: Record<string, string>,
  apiKey?: string
): Record<string, string> {
  const result: Record<string, string> = {};

  // 移除 Claude SDK 特定头
  const skipHeaders = new Set([
    'anthropic-version',
    'x-stainless-',
  ]);

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // 跳过 Claude 特定头
    if (lowerKey === 'anthropic-version' || lowerKey.startsWith('x-stainless-')) {
      continue;
    }

    // 保留通用头
    result[key] = value;
  }

  // 添加 Gemini 特定头 (备选方案)
  if (apiKey && !result['x-goog-api-key']) {
    result['x-goog-api-key'] = apiKey;
  }

  // 确保 content-type
  if (!result['Content-Type'] && !result['content-type']) {
    result['Content-Type'] = 'application/json';
  }

  return result;
}
