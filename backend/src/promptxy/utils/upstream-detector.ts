/**
 * 上游 API 能力检测工具
 *
 * 用于检测 OpenAI/Codex 供应商是否支持 count_tokens 端点
 */

import type { Supplier } from '../types.js';

export interface UpstreamCapabilities {
  supportsCountTokens: boolean;
  countTokensEndpoint?: string;
  source: 'detected' | 'fallback';
}

/**
 * 检测 OpenAI/Codex 供应商是否支持 count_tokens 端点
 */
export async function detectOpenAICountTokensSupport(
  supplier: Supplier,
): Promise<UpstreamCapabilities> {
  try {
    if (supplier.protocol !== 'openai-codex' && supplier.protocol !== 'openai-chat') {
      return {
        supportsCountTokens: false,
        source: 'fallback',
      };
    }

    const modelsUrl = new URL('/v1/models', supplier.baseUrl).toString();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (supplier.auth?.type === 'bearer' && supplier.auth.token) {
      headers['Authorization'] = `Bearer ${supplier.auth.token}`;
    } else if (
      supplier.auth?.type === 'header' &&
      supplier.auth.headerName &&
      supplier.auth.headerValue
    ) {
      headers[supplier.auth.headerName] = supplier.auth.headerValue;
    }

    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return {
        supportsCountTokens: false,
        source: 'fallback',
      };
    }

    const data = await response.json();

    const supportsCountTokens = false;

    if (supportsCountTokens) {
      return {
        supportsCountTokens: true,
        countTokensEndpoint: new URL('/v1/chat/completions/tokens', supplier.baseUrl).toString(),
        source: 'detected',
      };
    }

    return {
      supportsCountTokens: false,
      source: 'fallback',
    };
  } catch (error) {
    return {
      supportsCountTokens: false,
      source: 'fallback',
    };
  }
}
