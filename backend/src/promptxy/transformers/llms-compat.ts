/**
 * PromptXY - @musistudio/llms 兼容层
 *
 * 将 PromptXY 的 transformer 配置编译为 @musistudio/llms 的调用方式
 * 提供薄封装，隔离 llms 的 config/版本变动
 */

import type {
  TransformerChain,
  TransformerConfig,
  TransformerStep,
  SupplierAuth,
  Supplier,
} from '../types.js';
import type {
  TransformRequest,
  TransformResponse,
  TransformTrace,
  TransformStepResult,
} from './types.js';
import { createLogger } from '../logger.js';
import { detectAuthHeaders } from './auth.js';
import { getGlobalRegistry } from './registry.js';

const logger = createLogger({ debug: false });

// 获取全局注册表，用于检查转换器是否存在
const registry = getGlobalRegistry();

/**
 * 从转换器步骤中提取名称
 */
function getStepName(step: TransformerStep): string {
  if (typeof step === 'string') {
    return step;
  }
  return step.name;
}

/**
 * 从转换器步骤中提取选项
 */
function getStepOptions(step: TransformerStep): Record<string, unknown> | undefined {
  if (typeof step === 'string') {
    return undefined;
  }
  return step.options;
}

/**
 * 选择转换链（根据模型精确匹配）
 */
export function selectChain(
  config: TransformerConfig,
  model?: string,
): { chain: TransformerChain; chainType: 'default' | string } {
  if (model && config.models && model in config.models) {
    return { chain: config.models[model]!, chainType: model };
  }
  return { chain: config.default, chainType: 'default' };
}

/**
 * 脱敏 Headers（用于日志/预览）
 */
