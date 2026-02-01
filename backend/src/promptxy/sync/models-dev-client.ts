/**
 * models.dev API 客户端
 *
 * 从 models.dev 获取模型价格和列表数据
 * API: https://github.com/sst/models.dev
 */

import type { ModelsDevResponse, ModelPriceData } from '../types.js';

const API_URL = 'https://models.dev/api.json';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24小时缓存

/**
 * 缓存数据
 */
interface CachedData {
  data: ModelsDevResponse;
  timestamp: number;
}

/**
 * models.dev API 客户端
 */
export class ModelsDevClient {
  private cache: CachedData | null = null;

  /**
   * 获取完整数据（带缓存）
   */
  async fetchWithCache(maxAge: number = CACHE_MAX_AGE): Promise<ModelsDevResponse> {
    // 检查缓存
    if (this.cache && Date.now() - this.cache.timestamp < maxAge) {
      return this.cache.data;
    }

    // 获取新数据
    const data = await this.fetchAll();

    // 更新缓存
    this.cache = {
      data,
      timestamp: Date.now(),
    };

    return data;
  }

  /**
   * 获取完整数据
   */
  async fetchAll(): Promise<ModelsDevResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    try {
      const response = await fetch(API_URL, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PromptXY/2.0',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as ModelsDevResponse;
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时（30秒）');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 获取指定供应商的模型数据
   */
  async fetchByProvider(provider: string): Promise<Record<string, ModelPriceData>> {
    const data = await this.fetchWithCache();
    return data[provider]?.models || {};
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * 将 models.dev 响应转换为价格数据数组
   */
  convertToPrices(data: ModelsDevResponse): Array<{
    modelName: string;
    provider: string;
    inputPrice: number;
    outputPrice: number;
    cacheReadPrice: number;
    cacheWritePrice: number;
  }> {
    const prices: Array<{
      modelName: string;
      provider: string;
      inputPrice: number;
      outputPrice: number;
      cacheReadPrice: number;
      cacheWritePrice: number;
    }> = [];

    for (const [provider, providerData] of Object.entries(data)) {
      for (const [modelName, modelData] of Object.entries(providerData.models)) {
        // 跳过没有价格信息的模型
        if (!modelData?.cost) {
          continue;
        }

        prices.push({
          modelName: modelName.toLowerCase(),
          provider,
          inputPrice: (modelData.cost.input || 0) / 1000, // 转换为美元/1K tokens
          outputPrice: (modelData.cost.output || 0) / 1000,
          cacheReadPrice: (modelData.cost.cache_read || 0) / 1000,
          cacheWritePrice: (modelData.cost.cache_write || 0) / 1000,
        });
      }
    }

    return prices;
  }

  /**
   * 将 models.dev 响应转换为模型列表数据数组
   */
  convertToModelLists(data: ModelsDevResponse): Array<{
    modelName: string;
    provider: string;
    protocol: string;
  }> {
    const lists: Array<{
      modelName: string;
      provider: string;
      protocol: string;
    }> = [];

    const providerProtocolMap: Record<string, string> = {
      openai: 'openai-chat',
      anthropic: 'anthropic',
      google: 'gemini',
    };

    for (const [provider, providerData] of Object.entries(data)) {
      // 跳过没有 models 字段的供应商
      if (!providerData?.models) {
        continue;
      }

      const protocol = providerProtocolMap[provider] || provider;
      for (const modelName of Object.keys(providerData.models)) {
        lists.push({
          modelName: modelName.toLowerCase(),
          provider,
          protocol,
        });
      }
    }

    return lists;
  }
}
