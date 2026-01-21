/**
 * Tool Name 反向查找工具
 *
 * 在响应转换器中，需要将上游返回的短名称恢复为原始名称
 *
 * 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go:308-330
 */

import type { ShortNameMap } from './tool-name.js';

/**
 * 反向映射类型：short -> original
 */
export type ReverseShortNameMap = Record<string, string>;

/**
 * 从短名称映射构建反向映射
 *
 * @param shortNameMap - original -> short 映射
 * @returns short -> original 映射
 */
export function buildReverseShortNameMap(shortNameMap: ShortNameMap): ReverseShortNameMap {
  const reverse: ReverseShortNameMap = {};

  for (const [original, short] of Object.entries(shortNameMap)) {
    reverse[short] = original;
  }

  return reverse;
}

/**
 * 从短名称恢复原始名称
 *
 * @param shortName - 短名称
 * @param reverseMap - 反向映射表
 * @returns 原始名称（如果找到），否则返回短名称
 */
export function restoreOriginalName(shortName: string, reverseMap: ReverseShortNameMap): string {
  return reverseMap[shortName] || shortName;
}
