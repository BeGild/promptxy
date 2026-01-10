/**
 * 请求头脱敏工具
 */

// 需要脱敏的请求头名称模式
const SENSITIVE_HEADER_PATTERNS = [
  'authorization',
  'x-api-key',
  'api-key',
  'bearer',
  'token',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'x-csrf-token',
  'xsrf-token',
];

/**
 * 判断请求头是否敏感
 */
export function isSensitiveHeader(headerName: string): boolean {
  const lowerName = headerName.toLowerCase();
  return SENSITIVE_HEADER_PATTERNS.some((pattern) =>
    lowerName.includes(pattern)
  );
}

/**
 * 脱敏请求头值
 * 保留前 4 位和后 4 位，中间用 * 替代
 * 示例: sk-ant-xxxx-yyyy → sk-a***********yyy
 */
export function maskHeaderValue(value: string): string {
  if (!value || value.length <= 8) {
    return '****';
  }

  const prefix = value.slice(0, 4);
  const suffix = value.slice(-4);
  const maskedLength = Math.max(3, value.length - 8);
  return `${prefix}${'*'.repeat(maskedLength)}${suffix}`;
}

/**
 * 处理请求头对象，返回脱敏后的副本
 */
export function maskRequestHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const masked: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (isSensitiveHeader(key)) {
      masked[key] = maskHeaderValue(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * 格式化请求头为 JSON 字符串（带脱敏）
 */
export function formatHeadersAsJSON(
  headers: Record<string, string> | undefined
): string {
  if (!headers) {
    return '{}';
  }

  const masked = maskRequestHeaders(headers);
  return JSON.stringify(masked, null, 2);
}
