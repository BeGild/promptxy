/**
 * 结构分析器
 * 分析记录结构，支持路径查询和差异对比
 */

import type { FieldStructure, FieldType } from './types.js';

const MAX_STRING_PREVIEW = 100;

export function getFieldType(value: unknown): FieldType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value as FieldType;
}

function truncateString(str: string, maxLength = MAX_STRING_PREVIEW): string {
  if (str.length < maxLength) return str;
  // 为后缀预留空间，确保总长度严格小于 maxLength
  const suffix = `...(${str.length} chars)`;
  const availableLength = maxLength - suffix.length - 1;
  if (availableLength <= 0) {
    return str.substring(0, maxLength - 1);
  }
  return str.substring(0, availableLength) + suffix;
}

export function analyzeStructure(value: unknown, depth = 0): FieldStructure {
  const type = getFieldType(value);

  if (type === 'string') {
    return { type, value: truncateString(value as string) };
  }
  if (type === 'number' || type === 'boolean' || type === 'null') {
    return { type, value };
  }
  if (type === 'undefined') {
    return { type };
  }

  if (type === 'array') {
    const arr = value as unknown[];
    const result: FieldStructure = {
      type,
      length: arr.length,
      hasItems: arr.length > 0
    };

    if (arr.length > 0 && depth < 2) {
      result.itemStructure = analyzeStructure(arr[0], depth + 1);
    } else if (arr.length > 0) {
      result.itemStructure = '/* complex */';
    }

    return result;
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const fields: Record<string, FieldStructure> = {};

    for (const [key, val] of Object.entries(obj)) {
      fields[key] = analyzeStructure(val, depth + 1);
    }

    return { type, fields };
  }

  return { type };
}

export function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  const parts: (string | number)[] = [];
  const regex = /([^[\].]+)|\[(\d+)\]/g;
  let match;

  while ((match = regex.exec(path)) !== null) {
    if (match[1]) {
      parts.push(match[1]);
    } else if (match[2]) {
      parts.push(parseInt(match[2], 10));
    }
  }

  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof part === 'number') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[part];
    } else {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

export function compareStructures(
  obj1: unknown,
  obj2: unknown,
  path: string,
  result: {
    addedFields: string[];
    removedFields: string[];
    typeChanges: Record<string, { from: FieldType; to: FieldType }>;
    arrayLengthChanges: Record<string, { from: number; to: number }>;
  } = { addedFields: [], removedFields: [], typeChanges: {}, arrayLengthChanges: {} }
): typeof result {
  const type1 = getFieldType(obj1);
  const type2 = getFieldType(obj2);

  if (type1 !== type2) {
    result.typeChanges[path] = { from: type1, to: type2 };
    return result;
  }

  if (type1 === 'array' && type2 === 'array') {
    const arr1 = obj1 as unknown[];
    const arr2 = obj2 as unknown[];
    if (arr1.length !== arr2.length) {
      result.arrayLengthChanges[path] = { from: arr1.length, to: arr2.length };
    }
  }

  if (type1 === 'object' && type2 === 'object') {
    const o1 = obj1 as Record<string, unknown>;
    const o2 = obj2 as Record<string, unknown>;

    const keys1 = Object.keys(o1);
    const keys2 = Object.keys(o2);

    for (const key of keys2) {
      if (!(key in o1)) {
        result.addedFields.push(path === 'root' ? key : `${path}.${key}`);
      }
    }

    for (const key of keys1) {
      if (!(key in o2)) {
        result.removedFields.push(path === 'root' ? key : `${path}.${key}`);
      }
    }

    for (const key of keys1) {
      if (key in o2) {
        compareStructures(o1[key], o2[key], path === 'root' ? key : `${path}.${key}`, result);
      }
    }
  }

  return result;
}
