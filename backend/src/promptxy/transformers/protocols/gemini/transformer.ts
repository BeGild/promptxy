/**
 * Gemini 协议转换器 - 完整入口
 *
 * 整合请求转换、响应转换、SSE 转换和审计功能
 */

import {
  buildGeminiURL,
  buildCountTokensURL,
  transformClaudeToGeminiRequest,
  transformHeaders,
  transformGeminiResponseToClaude,
  transformClaudeCountTokens,
  estimateTokensLocally,
  GeminiTransformAuditCollector,
  createGeminiEvidence,
  parseGeminiSSEChunk,
} from './index.js';
import {
  transformGeminiSSEWithRetry,
  createTraceSummary,
} from './sse/index.js';
import type {
  ClaudeMessage,
  ClaudeMessagesRequest,
  ClaudeTool,
} from '../claude/types.js';
import type {
  GeminiGenerateContentResponse,
  GeminiSSEChunk,
} from './types.js';
import type {
  ClaudeMessageResponse,
  CountTokensResult,
} from './index.js';
import type { RetryConfig } from './sse/index.js';

/**
 * Gemini 转换器配置
 */
export interface GeminiTransformerConfig {
  /** Base URL */
  baseUrl: string;
  /** API Key */
  apiKey?: string;
  /** 是否启用审计 */
  enableAudit?: boolean;
  /** 重试配置 */
  retryConfig?: RetryConfig;
}

/**
 * 转换结果（带审计）
 */
export interface TransformResult<T> {
  /** 转换后的数据 */
  data: T;
  /** 审计结果（如果启用） */
  audit?: ReturnType<GeminiTransformAuditCollector['getAudit']>;
}

/**
 * Gemini 协议转换器
 */
export class GeminiTransformer {
  private config: GeminiTransformerConfig;
  private auditCollector?: GeminiTransformAuditCollector;

  constructor(config: GeminiTransformerConfig) {
    this.config = config;
    if (config.enableAudit) {
      this.auditCollector = new GeminiTransformAuditCollector();
    }
  }

  /**
   * 转换请求（Claude → Gemini）
   */
  transformRequest(claudeRequest: ClaudeMessagesRequest): TransformResult<{
    url: string;
    body: string;
    headers: Record<string, string>;
  }> {
    // 构建上下文
    const context = this.buildTransformContext();

    // 处理 system 参数的类型转换
    const system = claudeRequest.system;
    const normalizedSystem = system && typeof system === 'object'
      ? (system as any).map((block: any) => ({
          type: 'text',
          text: Array.isArray(block.text) ? block.text.join('\n') : block.text,
        }))
      : system;

    // 转换请求体
    const { request, context: transformContext } = transformClaudeToGeminiRequest(
      claudeRequest.model,
      normalizedSystem,
      claudeRequest.messages,
      claudeRequest.tools,
      claudeRequest.stream ?? false,
      claudeRequest.max_tokens,
      claudeRequest.temperature,
      claudeRequest.top_p,
      claudeRequest.stop_sequences
    );

    // 构建 URL
    const url = buildGeminiURL({
      baseUrl: this.config.baseUrl,
      model: claudeRequest.model, // TODO: 应用 claudeModelMap
      stream: claudeRequest.stream ?? false,
      apiKey: this.config.apiKey,
    });

    // 转换 headers
    const headers = transformHeaders({}, this.config.apiKey);

    // 记录审计信息
    if (this.auditCollector) {
      this.collectRequestAudit(claudeRequest, request, transformContext, url);
    }

    return {
      data: {
        url,
        body: JSON.stringify(request),
        headers,
      },
      audit: this.auditCollector?.getAudit(),
    };
  }

  /**
   * 转换响应（Gemini → Claude，非流式）
   */
  transformResponse(
    geminiResponse: GeminiGenerateContentResponse,
    model?: string
  ): TransformResult<ClaudeMessageResponse> {
    const claudeResponse = transformGeminiResponseToClaude(geminiResponse, model);

    // 记录审计信息
    if (this.auditCollector) {
      this.collectResponseAudit(geminiResponse);
    }

    return {
      data: claudeResponse,
      audit: this.auditCollector?.getAudit(),
    };
  }

  /**
   * 转换 SSE 流（Gemini SSE → Claude SSE）
   */
  transformSSE(
    sseChunks: GeminiSSEChunk[],
    enableRetry = true
  ): TransformResult<{
    events: ClaudeSSEEvent[];
    traceSummary?: string;
  }> & { streamEnd: boolean } {
    const result = transformGeminiSSEWithRetry(sseChunks, {
      enableRetry,
      ...this.config.retryConfig,
    });

    // 生成 trace 摘要
    const traceSummary = createTraceSummary(result.trace);

    return {
      data: {
        events: result.events,
        traceSummary,
      },
      streamEnd: result.streamEnd,
      audit: this.auditCollector?.getAudit(),
    };
  }

