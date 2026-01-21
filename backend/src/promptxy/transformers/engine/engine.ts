/**
 * Transformer Engine
 *
 * 选择协议对、组织 pipeline、产出 trace/audit
 */

import type {
  ClaudeMessagesRequest,
} from '../protocols/claude/types.js';
import type {
  CodexResponsesApiRequest,
} from '../protocols/codex/types.js';
import type { FieldAudit } from '../audit/field-audit.js';
import { FieldAuditCollector } from '../audit/field-audit.js';
import { TransformError } from './errors.js';
import { executePipeline, createStage, type StageResult, type PipelineResult } from './pipeline.js';
import { parseClaudeRequest } from '../protocols/claude/parse.js';
import { renderCodexRequest, type RenderConfig } from '../protocols/codex/render.js';
import { validateCodexRequest } from '../protocols/codex/validate.js';
import { collectJsonPointers } from '../audit/json-pointer.js';
import { transformCodexResponseToClaude } from '../protocols/codex/response.js';
import type { GeminiGenerateContentResponse } from '../protocols/gemini/types.js';
import {
  buildGeminiPath,
  transformClaudeToGeminiRequest,
} from '../protocols/gemini/request.js';
import { transformGeminiResponseToClaude } from '../protocols/gemini/response.js';
import { transformClaudeToOpenAIChatRequest } from '../protocols/openai-chat/request.js';
import { transformOpenAIChatResponseToClaude } from '../protocols/openai-chat/response.js';

/**
 * 协议对类型
 */
export type ProtocolPair = 'claude-to-codex' | 'claude-to-gemini' | 'claude-to-openai-chat' | 'codex-to-claude' | 'gemini-to-claude' | 'openai-chat-to-claude';

/**
 * 转换请求
 */
export type TransformRequest = {
  supplier: {
    id: string;
    name: string;
    baseUrl: string;
    auth?: unknown;
    transformer?: { default?: string[] };
  };
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: unknown;
  };
  stream?: boolean;
};

/**
 * 转换响应
 */
export type TransformResponse = {
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: unknown;
  };
  needsResponseTransform: boolean;
  trace: TransformTrace;
  /** tool name 缩短映射（original -> short），用于响应转换器 */
  shortNameMap?: Record<string, string>;
};

/**
 * 转换 Trace
 */
export type TransformTrace = {
  protocolPair: ProtocolPair;
  steps: TransformStep[];
  audit: FieldAudit;
  success: boolean;
  errors?: Array<{
    type: string;
    stepName: string;
    message: string;
    details: Record<string, unknown>;
  }>;
};

/**
 * 转换步骤
 */
export type TransformStep = {
  name: string;
  duration: number;
  success: boolean;
  error?: string;
};

/**
 * 转换配置
 */
export type TransformConfig = {
  /** instructions 模板 */
  instructionsTemplate?: string;
  /** reasoning effort */
  reasoningEffort?: string;
  /** thinking 配置 */
  thinkingConfig?: { type: string; budget_tokens?: number };
  /** SSE 转换配置 */
  sseConfig?: {
    stopReasonStrategy: 'end_turn' | 'tool_use';
    customToolCallStrategy: 'wrap_object' | 'error';
  };
};

/**
 * Transformer Engine
 */
export class TransformerEngine {
  private config: TransformConfig;

  constructor(config: TransformConfig = {}) {
    this.config = config;
  }

  /**
   * 执行转换（Claude → 上游协议）
   */
  async transform(req: TransformRequest): Promise<TransformResponse> {
    const transformerName = req.supplier.transformer?.default?.[0] || 'none';
    if (transformerName === 'gemini') {
      return this.transformClaudeToGemini(req);
    }
    if (transformerName === 'openai-chat') {
      return this.transformClaudeToOpenAIChat(req);
    }
    if (transformerName !== 'codex') {
      throw new Error(`Unsupported transformer: ${transformerName}`);
    }

    const startTime = Date.now();

    // 创建 Pipeline
    const pipeline = this.createClaudeToCodexPipeline();

    // 执行 Pipeline
    const result = await executePipeline(
      pipeline,
      req,
      { continueOnError: false, verboseAudit: true },
    );

    const duration = Date.now() - startTime;

    // 构建 Trace
    const trace: TransformTrace = {
      protocolPair: 'claude-to-codex',
      steps: [
        {
          name: 'parse',
          duration: 0,
          success: true,
        },
        {
          name: 'render',
          duration: 0,
          success: true,
        },
        {
          name: 'validate',
          duration: 0,
          success: result.success,
        },
      ],
      audit: result.audit,
      success: result.success,
      errors: result.errors.map(e => e.toJSON() as any),
    };

    // 如果有校验错误，抛出异常
    if (!result.success && result.errors.length > 0) {
      throw result.errors[0];
    }

    // 返回转换后的请求（包含 shortNameMap）
    const { request: codexRequest, shortNameMap } = result.data as {
      request: CodexResponsesApiRequest;
      shortNameMap: Record<string, string>;
    };

    // 映射请求头：移除 Claude SDK 特定请求头，添加 Codex 特定请求头
    const mappedHeaders = mapHeadersForCodex(req.request.headers);

    return {
      request: {
        method: 'POST',
        // 注意：PromptXY 的 openai supplier.baseUrl 可能已经包含 /v1，
        // 且部分上游（如镜像/代理）仅暴露 /responses 而非 /v1/responses。
        // 因此这里使用相对路径 /responses，由 supplier.baseUrl 决定最终 URL。
        path: '/responses',
        headers: {
          ...mappedHeaders,
          'content-type': 'application/json',
        },
        body: codexRequest,
      },
      needsResponseTransform: true,
      trace,
      shortNameMap,
    };
  }

