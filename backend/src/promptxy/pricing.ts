/**
 * PromptXY 价格计算服务
 *
 * 功能：
 * - 从本地存储获取模型价格（由 sync 服务自动同步）
 * - 支持精确匹配和通配符匹配
 * - 自动计算 Token 费用
 * - 硬编码作为兜底
 */

import type { ModelPrice, StoredModelPrice } from './types.js';
import { getSyncStorage } from './sync/sync-storage.js';

/**
 * 供应商协议类型
 */
export type SupplierProtocol =
  | 'anthropic'
  | 'openai-chat'
  | 'openai-codex'
  | 'gemini'
  | 'zhipu'
  | 'deepseek'
  | 'unknown';

/**
 * 兜底价格表（当 sync 服务未同步时使用）
 * 价格单位：美元/1K tokens
 */
const FALLBACK_PRICES: ModelPrice[] = [
  // Claude (Anthropic)
  { model: 'claude-3-5-sonnet-20241022', inputPrice: 3.0, outputPrice: 15.0, provider: 'anthropic' },
  { model: 'claude-3-5-haiku-20241022', inputPrice: 0.8, outputPrice: 4.0, provider: 'anthropic' },
  { model: 'claude-3-opus-20240229', inputPrice: 15.0, outputPrice: 75.0, provider: 'anthropic' },
  { model: 'claude-sonnet-4-5-20250929', inputPrice: 3.0, outputPrice: 15.0, provider: 'anthropic' },
  { model: 'claude-*-sonnet-*', inputPrice: 3.0, outputPrice: 15.0, provider: 'anthropic' },
  { model: 'claude-*-haiku-*', inputPrice: 0.8, outputPrice: 4.0, provider: 'anthropic' },
  { model: 'claude-*', inputPrice: 3.0, outputPrice: 15.0, provider: 'anthropic' },

  // OpenAI
  { model: 'gpt-4o', inputPrice: 2.5, outputPrice: 10.0, provider: 'openai' },
  { model: 'gpt-4o-mini', inputPrice: 0.15, outputPrice: 0.6, provider: 'openai' },
  { model: 'gpt-4-turbo', inputPrice: 10.0, outputPrice: 30.0, provider: 'openai' },
  { model: 'gpt-3.5-turbo', inputPrice: 0.5, outputPrice: 1.5, provider: 'openai' },
  { model: 'gpt-*', inputPrice: 0.5, outputPrice: 1.5, provider: 'openai' },

  // Gemini
  { model: 'gemini-1.5-pro', inputPrice: 1.25, outputPrice: 5.0, provider: 'google' },
  { model: 'gemini-1.5-flash', inputPrice: 0.075, outputPrice: 0.3, provider: 'google' },
  { model: 'gemini-*', inputPrice: 0.075, outputPrice: 0.3, provider: 'google' },

  // DeepSeek
  { model: 'deepseek-chat', inputPrice: 0.28, outputPrice: 0.42, provider: 'deepseek' },
  { model: 'deepseek-*', inputPrice: 0.28, outputPrice: 0.42, provider: 'deepseek' },

  // GLM
  { model: 'glm-4.5', inputPrice: 0.6, outputPrice: 2.2, provider: 'zhipu' },
  { model: 'glm-4.5-air', inputPrice: 0.2, outputPrice: 1.1, provider: 'zhipu' },
  { model: 'glm-4.5-flash', inputPrice: 0.0, outputPrice: 0.0, provider: 'zhipu' },
  { model: 'glm-*', inputPrice: 0.6, outputPrice: 2.2, provider: 'zhipu' },
];

/**
 * 价格计算服务
 */
export class PricingService {
  private customPrices: ModelPrice[] = [];
  private storage = getSyncStorage();