  /**
   * 转换 count_tokens 请求
   */
  transformCountTokens(
    messages: ClaudeMessage[],
    system?: string | ClaudeContentBlock[],
    enableFallback = true
  ): TransformResult<{
    geminiRequest: object;
    url: string;
  }> {
    const geminiRequest = transformClaudeCountTokens(messages, system);
    const url = buildCountTokensURL({
      baseUrl: this.config.baseUrl,
      model: 'gemini-2.0-flash-exp', // TODO: 从配置获取
      apiKey: this.config.apiKey,
    });

    return {
      data: {
        geminiRequest,
        url,
      },
      audit: this.auditCollector?.getAudit(),
    };
  }

  /**
   * 转换 count_tokens 响应
   */
  transformCountTokensResponse(
    response: { totalTokens: number },
    enableFallback = true
  ): TransformResult<CountTokensResult> {
    try {
      const result = {
        input_tokens: response.totalTokens,
      };

      return {
        data: result,
        audit: this.auditCollector?.getAudit(),
      };
    } catch (e) {
      if (enableFallback) {
        // 使用本地估算
        const fallbackResult = estimateTokensLocally([], undefined);
        fallbackResult.fallback = true;

        if (this.auditCollector) {
          this.auditCollector.setMetadata(
            'count_tokens_fallback',
            true
          );
        }

        return {
          data: fallbackResult,
          audit: this.auditCollector?.getAudit(),
        };
      }

      throw e;
    }
  }

  /**
   * 解析 SSE chunk
   */
  parseSSEChunk(chunk: string): GeminiSSEChunk[] {
    return parseGeminiSSEChunk(chunk);
  }

  /**
   * 获取审计收集器
   */
  getAuditCollector(): GeminiTransformAuditCollector | undefined {
    return this.auditCollector;
  }

  /**
   * 获取审计摘要（用于展示）
   */
  getAuditSummary() {
    return this.auditCollector?.getSummary();
  }

  /**
   * 构建转换上下文
   */
  private buildTransformContext() {
    // TODO: 从配置或路由获取 claudeModelMap
    return {};
  }

  /**
   * 收集请求审计信息
   */
  private collectRequestAudit(
    claudeRequest: ClaudeMessagesRequest,
    geminiRequest: any,
    context: any,
    url: string
  ) {
    if (!this.auditCollector) return;

    // 记录 URL 信息
    const urlObj = new URL(url);
    const isStreaming = urlObj.searchParams.has('alt');
    const hasQueryKey = urlObj.searchParams.has('key');

    this.auditCollector.recordUrlInfo({
      baseUrl: this.config.baseUrl,
      action: isStreaming ? 'streamGenerateContent' : 'generateContent',
      model: claudeRequest.model,
      streaming: isStreaming,
      hasQueryKey,
    });

    // 记录消息统计
    this.auditCollector.recordSourceMessage(claudeRequest.messages.length);
    this.auditCollector.recordTargetContent(
      geminiRequest.contents?.length ?? 0
    );

    // 记录工具
    if (claudeRequest.tools) {
      this.auditCollector.recordTools(claudeRequest.tools.length);
    }

    // 记录 tool_use_id 映射
    this.auditCollector.recordToolUseMapping(
      context.toolUseMappings.size
    );

    // 记录系统指令
    if (geminiRequest.systemInstruction) {
      this.auditCollector.recordSystemInstruction();
    }

    // 记录生成配置
    if (geminiRequest.generationConfig) {
      this.auditCollector.recordGenerationConfig(
        geminiRequest.generationConfig
      );
    }

    // 添加证据引用
    this.auditCollector.addEvidence(
      createGeminiEvidence('transformClaudeToGeminiRequest')
    );
  }

  /**
   * 收集响应审计信息
   */
  private collectResponseAudit(geminiResponse: GeminiGenerateContentResponse) {
    if (!this.auditCollector) return;

    const candidate = geminiResponse.candidates?.[0];
    if (!candidate) return;

    // 记录 finishReason
    if (candidate.finishReason) {
      this.auditCollector.recordFinishReasonMapping(
        candidate.finishReason,
        // TODO: 获取映射后的 Claude stop_reason
        'mapped'
      );
    }

    // 记录 usage
    if (geminiResponse.usageMetadata) {
      this.auditCollector.recordUsageMapping(geminiResponse.usageMetadata);
    }

    // 记录 parts 统计
    const parts = candidate.content?.parts ?? [];
    let thoughtCount = 0;
    for (const part of parts) {
      if ('thought' in part && part.thought) {
        thoughtCount++;
      }
    }

    if (thoughtCount > 0) {
      this.auditCollector.recordThoughtFilter(thoughtCount);
    }

    // 添加证据引用
    this.auditCollector.addEvidence(
      createGeminiEvidence('transformGeminiResponseToClaude')
    );
  }
}

// 导出类型
import type { ClaudeSSEEvent } from '../claude/types.js';
import type { ClaudeContentBlock } from '../claude/types.js';