  /**
   * 执行转换（Claude → Gemini v1beta）
   */
  private async transformClaudeToGemini(req: TransformRequest): Promise<TransformResponse> {
    const startTime = Date.now();

    const body = req.request.body as ClaudeMessagesRequest;

    // 复用 Claude parse（用于收集 sourcePaths & 统一 system/messages 规范化语义）
    const auditCollector = new FieldAuditCollector();
    const sourcePaths = collectJsonPointers(body);
    auditCollector.addSourcePaths(sourcePaths);
    const parsed = parseClaudeRequest(body);

    // 构造 Gemini 请求体（使用现有协议实现）
    const { request: geminiRequest } = transformClaudeToGeminiRequest(
      parsed.model,
      parsed.system.text,
      (body.messages || []).map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : (m.content || []),
      })),
      body.tools,
      parsed.stream,
      body.max_tokens,
      body.temperature,
      body.top_p,
      body.stop_sequences,
    );

    // 收集 targetPaths
    const targetPaths = collectJsonPointers(geminiRequest as any);
    auditCollector.addTargetPaths(targetPaths);

    // path 由 supplier.baseUrl 形态决定（兼容 /v1beta/models 与根域）
    const upstreamPath = buildGeminiPath({
      baseUrl: req.supplier.baseUrl,
      model: parsed.model,
      stream: parsed.stream,
    });

    const duration = Date.now() - startTime;
    const trace: TransformTrace = {
      protocolPair: 'claude-to-gemini',
      steps: [
        { name: 'parse', duration: 0, success: true },
        { name: 'render', duration, success: true },
      ],
      audit: auditCollector.getAudit(),
      success: true,
    };

    const mappedHeaders = mapHeadersForGemini(req.request.headers, { stream: parsed.stream });

    return {
      request: {
        method: 'POST',
        path: upstreamPath,
        headers: {
          ...mappedHeaders,
          'content-type': 'application/json',
        },
        body: geminiRequest as any,
      },
      needsResponseTransform: true,
      trace,
    };
  }

  /**
   * 执行转换（Claude → OpenAI Chat Completions）
   */
  private async transformClaudeToOpenAIChat(req: TransformRequest): Promise<TransformResponse> {
    const startTime = Date.now();

    const body = req.request.body as ClaudeMessagesRequest;

    // 复用 Claude parse（用于收集 sourcePaths & 统一 system/messages 规范化语义）
    const auditCollector = new FieldAuditCollector();
    const sourcePaths = collectJsonPointers(body);
    auditCollector.addSourcePaths(sourcePaths);
    const parsed = parseClaudeRequest(body);

    // 构造 OpenAI Chat 请求体
    const chatRequest = transformClaudeToOpenAIChatRequest(body);

    // 收集 targetPaths
    const targetPaths = collectJsonPointers(chatRequest as any);
    auditCollector.addTargetPaths(targetPaths);

    const duration = Date.now() - startTime;
    const trace: TransformTrace = {
      protocolPair: 'claude-to-openai-chat',
      steps: [
        { name: 'parse', duration: 0, success: true },
        { name: 'transform', duration, success: true },
      ],
      audit: auditCollector.getAudit(),
      success: true,
    };

    const mappedHeaders = mapHeadersForOpenAIChat(req.request.headers, { stream: parsed.stream });

    return {
      request: {
        method: 'POST',
        path: '/chat/completions',
        headers: {
          ...mappedHeaders,
          'content-type': 'application/json',
        },
        body: chatRequest as any,
      },
      needsResponseTransform: true,
      trace,
    };
  }

  /**
   * 转换响应（上游协议 → Claude）
   */
  async transformResponse(
    supplier: {
      id: string;
      name: string;
      baseUrl: string;
      transformer?: { default?: string[] };
    },
    response: unknown,
    contentType?: string,
  ): Promise<unknown> {
    const transformerName = supplier.transformer?.default?.[0] || 'none';

    if (transformerName === 'gemini') {
      return transformGeminiResponseToClaude(response as GeminiGenerateContentResponse);
    }

    if (transformerName === 'codex') {
      return transformCodexResponseToClaude(response);
    }

    if (transformerName === 'openai-chat') {
      return transformOpenAIChatResponseToClaude(response);
    }

    return response;
  }

  /**
   * 创建 Claude → Codex Pipeline
   */
  private createClaudeToCodexPipeline() {
    return [
      createStage('parse', this.parseStage.bind(this)),
      createStage('render', this.renderStage.bind(this)),
      createStage('validate', this.validateStage.bind(this)),
    ];
  }

  /**
   * Parse Stage: 解析 Claude 请求
   */
  private parseStage(
    input: TransformRequest,
    audit: FieldAuditCollector,
  ): StageResult<any> {
    const body = input.request.body as ClaudeMessagesRequest;

    // 收集源路径
    const sourcePaths = collectJsonPointers(body);
    audit.addSourcePaths(sourcePaths);

    // 解析
    const parsed = parseClaudeRequest(body);

    return {
      data: { input, parsed },
      audit: audit.getAudit(),
    };
  }

  /**
   * Render Stage: 渲染 Codex 请求
   */
  private renderStage(
    input: any,
    audit: FieldAuditCollector,
  ): StageResult<any> {
    const { parsed } = input;

    const renderConfig: RenderConfig = {
      instructionsTemplate: this.config.instructionsTemplate,
      reasoningEffort: this.config.reasoningEffort,
      thinkingConfig: this.config.thinkingConfig,
    };

    // 从 parsed 中提取 renderCodexRequest 所需参数
    const renderResult = renderCodexRequest({
      model: parsed.model,
      system: parsed.system,
      messages: parsed.messages,
      tools: parsed.tools,
      stream: parsed.stream,
      sessionId: parsed.sessionId,
      promptCacheRetention: parsed.promptCacheRetention,
    }, renderConfig, audit);

    // 收集目标路径
    const targetPaths = collectJsonPointers(renderResult.request);
    audit.addTargetPaths(targetPaths);

    // 计算未映射路径
    const unmapped = input.input.request.body
      ? audit.getAudit().sourcePaths.filter(p => !targetPaths.some(tp => tp.endsWith(p)))
      : [];
    audit.addUnmappedSourcePaths(unmapped);

    return {
      data: { ...renderResult, parsed: input.parsed, input: input.input },
      audit: audit.getAudit(),
    };
  }

  /**
   * Validate Stage: 校验 Codex 请求
   */
  private validateStage(
    input: any,
    audit: FieldAuditCollector,
  ): StageResult<any> {
    const errors = validateCodexRequest(input, audit);

    if (errors.length > 0) {
      return {
        data: input,
        audit: audit.getAudit(),
        errors: errors.map(e => new TransformError(
          e.type,
          'validate',
          e.message,
          { path: e.path },
        )),
      };
    }

    return {
      data: input,
      audit: audit.getAudit(),
    };
  }
}

