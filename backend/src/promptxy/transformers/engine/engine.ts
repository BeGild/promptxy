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

/**
 * 协议对类型
 */
export type ProtocolPair = 'claude-to-codex' | 'codex-to-claude';

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
   * 执行转换（Claude → Codex）
   */
  async transform(req: TransformRequest): Promise<TransformResponse> {
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

    // 返回转换后的请求
    const codexRequest = result.data as CodexResponsesApiRequest;

    // 映射请求头：移除 Claude SDK 特定请求头，添加 Codex 特定请求头
    const mappedHeaders = mapHeadersForCodex(req.request.headers);

    return {
      request: {
        method: 'POST',
        path: '/v1/responses',
        headers: {
          ...mappedHeaders,
          'content-type': 'application/json',
        },
        body: codexRequest,
      },
      needsResponseTransform: true,
      trace,
    };
  }

  /**
   * 转换响应（Codex → Claude）
   * 暂时简化实现，直接返回原始响应
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
    // 暂时直接返回原始响应
    // TODO: 实现实际的响应转换逻辑
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
    };

    // 从 parsed 中提取 renderCodexRequest 所需参数
    const codexRequest = renderCodexRequest({
      model: parsed.model,
      system: parsed.system,
      messages: parsed.messages,
      tools: parsed.tools,
      stream: parsed.stream,
      sessionId: parsed.sessionId,
    }, renderConfig, audit);

    // 收集目标路径
    const targetPaths = collectJsonPointers(codexRequest);
    audit.addTargetPaths(targetPaths);

    // 计算未映射路径
    const unmapped = input.input.request.body
      ? audit.getAudit().sourcePaths.filter(p => !targetPaths.some(tp => tp.endsWith(p)))
      : [];
    audit.addUnmappedSourcePaths(unmapped);

    return {
      data: codexRequest,
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
