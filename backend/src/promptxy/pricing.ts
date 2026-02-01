/**
 * PromptXY 价格计算服务
 *
 * 功能：
 * - 内置主流 AI 模型价格数据
 * - 支持精确匹配和通配符匹配
 * - 自动计算 Token 费用
 */

import type { ModelPrice } from './types.js';

/**
 * 内置模型价格数据
 * 价格单位：美元/1K tokens
 * 数据来源：各官方定价页面（2026年1月）
 */
const BUILT_IN_PRICES: ModelPrice[] = [
  // ============================================================================
  // Claude (Anthropic)
  // ============================================================================
  {
    model: 'claude-3-5-sonnet-20241022',
    inputPrice: 3.0,
    outputPrice: 15.0,
    provider: 'anthropic',
  },
  {
    model: 'claude-3-5-sonnet-20240620',
    inputPrice: 3.0,
    outputPrice: 15.0,
    provider: 'anthropic',
  },
  {
    model: 'claude-3-5-haiku-20241022',
    inputPrice: 0.8,
    outputPrice: 4.0,
    provider: 'anthropic',
  },
  {
    model: 'claude-3-5-haiku-20240307',
    inputPrice: 0.8,
    outputPrice: 4.0,
    provider: 'anthropic',
  },
  {
    model: 'claude-3-opus-20240229',
    inputPrice: 15.0,
    outputPrice: 75.0,
    provider: 'anthropic',
  },
  {
    model: 'claude-3-sonnet-20240229',
    inputPrice: 3.0,
    outputPrice: 15.0,
    provider: 'anthropic',
  },
  {
    model: 'claude-3-haiku-20240307',
    inputPrice: 0.25,
    outputPrice: 1.25,
    provider: 'anthropic',
  },
  // 通配符匹配
  {
    model: 'claude-*-sonnet-*',
    inputPrice: 3.0,
    outputPrice: 15.0,
    provider: 'anthropic',
  },
  {
    model: 'claude-*-haiku-*',
    inputPrice: 0.8,
    outputPrice: 4.0,
    provider: 'anthropic',
  },

  // ============================================================================
  // OpenAI
  // ============================================================================
  {
    model: 'gpt-4o',
    inputPrice: 2.5,
    outputPrice: 10.0,
    provider: 'openai',
  },
  {
    model: 'gpt-4o-mini',
    inputPrice: 0.15,
    outputPrice: 0.6,
    provider: 'openai',
  },
  {
    model: 'gpt-4-turbo',
    inputPrice: 10.0,
    outputPrice: 30.0,
    provider: 'openai',
  },
  {
    model: 'gpt-4',
    inputPrice: 30.0,
    outputPrice: 60.0,
    provider: 'openai',
  },
  {
    model: 'gpt-3.5-turbo',
    inputPrice: 0.5,
    outputPrice: 1.5,
    provider: 'openai',
  },

  // ============================================================================
  // Gemini (Google)
  // ============================================================================
  {
    model: 'gemini-2.0-flash-exp',
    inputPrice: 0.075,
    outputPrice: 0.3,
    provider: 'google',
  },
  {
    model: 'gemini-2.0-flash-thinking-exp',
    inputPrice: 0.075,
    outputPrice: 0.3,
    provider: 'google',
  },
  {
    model: 'gemini-1.5-pro',
    inputPrice: 1.25,
    outputPrice: 5.0,
    provider: 'google',
  },
  {
    model: 'gemini-1.5-flash',
    inputPrice: 0.075,
    outputPrice: 0.3,
    provider: 'google',
  },
  {
    model: 'gemini-1.5-flash-8b',
    inputPrice: 0.0375,
    outputPrice: 0.15,
    provider: 'google',
  },

  // ============================================================================
  // GLM (智谱)
  // ============================================================================
  {
    model: 'glm-4.6',
    inputPrice: 0.6,
    outputPrice: 2.2,
    provider: 'zhipu',
  },
  {
    model: 'glm-4.5',
    inputPrice: 0.6,
    outputPrice: 2.2,
    provider: 'zhipu',
  },
  {
    model: 'glm-4.5-air',
    inputPrice: 0.2,
    outputPrice: 1.1,
    provider: 'zhipu',
  },
  {
    model: 'glm-4.5-flash',
    inputPrice: 0.0,
    outputPrice: 0.0,
    provider: 'zhipu',
  },

  // ============================================================================
  // DeepSeek
  // ============================================================================
  {
    model: 'deepseek-chat',
    inputPrice: 0.28,
    outputPrice: 0.42,
    provider: 'deepseek',
  },
  {
    model: 'deepseek-reasoner',
    inputPrice: 0.28,
    outputPrice: 0.42,
    provider: 'deepseek',
  },

  // ============================================================================
  // 通配符默认（兜底）
  // ============================================================================
  {
    model: 'gpt-*',
    inputPrice: 0.5,
    outputPrice: 1.5,
    provider: 'openai',
  },
  {
    model: 'claude-*',
    inputPrice: 3.0,
    outputPrice: 15.0,
    provider: 'anthropic',
  },
  {
    model: 'gemini-*',
    inputPrice: 0.075,
    outputPrice: 0.3,
    provider: 'google',
  },
];

