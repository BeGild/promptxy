/**
 * Tool Name 缩短/恢复工具
 *
 * 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:265-336
 *
 * 问题：某些上游 (如 OpenAI/Codex) 对 tool name 有 64 字符限制
 * 解决：智能缩短长名称，特别是 mcp__ 前缀的工具
 */

const LIMIT = 64;

/**
 * 单个名称的缩短候选（基础逻辑，不保证唯一性）
 */
function baseCandidate(name: string): string {
  if (name.length <= LIMIT) {
    return name;
  }

  // 处理 mcp__ 前缀的特殊逻辑
  // 格式：mcp__server_name__tool_name
  // 策略：保留 mcp__ 和最后的 tool_name 部分
  if (name.startsWith('mcp__')) {
    const lastDoubleUnderscoreIdx = name.lastIndexOf('__');
    if (lastDoubleUnderscoreIdx > 5) {
      // 必须在 mcp__ 之后
      const toolPart = name.substring(lastDoubleUnderscoreIdx + 2);
      const candidate = 'mcp__' + toolPart;
      if (candidate.length > LIMIT) {
        return candidate.substring(0, LIMIT);
      }
      return candidate;
    }
  }

  // 默认：直接截断
  return name.substring(0, LIMIT);
}

/**
 * 确保候选名称在已使用名称中唯一
 */
function makeUnique(candidate: string, used: Set<string>): string {
  if (!used.has(candidate)) {
    return candidate;
  }

  const base = candidate;
  let suffix = 1;
  while (true) {
    const suffixStr = '_' + suffix.toString();
    const allowed = LIMIT - suffixStr.length;
    if (allowed < 0) {
      // 即使无法添加后缀，也要返回一个值
      return candidate.substring(0, LIMIT);
    }
    const truncated = base.length > allowed ? base.substring(0, allowed) : base;
    const uniqueCandidate = truncated + suffixStr;
    if (!used.has(uniqueCandidate)) {
      return uniqueCandidate;
    }
    suffix++;
    if (suffix > 1000) {
      // 防止无限循环
      return uniqueCandidate;
    }
  }
}

/**
 * 短名称映射类型
 */
export type ShortNameMap = Record<string, string>;

/**
 * 为一组名称构建短名称映射
 *
 * @param names - 原始名称列表
 * @returns 映射表，original -> short
 */
export function buildShortNameMap(names: string[]): ShortNameMap {
  const used = new Set<string>();
  const result: ShortNameMap = {};

  for (const name of names) {
    const candidate = baseCandidate(name);
    const unique = makeUnique(candidate, used);
    used.add(unique);
    result[name] = unique;
  }

  return result;
}

/**
 * 对单个名称应用缩短规则（不处理唯一性）
 *
 * 注意：这个函数不保证唯一性，只用于单一名称的快速缩短
 * 对于需要唯一性的场景，请使用 buildShortNameMap
 */
export function shortenNameIfNeeded(name: string): string {
  if (name.length <= LIMIT) {
    return name;
  }

  // 处理 mcp__ 前缀
  if (name.startsWith('mcp__')) {
    const lastDoubleUnderscoreIdx = name.lastIndexOf('__');
    if (lastDoubleUnderscoreIdx > 5) {
      const toolPart = name.substring(lastDoubleUnderscoreIdx + 2);
      const candidate = 'mcp__' + toolPart;
      if (candidate.length > LIMIT) {
        return candidate.substring(0, LIMIT);
      }
      return candidate;
    }
  }

  return name.substring(0, LIMIT);
}