export function sanitizeHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveKeys = [
    'authorization',
    'x-api-key',
    'x-goog-api-key',
    'cookie',
    'set-cookie',
    'x-custom-auth',
    'x-custom-authorization',
  ];

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.includes(lowerKey)) {
      const parts = value.split(' ');
      if (parts.length > 1) {
        // Bearer token 模式
        sanitized[key] = `${parts[0]} ***REDACTED***`;
      } else {
        sanitized[key] = '***REDACTED***';
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 注入上游认证信息
 */
function injectUpstreamAuth(
  headers: Record<string, string>,
  auth?: SupplierAuth,
): Record<string, string> {
  if (!auth) {
    return headers;
  }

  const result = { ...headers };

  if (auth.type === 'bearer' && auth.token) {
    result['authorization'] = `Bearer ${auth.token}`;
  } else if (
    auth.type === 'header' &&
    auth.headerName &&
    auth.headerValue
  ) {
    result[auth.headerName] = auth.headerValue;
  }

  return result;
}

/**
 * 生成 cURL 命令（脱敏）
 */
function generateCurlCommand(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: unknown,
): string {
  const sanitized = sanitizeHeaders(headers);
  const parts: string[] = [];

  parts.push('curl');

  if (method !== 'GET') {
    parts.push('-X', method);
  }

  for (const [key, value] of Object.entries(sanitized)) {
    parts.push('-H', `"${key}: ${value}"`);
  }

  if (body) {
    parts.push('-d', `'${JSON.stringify(body)}'`);
  }

  parts.push(`"${url}"`);

  return parts.join(' ');
}

/**
 * ProtocolTransformer 类
 *
 * 协议转换器，负责：
 * 1. 将 PromptXY transformer 配置编译为转换链
 * 2. 执行协议转换（调用 @musistudio/llms）
 * 3. 注入上游认证
 * 4. 生成转换 trace
 */
export class ProtocolTransformer {
  /**
   * 执行协议转换
   *
   * @param request 转换请求
   * @returns 转换响应
   */
  async transform(request: TransformRequest): Promise<TransformResponse> {
    const {
      supplier,
      request: req,
      stream = false,
    } = request;

    const startTime = Date.now();

    // 检测请求中的鉴权头（用于诊断观测）
    const authHeaderDetected = detectAuthHeaders(req.headers);

    const trace: TransformTrace = {
      supplierId: supplier.id,
      supplierName: supplier.name,
      chainType: 'default',
      chain: [],
      steps: [],
      totalDuration: 0,
      success: false,
      errors: [],
      warnings: [],
      authHeaderDetected,
    };

    try {
      // 1. 检查是否配置了 transformer
      if (!supplier.transformer) {
        // 无需转换，直接透传
        trace.warnings.push('未配置协议转换，直接透传请求');
        return {
          request: {
            method: req.method,
            path: req.path,
            headers: injectUpstreamAuth(req.headers, supplier.auth),
            body: req.body,
          },
          trace: {
            ...trace,
            success: true,
            totalDuration: Date.now() - startTime,
          },
          needsResponseTransform: false,
        };
      }

      // 2. 选择转换链
      const model = this.extractModel(req.body);
      const { chain, chainType } = selectChain(
        supplier.transformer,
        model,
      );
      trace.chainType = chainType;
      trace.chain = chain;

      if (logger.debugEnabled) {
        logger.debug(
          `[ProtocolTransformer] 使用转换链: ${chainType}, 步骤数: ${chain.length}`,
        );
      }

      // 3. 执行转换链
      let currentBody = req.body;
      let currentHeaders = req.headers;

      for (const step of chain) {
        const stepName = getStepName(step);
        const stepOptions = getStepOptions(step);
        const stepStartTime = Date.now();

        const stepResult: TransformStepResult = {
          name: stepName,
          success: false,
          duration: 0,
        };

        // 检查转换器是否存在
        if (!registry.has(stepName)) {
          // 未知转换器，透传请求但记录警告
          trace.warnings.push(`未知的转换器 "${stepName}"，已跳过`);
          stepResult.success = true;
          stepResult.duration = Date.now() - stepStartTime;
          trace.steps.push(stepResult);
          continue;
        }

        try {
          // 调用 @musistudio/llms 进行转换
          const result = await this.applyTransformer(
            stepName,
            currentBody,
            stepOptions,
          );

          currentBody = result.body;
          currentHeaders = { ...currentHeaders, ...result.headers };

          stepResult.success = true;
          stepResult.duration = Date.now() - stepStartTime;
          trace.steps.push(stepResult);
        } catch (error: any) {
          stepResult.success = false;
          stepResult.duration = Date.now() - stepStartTime;
          stepResult.error = error?.message || String(error);
          trace.steps.push(stepResult);
          trace.errors.push(`转换器 "${stepName}" 失败: ${stepResult.error}`);
          break;
        }
      }

      // 4. 转换路径（基于转换链的最后一个转换器）
      const transformedPath = this.transformPath(
        req.path,
        chain[chain.length - 1],
      );

      // 5. 注入上游认证
      const finalHeaders = injectUpstreamAuth(
        currentHeaders,
        supplier.auth,
      );

      trace.totalDuration = Date.now() - startTime;
      trace.success = trace.errors.length === 0;

      return {
        request: {
          method: req.method,
          path: transformedPath,
          headers: finalHeaders,
          body: currentBody,
        },
        trace,
        needsResponseTransform: true, // 有转换则需要转换响应
      };
    } catch (error: any) {
      trace.totalDuration = Date.now() - startTime;
      trace.errors.push(error?.message || String(error));

      return {
        request: req,
        trace,
        needsResponseTransform: false,
      };
    }
  }

  /**
   * 预览转换（脱敏）
   */
  async preview(request: TransformRequest): Promise<{
    original: {
      method: string;
      path: string;
      headers: Record<string, string>;
      body?: unknown;
    };
    transformed: {
      method: string;
      path: string;
      headers: Record<string, string>;
      body?: unknown;
    };
    trace: TransformTrace;
    curlCommand: string;
  }> {
    const result = await this.transform(request);

    // 构建上游 URL
    const upstreamUrl = new URL(
      result.request.path,
      request.supplier.baseUrl,
    ).href;

    return {
      original: {
        method: request.request.method,
        path: request.request.path,
        headers: sanitizeHeaders(request.request.headers),
        body: request.request.body,
      },
      transformed: {
        method: result.request.method,
        path: result.request.path,
        headers: sanitizeHeaders(result.request.headers),
        body: result.request.body,
      },
      trace: result.trace,
      curlCommand: generateCurlCommand(
        result.request.method,
        upstreamUrl,
        result.request.headers,
        result.request.body,
      ),
    };
  }

  /**
   * 转换响应（上游 → Anthropic）
   * 用于将上游的响应转换回 Anthropic 格式
   */
  async transformResponse(
    supplier: {
      id: string;
      name: string;
      baseUrl: string;
      transformer?: TransformerConfig;
    },
    responseBody: unknown,
    contentType: string,
  ): Promise<unknown> {
    // 如果没有配置 transformer，直接返回
    if (!supplier.transformer) {
      return responseBody;
    }

    // 如果不是 JSON 响应，直接返回
    if (!contentType.includes('application/json')) {
      return responseBody;
    }

    // 确保 responseBody 是对象
    if (!responseBody || typeof responseBody !== 'object') {
      return responseBody;
    }

    const response = responseBody as Record<string, unknown>;

    // 确定使用的转换链
    const model = this.extractModel(response);
    const { chain } = selectChain(supplier.transformer, model);

    // 检查是否需要转换响应（最后一个转换器决定）
    const lastTransformer = chain[chain.length - 1];
    const lastTransformerName =
      typeof lastTransformer === 'string'
        ? lastTransformer
        : lastTransformer.name;

    // 根据转换器类型进行响应转换
    switch (lastTransformerName) {
      case 'deepseek':
      case 'openai': {
        return this.transformFromOpenAI(response);
      }
      case 'gemini': {
        return this.transformFromGemini(response);
      }
      case 'anthropic':
      default:
        // 透传，不做转换
        return responseBody;
    }
  }

  /**
   * OpenAI compatible → Anthropic 格式转换
   */
  private transformFromOpenAI(
    response: Record<string, unknown>,
  ): Record<string, unknown> {
    const transformed: Record<string, unknown> = {
      type: 'message', // Anthropic 消息类型
      role: 'assistant',
    };

    // 基础字段
    if (response.id) transformed.id = response.id;
    if (response.model) transformed.model = response.model;

    // choices → content
    if (response.choices && Array.isArray(response.choices)) {
      const choice = response.choices[0] as any;
      if (choice.message) {
        // OpenAI 的 message → Anthropic 的 content
        transformed.content = this.convertOpenAIContentToAnthropic(
          choice.message,
        );
      }
      if (choice.finish_reason) {
        transformed.stop_reason = choice.finish_reason;
      }
    }

    // usage
    if (response.usage) {
      transformed.usage = response.usage;
    }

    return transformed;
  }

  /**
   * 转换 OpenAI content → Anthropic content
   */
  private convertOpenAIContentToAnthropic(
    message: any,
  ): string | Array<{ type: string; text?: string; [key: string]: any }> {
    const blocks: any[] = [];

    // 处理文本内容
    if (message.content) {
      if (typeof message.content === 'string') {
        blocks.push({
          type: 'text',
          text: message.content,
        });
      } else if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (item.type === 'text') {
            blocks.push({
              type: 'text',
              text: item.text,
            });
          }
        }
      }
    }

    // 处理 tool_calls（转换为 tool_use blocks）
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        blocks.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function?.name || '',
          input: JSON.parse(toolCall.function?.arguments || '{}'),
        });
      }
    }

    // 如果只有 text block，简化为字符串
    if (blocks.length === 1 && blocks[0].type === 'text') {
      return blocks[0].text;
    }

    // 如果没有任何内容，返回空字符串
    if (blocks.length === 0) {
      return '';
    }

    return blocks;
  }

  /**
   * Gemini → Anthropic 格式转换
   */
  private transformFromGemini(
    response: Record<string, unknown>,
  ): Record<string, unknown> {
    const transformed: Record<string, unknown> = {};

    // Gemini 的响应格式完全不同
    if (response.candidates && Array.isArray(response.candidates)) {
      const candidate = response.candidates[0] as any;
      if (candidate.content) {
        // Gemini content → Anthropic content
        transformed.content = this.convertGeminiContentToAnthropic(
          candidate.content,
        );
        transformed.role = 'assistant';
      }
      if (candidate.finishReason) {
        transformed.stop_reason = candidate.finishReason;
      }
    }

    // usage metadata
    if (response.usageMetadata) {
      const metadata = response.usageMetadata as Record<string, unknown>;
      transformed.usage = {
        prompt_tokens: (metadata.promptTokenCount as number) || 0,
        completion_tokens: (metadata.candidatesTokenCount as number) || 0,
        total_tokens: (metadata.totalTokenCount as number) || 0,
      };
    }

    return transformed;
  }

  /**
   * 转换 Gemini content → Anthropic content
   */
  private convertGeminiContentToAnthropic(
    content: any,
  ): string | Array<{ type: string; text?: string }> {
    if (!content || !content.parts) {
      return '';
    }

    if (!Array.isArray(content.parts)) {
      return '';
    }

    const blocks: any[] = [];
    for (const part of content.parts) {
      if (part.text) {
        blocks.push({
          type: 'text',
          text: part.text,
        });
      }
      // 处理 function_call → tool_use
      if (part.functionCall) {
        blocks.push({
          type: 'tool_use',
          id: part.functionCall.id || '',
          name: part.functionCall.name,
          input: part.functionCall.args || {},
        });
      }
    }

    // 如果只有一个 text block，简化为字符串
    if (blocks.length === 1 && blocks[0].type === 'text') {
      return blocks[0].text;
    }

    return blocks;
  }

  /**
   * 从请求体中提取模型名称
   */
  private extractModel(body: unknown): string | undefined {
    if (body && typeof body === 'object' && 'model' in body) {
      return String(body.model);
    }
    return undefined;
  }

  /**
   * 转换请求路径
   *
   * 根据目标转换器将 Anthropic 路径转换为对应供应商的路径
   */
  private transformPath(
    path: string,
    lastTransformer: TransformerStep,
  ): string {
    const transformerName =
      typeof lastTransformer === 'string'
        ? lastTransformer
        : lastTransformer.name;

    // 路径映射规则
    const pathMappings: Record<string, Record<string, string>> = {
      deepseek: {
        '/v1/messages': '/chat/completions',
        '/v1/messages/batches': '/chat/completions',
      },
      openai: {
        '/v1/messages': '/chat/completions',
        '/v1/messages/batches': '/chat/completions',
      },
      gemini: {
        '/v1/messages':
          '/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent',
      },
    };

    // 获取转换器的路径映射
    const mappings = pathMappings[transformerName];
    if (mappings && mappings[path]) {
      return mappings[path];
    }

    // 默认返回原路径
    return path;
  }

  /**
   * 应用单个转换器
   *
   * 实现 Anthropic → OpenAI compatible 的基础转换
   */
  private async applyTransformer(
    transformerName: string,
    body: unknown,
    options?: Record<string, unknown>,
  ): Promise<{ body: unknown; headers: Record<string, string> }> {
    try {
      if (logger.debugEnabled) {
        const optionsStr = options ? ` 选项: ${JSON.stringify(options)}` : '';
        logger.debug(`[ProtocolTransformer] 应用转换器: ${transformerName}${optionsStr}`);
      }

      // 确保 body 是对象
      if (!body || typeof body !== 'object') {
        return { body, headers: {} };
      }

      const request = body as Record<string, unknown>;

      // 根据转换器名称应用不同的转换
      switch (transformerName) {
        case 'deepseek':
        case 'openai': {
          // Anthropic → OpenAI compatible 格式转换
          return this.transformToOpenAI(request);
        }
        case 'anthropic': {
          // 透传，不做转换
          return { body, headers: {} };
        }
        case 'gemini': {
          // Anthropic → Gemini 格式转换
          return this.transformToGemini(request);
        }
        case 'maxtoken': {
          // 设置 max_tokens
          const maxTokens = options?.max_tokens as number | undefined;
          if (maxTokens && typeof maxTokens === 'number') {
            return { body: { ...request, max_tokens: maxTokens }, headers: {} };
          }
          return { body, headers: {} };
        }
        case 'cleancache': {
          // 清除 cache_control 字段
          return this.cleanCacheControl(request);
        }
        default:
          // 未知转换器，直接透传
          if (logger.debugEnabled) {
            logger.debug(`[ProtocolTransformer] 未知转换器 "${transformerName}"，透传请求`);
          }
          return { body, headers: {} };
      }
    } catch (error: any) {
      logger.debug(
        `[ProtocolTransformer] 转换器 ${transformerName} 执行失败: ${error?.message}`,
      );
      throw error;
    }
  }

  /**
   * Anthropic → OpenAI compatible 格式转换
   */
  private transformToOpenAI(
    request: Record<string, unknown>,
  ): { body: unknown; headers: Record<string, string> } {
    const transformed: Record<string, unknown> = {};

    // 基础字段映射
    if (request.model) {
      // 将 claude-3-* 等模型名映射到 OpenAI 格式（如果需要）
      transformed.model = request.model;
    }

    if (request.max_tokens) {
      transformed.max_tokens = request.max_tokens;
    }

    if (request.temperature) {
      transformed.temperature = request.temperature;
    }

    if (request.top_p) {
      transformed.top_p = request.top_p;
    }

    if ('stream' in request) {
      transformed.stream = request.stream;
    }

    // messages 转换
    if (request.messages && Array.isArray(request.messages)) {
      transformed.messages = request.messages.map((msg: any) => {
        // 处理 tool_use 消息（assistant 发起工具调用）
        if (
          Array.isArray(msg.content) &&
          msg.content.some((b: any) => b.type === 'tool_use')
        ) {
          const toolCalls = msg.content
            .filter((b: any) => b.type === 'tool_use')
            .map((block: any) => ({
              id: block.id,
              type: 'function' as const,
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input || {}),
              },
            }));

          // 获取文本内容（如果有）
          const textBlocks = msg.content.filter((b: any) => b.type === 'text');
          const hasText = textBlocks.length > 0;

          return {
            role: msg.role,
            content: hasText ? textBlocks[0].text : null,
            tool_calls: toolCalls,
          };
        }

        // 处理 tool_result 消息（用户返回工具结果）
        if (
          Array.isArray(msg.content) &&
          msg.content.some((b: any) => b.type === 'tool_result')
        ) {
          const toolResults = msg.content.filter((b: any) => b.type === 'tool_result');

          // 如果只有一个 tool_result，直接返回
          if (toolResults.length === 1) {
            return {
              role: 'tool',
              tool_call_id: toolResults[0].tool_use_id,
              content: toolResults[0].content,
            };
          }

          // 多个 tool_result，需要拆分为多个消息（这里简化处理，只返回第一个）
          return {
            role: 'tool',
            tool_call_id: toolResults[0].tool_use_id,
            content: toolResults[0].content,
          };
        }

        // 处理普通文本消息
        if (typeof msg.content === 'string') {
          return msg;
        }

        // 处理 content 数组（只有 text 和 image 的情况）
        if (Array.isArray(msg.content)) {
          const openAIContent: any[] = [];
          for (const block of msg.content) {
            if (block.type === 'text') {
              openAIContent.push({
                type: 'text',
                text: block.text,
              });
            } else if (block.type === 'image') {
              openAIContent.push({
                type: 'image_url',
                image_url: {
                  url: block.source?.data || block.source,
                },
              });
            }
          }
          // 如果只有一个 text block，简化为字符串
          if (openAIContent.length === 1 && openAIContent[0].type === 'text') {
            return { ...msg, content: openAIContent[0].text };
          }
          return { ...msg, content: openAIContent };
        }

        return msg;
      });
    }

    // system 转换（Anthropic 的 system messages）
    if (request.system) {
      // OpenAI 将 system 消息放在 messages 数组开头
      const systemMessage =
        typeof request.system === 'string'
          ? request.system
          : JSON.stringify(request.system);
      transformed.messages = [
        { role: 'system', content: systemMessage },
        ...(transformed.messages as any[]),
      ];
    }

    // tools 转换
    if (request.tools && Array.isArray(request.tools)) {
      transformed.tools = request.tools.map((tool: any) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      }));
    }

    // tool_choice 转换
    if (request.tool_choice) {
      if (typeof request.tool_choice === 'object') {
        // Anthropic 的 {type: "tool", name: "xxx"} 格式
        transformed.tool_choice = {
          type: 'function',
          function: { name: (request.tool_choice as any).name },
        };
      } else {
        transformed.tool_choice = request.tool_choice;
      }
    }

    return { body: transformed, headers: {} };
  }

  /**
   * Anthropic → Gemini 格式转换
   */
  private transformToGemini(
    request: Record<string, unknown>,
  ): { body: unknown; headers: Record<string, string> } {
    const transformed: Record<string, unknown> = {};

    // Gemini 使用不同的字段名
    if (request.model) {
      transformed.model = request.model;
    }

    // 转换 max_tokens → maxOutputTokens
    if (request.max_tokens) {
      transformed.maxOutputTokens = request.max_tokens;
    }

    // temperature 等
    if (request.temperature !== undefined) {
      transformed.temperature = request.temperature;
    }

    if (request.top_p !== undefined) {
      transformed.topP = request.top_p;
    }

    // 转换 messages → contents
    if (request.messages && Array.isArray(request.messages)) {
      const contents: any[] = [];

      for (const msg of request.messages) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const parts: any[] = [];

        if (typeof msg.content === 'string') {
          parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'text') {
              parts.push({ text: block.text });
            } else if (block.type === 'image') {
              parts.push({
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: block.source?.data || block.source,
                },
              });
            }
          }
        }

        contents.push({ role, parts });
      }

      transformed.contents = contents;
    }

    // system instruction
    if (request.system) {
      transformed.systemInstruction = {
        parts: [{ text: request.system }],
      };
    }

    // tools 转换（Gemini 格式不同）
    if (request.tools && Array.isArray(request.tools)) {
      transformed.tools = request.tools.map((tool: any) => ({
        functionDeclarations: [
          {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          },
        ],
      }));
    }

    return { body: transformed, headers: {} };
  }

  /**
   * 清除 cache_control 字段
   */
  private cleanCacheControl(
    request: Record<string, unknown>,
  ): { body: unknown; headers: Record<string, string> } {
    const cleaned = { ...request };

    // 递归清除 cache_control
    const cleanObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(cleanObject);
      }

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'cache_control') {
          continue; // 跳过 cache_control 字段
        }
        result[key] = cleanObject(value);
      }

      return result;
    };

    return { body: cleanObject(cleaned), headers: {} };
  }
}

/**
 * 创建协议转换器实例
 */
export function createProtocolTransformer(): ProtocolTransformer {
  return new ProtocolTransformer();
}
