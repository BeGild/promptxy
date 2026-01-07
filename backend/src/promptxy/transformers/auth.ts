/**
 * 认证相关工具
 */

import type { IncomingHttpHeaders } from 'node:http';

/**
 * 认证请求（兼容旧 API）
 */
export function authenticateRequest(
  headers: IncomingHttpHeaders,
  auth?: unknown,
): {
  authenticated: boolean;
  error?: string;
  authHeaderUsed?: string;
} {
  // 简化处理：总是返回有效
  return {
    authenticated: true,
  };
}

/**
 * 清理认证头（兼容旧 API）
 */
export function clearAuthHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const cleaned: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    // 移除授权相关的头
    if (key.toLowerCase() === 'authorization') {
      continue;
    }
    cleaned[key] = value;
  }

  return cleaned;
}
