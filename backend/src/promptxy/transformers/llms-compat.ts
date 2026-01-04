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
import { randomUUID } from 'node:crypto';
import { createLogger } from '../logger.js';
import { detectAuthHeaders } from './auth.js';
import { getGlobalRegistry } from './registry.js';
import { getCodexInstructions } from './codex-instructions.js';

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

          // 构建详细错误信息
          const errorMessage = error?.message || String(error);
          const errorDetails = this.buildErrorDetails(stepName, errorMessage, currentBody);

          stepResult.error = errorDetails.message;
          trace.steps.push(stepResult);
          trace.errors.push(errorDetails.message);
          trace.warnings.push(...errorDetails.suggestions);
          break;
        }
      }

      // 4. 转换路径（基于转换链的最后一个转换器）
      const transformedPath = this.transformPath(
        req.path,
        chain[chain.length - 1],
        currentBody,
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
      case 'openai':
        return this.transformFromOpenAI(response);
      case 'codex': {
        // Codex 上游可能是 Responses API（response.*）或 chat.completion 兼容形态；尽量兼容两者
        return this.transformFromCodex(response);
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
   * Codex /responses → Anthropic 格式转换（尽量兼容）
   *
   * 支持两类常见形态：
   * 1) chat.completion 兼容（choices[0].message.content / tool_calls）
   * 2) Responses API（output[] / output_text）
   */
  private transformFromCodex(
    response: Record<string, unknown>,
  ): Record<string, unknown> {
    // 兼容旧的 chat.completion 形态
    if (response.choices && Array.isArray(response.choices)) {
      return this.transformFromOpenAI(response);
    }

    const transformed: Record<string, unknown> = {
      type: 'message',
      role: 'assistant',
    };

    if (response.id) transformed.id = response.id;
    if (response.model) transformed.model = response.model;

    // Responses API：可能直接提供 output_text
    if (typeof (response as any).output_text === 'string') {
      transformed.content = [
        { type: 'text', text: (response as any).output_text },
      ];
      transformed.stop_reason = 'stop';
      return transformed;
    }

    // Responses API：output[] 里包含 message.content blocks
    const output = (response as any).output;
    if (Array.isArray(output)) {
      const blocks: any[] = [];

      for (const item of output) {
        if (!item || typeof item !== 'object') continue;
        if (item.type !== 'message') continue;
        const content = (item as any).content;
        if (!Array.isArray(content)) continue;

        for (const c of content) {
          if (!c || typeof c !== 'object') continue;
          if (c.type === 'output_text' && typeof c.text === 'string') {
            blocks.push({ type: 'text', text: c.text });
          }
          // 其他输出类型先不强行映射，避免误报
        }
      }

      if (blocks.length) {
        transformed.content = blocks.length === 1 ? blocks : blocks;
      }
      transformed.stop_reason = 'stop';
      return transformed;
    }

    // fallback：未知格式，保持空内容
    transformed.content = '';
    return transformed;
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
   * @param path 原始路径
   * @param lastTransformer 最后一个转换器步骤
   * @param requestBody 请求体（用于提取模型名）
   */
  private transformPath(
    path: string,
    lastTransformer: TransformerStep,
    requestBody?: unknown,
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
      codex: {
        '/v1/messages': '/responses',
      },
      // Gemini 路径需要动态提取模型名，单独处理
    };

    // Gemini 特殊处理：动态提取模型名
    if (transformerName === 'gemini' && path === '/v1/messages') {
      const model = this.extractModel(requestBody) || 'gemini-2.0-flash-exp';
      return `/v1beta/models/${model}:streamGenerateContent`;
    }

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
        case 'codex': {
          // Anthropic Claude → Codex 格式转换
          return this.transformToCodex(request);
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
      transformed.messages = request.messages.flatMap((msg: any) => {
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

          // 多个 tool_result 需要拆分为多个消息
          return toolResults.map((result: any) => ({
            role: 'tool',
            tool_call_id: result.tool_use_id,
            content: result.content,
          }));
        }

        // 处理普通文本消息
        if (typeof msg.content === 'string') {
          return msg;
        }

        // 处理 content 数组（text、image 等混合情况）
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

  /**
   * Anthropic Claude → Codex 格式转换
   *
   * Codex 使用 OpenAI Responses API 格式：
   * - /v1/messages → /responses
   * - system → instructions
   * - messages[] → input[]
   * - tools (Anthropic) → tools (OpenAI function format)
   */
  private transformToCodex(
    request: Record<string, unknown>,
  ): { body: unknown; headers: Record<string, string> } {
    // 注意：此处“Codex”转换的目标 schema 以 `/codex` 原生请求为准（见 resources/*/originalBody.json）。
    // 该 schema 对字段非常严格（additionalProperties=false），因此必须只输出它认可的字段。

    const modelSpec = typeof request.model === 'string' ? request.model : '';

    const effortSet = new Set(['low', 'medium', 'high', 'xhigh']);
    const modelParts = modelSpec.split('-').filter(Boolean);
    const last = modelParts[modelParts.length - 1];
    const baseModel = last && effortSet.has(last) ? modelParts.slice(0, -1).join('-') : modelSpec;
    // instructions 需要尽量贴近 Codex CLI 的“自我描述”格式。
    // 实测上游会拒绝 `GPT-5.2-codex` 这类变体，因此这里将 baseModel 中的 `-codex` 段去掉。
    const baseParts = baseModel.split('-').filter(Boolean);
    const filteredParts = baseParts.filter(p => p.toLowerCase() !== 'codex');
    const baseForInstructions = filteredParts.join('-');
    const prettyModelForInstructions = baseForInstructions.toLowerCase().startsWith('gpt-')
      ? `GPT-${baseForInstructions.slice(4)}`
      : baseForInstructions;

    const transformed: Record<string, unknown> = {
      model: modelSpec,
      // 上游要求 instructions 必填且必须是 string；保持与 Codex CLI 的风格一致
      instructions: getCodexInstructions(prettyModelForInstructions),
      // 必填字段（固定默认值，保持与 /codex 原生请求一致）
      tool_choice: 'auto',
      parallel_tool_calls: true,
      store: false,
      // AICODE Mirror 的 codex backend 要求 stream=true（与 /codex 原生请求一致）
      stream: true,
      include: ['reasoning.encrypted_content'],
      prompt_cache_key: randomUUID(),
      // 不同 model 对 text.verbosity 的支持范围不同；优先使用更通用的 medium
      text: { verbosity: 'medium' },
      // reasoning 必填；effort 会在网关层通过 modelSpec 解析进行覆盖/补齐
      reasoning: { effort: 'medium', summary: 'detailed' },
      // input/tools 下面填充
      input: [],
      tools: [],
    };

    // messages[] → input[]
    const input: any[] = [];
    if (Array.isArray((request as any).messages)) {
      for (const msg of (request as any).messages) {
        const role = msg?.role || 'user';
        const content = msg?.content;

        const pushText = (text: unknown) => {
          if (typeof text !== 'string' || !text) return;
          input.push({
            type: 'message',
            role,
            content: [{ type: 'input_text', text }],
          });
        };

        if (typeof content === 'string') {
          pushText(content);
        } else if (Array.isArray(content)) {
          // Claude Code 常为 blocks；保持拆分，让结构更接近 /codex 原生请求
          for (const block of content) {
            if (block?.type === 'text') {
              pushText(block.text);
            }
          }
        }
      }
    }
    transformed.input = input;

    // tools：Anthropic tools → Codex function schema（扁平化）
    if (Array.isArray((request as any).tools)) {
      const normalizeToolParameters = (params: any): Record<string, unknown> => {
        const stripUnsupported = (node: any): any => {
          if (!node || typeof node !== 'object') return node;
          if (Array.isArray(node)) return node.map(stripUnsupported);
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(node)) {
            // 更严格的上游可能不接受 JSON Schema 的部分关键词（例如 format=uri）
            if (k === 'format' || k === '$schema') continue;
            out[k] = stripUnsupported(v);
          }
          return out;
        };

        const out: Record<string, unknown> =
          params && typeof params === 'object' ? stripUnsupported(params) : {};

        // OpenAI function parameters 需要是 JSON Schema object
        if (out.type !== 'object') out.type = 'object';
        // 更严格校验：必须显式提供 additionalProperties=false
        (out as any).additionalProperties = false;

        const props = (out as any).properties;
        const propKeys =
          props && typeof props === 'object' && !Array.isArray(props)
            ? Object.keys(props)
            : [];

        const requiredOrig: string[] = Array.isArray((out as any).required)
          ? (out as any).required.filter((x: any) => typeof x === 'string')
          : [];

        // 兼容更严格的校验：
        // - required 必须存在
        // - required 必须包含 properties 的所有 key（不能多也不能少）
        // 为了避免工具 schema 因“可选字段”触发不一致，这里采用：
        // 1) 若原 schema 提供 required，则裁剪 properties 只保留 required 中出现的 key
        // 2) 否则认为所有 properties 都是必填
        if (props && typeof props === 'object' && !Array.isArray(props)) {
          if (requiredOrig.length > 0) {
            const pruned: Record<string, unknown> = {};
            for (const key of requiredOrig) {
              if (key in (props as any)) pruned[key] = (props as any)[key];
            }
            (out as any).properties = pruned;
            (out as any).required = Object.keys(pruned);
          } else {
            (out as any).required = propKeys;
          }
        } else {
          (out as any).properties = {};
          (out as any).required = [];
        }

        return out;
      };

      transformed.tools = (request as any).tools.map((tool: any) => ({
        type: 'function',
        name: tool?.name || '',
        description: tool?.description || '',
        parameters: normalizeToolParameters(tool?.input_schema || tool?.parameters),
        strict: true,
      }));
    } else {
      transformed.tools = [];
    }

    return { body: transformed, headers: {} };
  }

  /**
   * 转换 Codex content 格式（用于反向转换或兼容性处理）
   * Codex 的 content 可能是：[ { type: 'input_text', text: '...' } ]
   */
  private convertCodexContent(content: any): any {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      // 如果只有一个 text block，简化为字符串
      if (content.length === 1 && content[0]?.type === 'text') {
        return content[0].text;
      }
      // 否则保持数组格式
      return content;
    }

    return content;
  }

  /**
   * 构建详细的错误信息
   */
  private buildErrorDetails(
    transformerName: string,
    errorMessage: string,
    requestBody: any,
  ): { message: string; suggestions: string[] } {
    const suggestions: string[] = [];

    // 根据转换器类型和错误信息提供建议
    switch (transformerName) {
      case 'openai':
      case 'deepseek':
        if (errorMessage.includes('tools') || errorMessage.includes('function')) {
          suggestions.push('提示: 检查 tools 定义是否符合 OpenAI function 格式');
          suggestions.push('提示: tools 应包含 name、description 和 input_schema 字段');
        }
        if (errorMessage.includes('messages') || errorMessage.includes('content')) {
          suggestions.push('提示: 检查 messages 数组中的 content 字段格式');
          suggestions.push('提示: content 可以是字符串或对象数组');
        }
        break;

      case 'gemini':
        if (errorMessage.includes('contents') || errorMessage.includes('parts')) {
          suggestions.push('提示: Gemini 使用 contents 而不是 messages');
          suggestions.push('提示: 每个 content 应包含 parts 数组');
        }
        if (errorMessage.includes('tools') || errorMessage.includes('functionDeclarations')) {
          suggestions.push('提示: Gemini 工具应使用 functionDeclarations 格式');
        }
        break;

      case 'codex':
        if (errorMessage.includes('input') || errorMessage.includes('instructions')) {
          suggestions.push('提示: Claude → Codex 转换需要 messages[] → input[]');
          suggestions.push('提示: Claude → Codex 转换需要 system → instructions');
        }
        break;
    }

    // 如果无法解析请求体
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      suggestions.push('提示: 确保请求体是有效的 JSON 格式');
    }

    // 请求体摘要
    const bodySummary = this.summarizeRequestBody(requestBody);

    const message = `[${transformerName}] 转换失败: ${errorMessage}${bodySummary ? ` | 请求: ${bodySummary}` : ''}`;

    return {
      message,
      suggestions,
    };
  }

  /**
   * 生成请求体摘要（用于错误信息）
   */
  private summarizeRequestBody(body: any): string {
    if (!body || typeof body !== 'object') {
      return '';
    }

    const parts: string[] = [];

    if (body.model) {
      parts.push(`model=${body.model}`);
    }

    // Claude 格式
    if (body.messages && Array.isArray(body.messages)) {
      parts.push(`messages=${body.messages.length}条`);
    }

    // Codex 格式
    if (body.input && Array.isArray(body.input)) {
      parts.push(`input=${body.input.length}项`);
    }

    if (body.instructions) {
      const preview = String(body.instructions).substring(0, 30);
      parts.push(`instructions="${preview}..."`);
    }

    // Claude system 字段
    if (body.system) {
      const preview = String(body.system).substring(0, 30);
      parts.push(`system="${preview}..."`);
    }

    if (body.tools && Array.isArray(body.tools)) {
      parts.push(`tools=${body.tools.length}个`);
    }

    return parts.join(', ') || '(空请求体)';
  }
}

/**
 * 创建协议转换器实例
 */
export function createProtocolTransformer(): ProtocolTransformer {
  return new ProtocolTransformer();
}