  /**
   * 从同步存储获取价格
   */
  private getStoredPrices(): ModelPrice[] {
    try {
      const stored = this.storage.getAllPrices();
      return stored.map((p: StoredModelPrice) => ({
        model: p.modelName,
        inputPrice: p.inputPrice,
        outputPrice: p.outputPrice,
        provider: p.provider,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 获取所有可用价格（优先级：自定义 > 同步存储 > 兜底）
   */
  private getAllPrices(): ModelPrice[] {
    const stored = this.getStoredPrices();
    return [...this.customPrices, ...stored, ...FALLBACK_PRICES];
  }

  /**
   * 查找模型价格
   * 支持精确匹配和通配符匹配
   */
  private findPrice(model: string): ModelPrice | undefined {
    const prices = this.getAllPrices();

    // 精确匹配（优先）
    let price = prices.find((p) => p.model === model);

    if (!price) {
      // 通配符匹配（按长度降序，优先匹配更具体的规则）
      const wildcardPrices = prices
        .filter((p) => p.model.includes('*'))
        .sort((a, b) => b.model.length - a.model.length);

      for (const wildcardPrice of wildcardPrices) {
        const pattern = wildcardPrice.model.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(model)) {
          price = wildcardPrice;
          break;
        }
      }
    }

    return price;
  }

  /**
   * 计算 Token 费用
   * @param model 模型名称
   * @param inputTokens 输入 Token 数
   * @param outputTokens 输出 Token 数
   * @returns 费用对象（美元）
   */
  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): { inputCost: number; outputCost: number; totalCost: number } {
    const price = this.findPrice(model);

    if (!price) {
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
      };
    }

    // 价格单位：美元/1K tokens
    const inputCost = (inputTokens / 1000) * price.inputPrice;
    const outputCost = (outputTokens / 1000) * price.outputPrice;
    const totalCost = inputCost + outputCost;

    return {
      inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,
      outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
      totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
    };
  }

  /**
   * 从请求体中提取模型名称
   */
  extractModel(requestBody: any): string | undefined {
    if (!requestBody || typeof requestBody !== 'object') {
      return undefined;
    }

    if (requestBody.model && typeof requestBody.model === 'string') {
      return requestBody.model;
    }

    return undefined;
  }

  /**
   * 从响应中提取 Token 使用数据
   */
  extractUsage(responseBody: any): {
    inputTokens: number;
    outputTokens: number;
  } {
    const result = { inputTokens: 0, outputTokens: 0 };

    if (!responseBody) {
      return result;
    }

    // SSE 事件数组（Anthropic / OpenAI Chat / Codex Responses 等）
    if (Array.isArray(responseBody)) {
      // 从尾部回扫，优先拿到最终 usage（更接近“completed/stop”事件）
      for (let i = responseBody.length - 1; i >= 0; i--) {
        const event = responseBody[i];
        if (!event || typeof event !== 'object') continue;

        // Claude (Anthropic): message_stop.message.usage
        if (event.type === 'message_stop' && event.message?.usage) {
          result.inputTokens = event.message.usage.input_tokens || 0;
          result.outputTokens = event.message.usage.output_tokens || 0;
          break;
        }

        // Codex Responses SSE: response.completed.response.usage
        // 以及兼容一些实现：evt.response.usage
        const usageCandidate = (event as any).usage ?? (event as any).message?.usage ?? (event as any).response?.usage;
        if (usageCandidate && typeof usageCandidate === 'object') {
          if ((usageCandidate as any).input_tokens !== undefined || (usageCandidate as any).output_tokens !== undefined) {
            result.inputTokens = (usageCandidate as any).input_tokens || 0;
            result.outputTokens = (usageCandidate as any).output_tokens || 0;
            break;
          }
          if ((usageCandidate as any).prompt_tokens !== undefined || (usageCandidate as any).completion_tokens !== undefined) {
            result.inputTokens = (usageCandidate as any).prompt_tokens || 0;
            result.outputTokens = (usageCandidate as any).completion_tokens || 0;
            break;
          }
        }
      }
    }
    // Anthropic 格式（单个响应对象）
    else if (responseBody.usage && (responseBody.usage.input_tokens !== undefined || responseBody.usage.output_tokens !== undefined)) {
      result.inputTokens = responseBody.usage.input_tokens || 0;
      result.outputTokens = responseBody.usage.output_tokens || 0;
    }
    // OpenAI 格式
    else if (responseBody.usage && (responseBody.usage.prompt_tokens !== undefined || responseBody.usage.completion_tokens !== undefined)) {
      result.inputTokens = responseBody.usage.prompt_tokens || 0;
      result.outputTokens = responseBody.usage.completion_tokens || 0;
    }

    return result;
  }

  /**
   * 从响应内容估算 Output Tokens（当上游不返回 usage 时）
   * 适用于流式响应
   */
  estimateOutputTokensFromContent(responseBody: any): number {
    if (!responseBody) return 0;

    let contentText = '';

    // OpenAI 流式 SSE 格式（事件数组）
    if (Array.isArray(responseBody)) {
      for (const event of responseBody) {
        // 处理 delta 格式
        if (event.choices?.[0]?.delta?.content) {
          contentText += event.choices[0].delta.content;
        }
        // 处理 text 格式 (Gemini)
        else if (event.candidates?.[0]?.content?.parts?.[0]?.text) {
          contentText += event.candidates[0].content.parts[0].text;
        }
      }
    }
    // OpenAI 非流式格式
    else if (responseBody.choices?.[0]?.message?.content) {
      contentText = responseBody.choices[0].message.content;
    }
    // 简单字符串响应
    else if (typeof responseBody === 'string') {
      contentText = responseBody;
    }

    return this.estimateTokensFromText(contentText);
  }

  /**
   * 从请求体估算 Input Tokens
   */
  estimateInputTokens(requestBody: any): number {
    if (!requestBody) return 0;

    let totalText = '';

    // OpenAI 格式: messages 数组
    if (Array.isArray(requestBody.messages)) {
      for (const msg of requestBody.messages) {
        if (typeof msg.content === 'string') {
          totalText += msg.content;
        } else if (Array.isArray(msg.content)) {
          // 多模态内容
          for (const part of msg.content) {
            if (part.type === 'text' && part.text) {
              totalText += part.text;
            }
          }
        }
      }
    }
    // Anthropic 格式
    else if (Array.isArray(requestBody.contents)) {
      for (const content of requestBody.contents) {
        if (typeof content.text === 'string') {
          totalText += content.text;
        }
      }
    }
    // 简单 prompt 格式
    else if (typeof requestBody.prompt === 'string') {
      totalText = requestBody.prompt;
    }

    return this.estimateTokensFromText(totalText);
  }

  /**
   * 文本 Token 估算（保守估计）
   * 基于：英文约 4 字符/token，中文约 1-2 字符/token
   * 使用 3 作为平均值，稍微高估以确保准确性
   */
  private estimateTokensFromText(text: string): number {
    if (!text || text.length === 0) return 0;
    // 每 3 个字符约 1 个 token（保守估算）
    return Math.ceil(text.length / 3);
  }

  /**
   * 添加自定义价格（覆盖同步和兜底价格）
   */
  addCustomPrice(price: ModelPrice): void {
    // 移除已存在的同模型价格
    this.customPrices = this.customPrices.filter((p) => p.model !== price.model);
    this.customPrices.push(price);
  }

  /**
   * 移除自定义价格
   */
  removeCustomPrice(model: string): boolean {
    const initialLength = this.customPrices.length;
    this.customPrices = this.customPrices.filter((p) => p.model !== model);
    return this.customPrices.length < initialLength;
  }

  /**
   * 获取模型价格
   */
  getModelPrice(model: string): ModelPrice | undefined {
    return this.findPrice(model);
  }

  /**
   * 获取所有可用价格
   */
  getAllPricesList(): ModelPrice[] {
    return this.getAllPrices();
  }
}

// 全局实例
let pricingServiceInstance: PricingService | null = null;

/**
 * 获取价格计算服务实例（单例）
 */
export function getPricingService(): PricingService {
  if (!pricingServiceInstance) {
    pricingServiceInstance = new PricingService();
  }
  return pricingServiceInstance;
}

/**
 * 重置价格计算服务实例（用于测试）
 */
export function resetPricingService(): void {
  pricingServiceInstance = null;
}
