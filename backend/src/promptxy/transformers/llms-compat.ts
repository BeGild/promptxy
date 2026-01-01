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

const logger = createLogger({ debug: false });

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
function selectChain(
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
function sanitizeHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveKeys = [
    'authorization',
    'x-api-key',
    'x-goog-api-key',
    'cookie',
    'set-cookie',
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

      // 4. 注入上游认证
      const finalHeaders = injectUpstreamAuth(
        currentHeaders,
        supplier.auth,
      );

      trace.totalDuration = Date.now() - startTime;
      trace.success = trace.errors.length === 0;

      return {
        request: {
          method: req.method,
          path: req.path,
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
   * 从请求体中提取模型名称
   */
  private extractModel(body: unknown): string | undefined {
    if (body && typeof body === 'object' && 'model' in body) {
      return String(body.model);
    }
    return undefined;
  }

  /**
   * 应用单个转换器
   *
   * 这里调用 @musistudio/llms 的转换能力
   * 由于 llms 是 ESM 模块，需要动态导入
   */
  private async applyTransformer(
    transformerName: string,
    body: unknown,
    options?: Record<string, unknown>,
  ): Promise<{ body: unknown; headers: Record<string, string> }> {
    try {
      // 动态导入 @musistudio/llms
      // 注意：由于 llms 的 API 可能变化，这里需要适配
      const llmsModule = await import('@musistudio/llms');

      // TODO: 根据实际的 @musistudio/llms API 调用
      // 这里是一个简化的实现框架
      //
      // 实际使用时，需要根据 llms 的 API 文档调整：
      // - 可能需要调用 llms 的 transformRequest 函数
      // - 可能需要传入 transformerName 和 options
      // - 需要处理流式和非流式两种情况

      if (logger.debugEnabled) {
        const optionsStr = options ? ` 选项: ${JSON.stringify(options)}` : '';
        logger.debug(`[ProtocolTransformer] 应用转换器: ${transformerName}${optionsStr}`);
      }

      // 临时实现：直接返回原 body（待集成真实 llms API）
      return {
        body,
        headers: {},
      };
    } catch (error: any) {
      logger.debug(
        `[ProtocolTransformer] 转换器 ${transformerName} 执行失败: ${error?.message}`,
      );
      throw error;
    }
  }
}

/**
 * 创建协议转换器实例
 */
export function createProtocolTransformer(): ProtocolTransformer {
  return new ProtocolTransformer();
}