/**
 * 价格计算服务
 */
export class PricingService {
  private prices: ModelPrice[];

  constructor(customPrices: ModelPrice[] = []) {
    this.prices = [...BUILT_IN_PRICES, ...customPrices];
  }

  /**
   * 查找模型价格
   * 支持精确匹配和通配符匹配
   */
  private findPrice(model: string): ModelPrice | undefined {
    // 精确匹配
    let price = this.prices.find((p) => p.model === model);

    if (!price) {
      // 通配符匹配（按长度降序，优先匹配更具体的规则）
      const wildcardPrices = this.prices
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
      // 未找到价格，返回 0
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
      inputCost: Math.round(inputCost * 1_000_000) / 1_000_000, // 保留 6 位小数
      outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
      totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
    };
  }

  /**
   * 从请求体中提取模型名称
   * 支持多种协议格式
   */
  extractModel(requestBody: any): string | undefined {
    if (!requestBody || typeof requestBody !== 'object') {
      return undefined;
    }

    // 标准格式：{ model: "xxx" }
    if (requestBody.model && typeof requestBody.model === 'string') {
      return requestBody.model;
    }

    // OpenAI 兼容格式
    if (requestBody.messages && requestBody.model) {
      return requestBody.model;
    }

    return undefined;
  }

  /**
   * 从响应中提取 Token 使用数据
   * 支持多种协议格式
   */
  extractUsage(responseBody: any): {
    inputTokens: number;
    outputTokens: number;
  } {
    const result = { inputTokens: 0, outputTokens: 0 };

    if (!responseBody) {
      return result;
    }

    // Anthropic 格式（SSE 事件数组）
    if (Array.isArray(responseBody)) {
      for (const event of responseBody) {
        if (event.type === 'message_stop' && event.message?.usage) {
          result.inputTokens = event.message.usage.input_tokens || 0;
          result.outputTokens = event.message.usage.output_tokens || 0;
          break;
        }
      }
    }
    // Anthropic 格式（单个响应对象）
    else if (responseBody.usage) {
      result.inputTokens = responseBody.usage.input_tokens || 0;
      result.outputTokens = responseBody.usage.output_tokens || 0;
    }
    // OpenAI 格式
    else if (responseBody.usage) {
      result.inputTokens = responseBody.usage.prompt_tokens || 0;
      result.outputTokens = responseBody.usage.completion_tokens || 0;
    }

    return result;
  }

  /**
   * 获取所有价格配置
   */
  getAllPrices(): ModelPrice[] {
    return [...this.prices];
  }

  /**
   * 添加自定义价格
   */
  addCustomPrice(price: ModelPrice): void {
    // 移除已存在的同模型价格
    this.prices = this.prices.filter((p) => p.model !== price.model);
    this.prices.push(price);
  }

  /**
   * 移除价格配置
   */
  removePrice(model: string): boolean {
    const initialLength = this.prices.length;
    this.prices = this.prices.filter((p) => p.model !== model);
    return this.prices.length < initialLength;
  }

  /**
   * 获取模型价格
   */
  getModelPrice(model: string): ModelPrice | undefined {
    return this.findPrice(model);
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
