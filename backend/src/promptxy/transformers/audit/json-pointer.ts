/**
 * JSON Pointer 工具
 *
 * 用于字段级审计的路径规范化与操作。
 * 遵循 RFC 6901: https://datatracker.ietf.org/doc/html/rfc6901
 */

/**
 * JSON Pointer 路径类型
 * 例如: "/messages/0/content/2/type"
 */
export type JsonPointer = string;

/**
 * 规范化 JSON Pointer 路径
 * 确保路径以 "/" 开头，并且正确转义特殊字符
 */
export function normalizeJsonPointer(path: string): JsonPointer {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path as JsonPointer;
}

/**
 * 拼接 JSON Pointer 路径
 */
export function joinJsonPointer(base: JsonPointer, segment: string | number): JsonPointer {
  const escaped = String(segment)
    .replace(/~/g, '~0')
    .replace(/\//g, '~1');
  return normalizeJsonPointer(`${base}/${escaped}`);
}

/**
 * 解析 JSON Pointer 路径为片段数组
 */
export function parseJsonPointer(pointer: JsonPointer): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid JSON Pointer: ${pointer}`);
  }
  return pointer
    .slice(1)
    .split('/')
    .map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/**
 * 使用 JSON Pointer 获取对象中的值
 */
export function getByJsonPointer(obj: unknown, pointer: JsonPointer): unknown {
  if (pointer === '') return obj;

  const segments = parseJsonPointer(pointer);
  let current: any = obj;

  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }

    // 处理数组索引
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[parseInt(segment, 10)];
    } else {
      current = current[segment];
    }
  }

  return current;
}

/**
 * 使用 JSON Pointer 设置对象中的值
 */
export function setByJsonPointer(obj: Record<string, any>, pointer: JsonPointer, value: any): void {
  const segments = parseJsonPointer(pointer);

  if (segments.length === 0) {
    Object.assign(obj, value);
    return;
  }

  let current: any = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];

    if (!(segment in current)) {
      // 下一段是数字，创建数组
      const nextSegment = segments[i + 1];
      current[segment] = /^\d+$/.test(nextSegment) ? [] : {};
    }
    current = current[segment];
  }

  current[segments[segments.length - 1]] = value;
}

/**
 * 收集对象中所有的 JSON Pointer 路径
 */
export function collectJsonPointers(obj: unknown, basePath: JsonPointer = ''): JsonPointer[] {
  const paths: JsonPointer[] = [];

  function traverse(value: any, path: string): void {
    if (value === null || typeof value !== 'object') {
      paths.push(normalizeJsonPointer(path));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        traverse(item, joinJsonPointer(path, index));
      });
    } else {
      for (const [key, val] of Object.entries(value)) {
        traverse(val, joinJsonPointer(path, key));
      }
    }
  }

  traverse(obj, basePath);
  return paths;
}
