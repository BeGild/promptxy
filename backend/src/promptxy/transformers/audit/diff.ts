/**
 * Diff 生成工具
 *
 * 用于生成字段级差异报告
 */

import type { JsonPointer } from './json-pointer.js';
import type { FieldDiff } from './field-audit.js';
import { collectJsonPointers, getByJsonPointer } from './json-pointer.js';

/**
 * 生成两个对象之间的 diff（简化版，类似 JSON Patch）
 */
export function generateDiff(
  source: unknown,
  target: unknown,
  basePath: JsonPointer = '',
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  const sourcePaths = new Set(collectJsonPointers(source, basePath));
  const targetPaths = new Set(collectJsonPointers(target, basePath));

  // 找出被删除的字段（在 source 但不在 target）
  for (const path of sourcePaths) {
    if (!targetPaths.has(path)) {
      diffs.push({
        op: 'remove',
        path,
        valuePreview: getByJsonPointer(source, path),
      });
    }
  }

  // 找出新增和修改的字段
  for (const path of targetPaths) {
    const sourceValue = getByJsonPointer(source, path);
    const targetValue = getByJsonPointer(target, path);

    if (!sourcePaths.has(path)) {
      diffs.push({
        op: 'add',
        path,
        valuePreview: targetValue,
      });
    } else if (!deepEqual(sourceValue, targetValue)) {
      diffs.push({
        op: 'replace',
        path,
        oldValue: sourceValue,
        valuePreview: targetValue,
      });
    }
  }

  return diffs;
}

/**
 * 深度比较两个值是否相等
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!bKeys.includes(key)) return false;
    if (!deepEqual((a as any)[key], (b as any)[key])) return false;
  }

  return true;
}

/**
 * 计算未映射的源路径
 */
export function computeUnmappedPaths(
  sourcePaths: JsonPointer[],
  mappedPaths: JsonPointer[],
): JsonPointer[] {
  const mappedSet = new Set(mappedPaths);
  return sourcePaths.filter(p => !mappedSet.has(p));
}

/**
 * 计算额外的目标路径
 */
export function computeExtraPaths(
  targetPaths: JsonPointer[],
  requiredPaths: JsonPointer[],
): JsonPointer[] {
  const requiredSet = new Set(requiredPaths);
  return targetPaths.filter(p => !requiredSet.has(p));
}
