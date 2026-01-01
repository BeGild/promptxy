/**
 * Token 计算工具
 * 使用 js-tiktoken 计算文本的 token 数量（纯 JS 实现，无需 WASM）
 */

import { getEncoding } from 'js-tiktoken';
import type { PromptxyClient } from '@/types';

// Encoder 缓存（避免重复创建）
let encoderCache: ReturnType<typeof getEncoding> | null = null;

/**
 * 获取编码器（使用 cl100k_base，适用于 GPT-4, Claude 等）
 */
function getEncoder(): ReturnType<typeof getEncoding> {
  if (encoderCache) {
    return encoderCache;
  }

  // cl100k_base 适用于 GPT-4, Claude-3, Gemini 等主流模型
  encoderCache = getEncoding('cl100k_base');
  return encoderCache;
}

/**
 * 计算文本的 token 数量
 * @param text - 要计算的文本
 * @param _client - 客户端类型（暂时未使用，所有客户端都用同一编码）
 * @returns token 数量
 */
export function countTokens(text: string, _client: PromptxyClient): number {
  if (!text || text.length === 0) return 0;

  try {
    const encoder = getEncoder();
    return encoder.encode(text).length;
  } catch {
    // 降级：粗略估算 (1 token ≈ 3 chars)
    return Math.ceil(text.length / 3);
  }
}

/**
 * 格式化 token 显示
 * @example "≈1,234 tokens"
 */
export function formatTokenCount(count: number): string {
  return `≈${count.toLocaleString('en-US')} tokens`;
}
