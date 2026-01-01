/**
 * PromptXY 网关入站鉴权
 *
 * 提供：
 * - 验证客户端访问网关的权限
 * - 清理入站鉴权头（避免误传到上游）
 * - 记录使用的鉴权头名（用于观测）
 */

import type { GatewayAuth } from '../types.js';
import { createLogger } from '../logger.js';

const logger = createLogger({ debug: false });

/**
 * 鉴权结果
 */
export interface AuthResult {
  /** 是否通过鉴权 */
  authenticated: boolean;
  /** 使用的鉴权头名称（仅名称，不包含值） */
  authHeaderUsed?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 默认接受的鉴权头列表
 */
const DEFAULT_ACCEPTED_HEADERS = [
  'authorization',
  'x-api-key',
  'x-goog-api-key',
];

/**
 * 从请求头中提取并验证鉴权 token
 */
export function authenticateRequest(
  headers: Record<string, string | string[] | undefined>,
  gatewayAuth: GatewayAuth,
): AuthResult {
  // 未启用鉴权
  if (!gatewayAuth.enabled) {
    return { authenticated: true };
  }

  // 没有 token（配置错误，但已通过 config 验证）
  if (!gatewayAuth.token) {
    return {
      authenticated: true, // 配置已通过验证，直接放行
    };
  }

  // 确定要检查的 header 列表
  const acceptedHeaders =
    gatewayAuth.acceptedHeaders && gatewayAuth.acceptedHeaders.length > 0
      ? gatewayAuth.acceptedHeaders
      : DEFAULT_ACCEPTED_HEADERS;

  // 遍历 header 列表查找 token
  for (const headerName of acceptedHeaders) {
    const lowerHeaderName = headerName.toLowerCase();
    const headerValue = findHeaderValue(headers, lowerHeaderName);

    if (headerValue) {
      // 找到 header，验证 token
      if (validateToken(headerValue, gatewayAuth.token)) {
        if (logger.debugEnabled) {
          logger.debug(`[GatewayAuth] 鉴权通过，使用 header: ${headerName}`);
        }
        return {
          authenticated: true,
          authHeaderUsed: headerName,
        };
      }
    }
  }

  // 未找到有效的鉴权 header
  logger.debug(`[GatewayAuth] 鉴权失败：未找到有效的鉴权 header`);
  return {
    authenticated: false,
    error: 'Unauthorized: Missing or invalid authentication token',
  };
}

/**
 * 清理入站鉴权头（避免误传到上游）
 *
 * @param headers 原始请求头
 * @param authHeaderUsed 使用的鉴权头名称（来自 authenticateRequest）
 * @returns 清理后的请求头
 */
export function clearAuthHeaders(
  headers: Record<string, string | string[] | undefined>,
  authHeaderUsed?: string,
): Record<string, string> {
  const cleaned: Record<string, string> = {};

  // 需要清理的鉴权头列表
  const headersToClear = authHeaderUsed
    ? [authHeaderUsed]
    : DEFAULT_ACCEPTED_HEADERS;

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // 跳过鉴权相关头
    if (headersToClear.some(h => h.toLowerCase() === lowerKey)) {
      if (logger.debugEnabled) {
        logger.debug(`[GatewayAuth] 清理鉴权头: ${key}`);
      }
      continue;
    }

    // 保留其他头
    if (Array.isArray(value)) {
      cleaned[key] = value[0] || '';
    } else if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * 从请求头中查找指定 header 的值（不区分大小写）
 */
function findHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  headerName: string,
): string | undefined {
  const lowerHeaderName = headerName.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerHeaderName) {
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;
    }
  }

  return undefined;
}

/**
 * 验证 token 是否匹配
 */
function validateToken(
  headerValue: string,
  expectedToken: string,
): boolean {
  // 去除 Bearer 前缀（如果有）
  let actualToken = headerValue.trim();
  if (actualToken.toLowerCase().startsWith('bearer ')) {
    actualToken = actualToken.slice(7).trim();
  }

  return actualToken === expectedToken;
}

/**
 * 检测请求头中的鉴权头（用于诊断/观测）
 *
 * 注意：此函数仅返回 header 名称，不返回值
 * 用于运行 `cc_lo -p "<提示词>"` 时确认 Claude Code 使用的鉴权头名
 */
export function detectAuthHeaders(
  headers: Record<string, string | string[] | undefined>,
): string[] {
  const detected: string[] = [];

  for (const key of Object.keys(headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === 'authorization' ||
      lowerKey === 'x-api-key' ||
      lowerKey === 'x-goog-api-key'
    ) {
      detected.push(key);
    }
  }

  return detected;
}