/**
 * 映射请求头：Claude SDK → Codex
 *
 * 移除 Claude SDK 特定的请求头（anthropic-*、x-stainless-* 等）
 * 保留通用的请求头（authorization、content-type 等）
 */
function mapHeadersForCodex(headers: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};

  // 需要移除的 Claude SDK 特定请求头前缀
  const removePrefixes = [
    'anthropic-',
    'x-stainless-',
    'x-api-key',
    'x-app',
  ];

  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase();

    // 移除 Claude SDK 特定的请求头
    const shouldRemove = removePrefixes.some(prefix =>
      keyLower.startsWith(prefix.toLowerCase())
    );

    if (shouldRemove) {
      continue;
    }

    // 保留其他请求头
    mapped[key] = value;
  }

  return mapped;
}

/**
 * 映射请求头：Claude SDK → Gemini
 *
 * - 移除 Claude SDK/网关相关头（anthropic-* / x-stainless-* 等）
 * - 保留通用头（user-agent 等）
 * - stream 时尽量明确 accept
 */
function mapHeadersForGemini(
  headers: Record<string, string>,
  options: { stream: boolean },
): Record<string, string> {
  const mapped: Record<string, string> = {};

  const removePrefixes = [
    'anthropic-',
    'x-stainless-',
    'x-api-key',
    'x-app',
  ];

  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase();
    if (removePrefixes.some(prefix => keyLower.startsWith(prefix))) continue;
    mapped[keyLower] = value;
  }

  if (options.stream) {
    // Gemini v1beta SSE：显式声明 event-stream 更稳定
    mapped['accept'] = 'text/event-stream';
  }

  return mapped;
}

/**
 * 映射请求头：Claude SDK → OpenAI Chat
 *
 * - 移除 Claude SDK/网关相关头（anthropic-* / x-stainless-* 等）
 * - 保留通用头（user-agent 等）
 * - stream 时尽量明确 accept
 */
function mapHeadersForOpenAIChat(
  headers: Record<string, string>,
  options: { stream: boolean },
): Record<string, string> {
  const mapped: Record<string, string> = {};

  const removePrefixes = [
    'anthropic-',
    'x-stainless-',
    'x-api-key',
    'x-app',
  ];

  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase();
    if (removePrefixes.some(prefix => keyLower.startsWith(prefix))) continue;
    mapped[keyLower] = value;
  }

  if (options.stream) {
    mapped['accept'] = 'text/event-stream';
  }

  return mapped;
}
