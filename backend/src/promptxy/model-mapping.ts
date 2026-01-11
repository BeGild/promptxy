import type { ModelMapping, ModelMappingRule } from './types.js';

/**
 * 将通配符模式转换为正则表达式
 * 支持 * 匹配任意字符（0个或多个）
 */
function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
    .replace(/\*/g, '.*'); // * → .*
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * 匹配模型名称（通配符模式）
 */
function matchModel(model: string, rule: ModelMappingRule): boolean {
  return wildcardToRegex(rule.pattern).test(model);
}

/**
 * 解析模型映射结果
 */
export type ModelMappingResult =
  | { mapped: true; target: string; rule: ModelMappingRule }
  | { mapped: false };

/**
 * 解析模型映射
 * @param inboundModel 入站模型名称
 * @param config 模型映射配置
 * @returns 映射结果；mapped=false 表示原样透传
 */
export function resolveModelMapping(
  inboundModel: string | undefined,
  config: ModelMapping | undefined,
): ModelMappingResult {
  // 无配置或未启用：不映射（透传）
  if (!config || !config.enabled) {
    return { mapped: false };
  }

  // 无入站模型：不映射（透传）
  if (!inboundModel) {
    return { mapped: false };
  }

  // 按顺序匹配规则
  for (const rule of config.rules) {
    if (matchModel(inboundModel, rule)) {
      return { mapped: true, target: rule.target, rule };
    }
  }

  // 未命中任何规则：不映射（原样透传）
  return { mapped: false };
}

// ============================================================================
// OpenAI reasoning effort 解析（保留原有功能）
// ============================================================================

export const DEFAULT_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;

function normalizeEffort(effort: string): string {
  return effort.trim().toLowerCase().replace(/[_-]/g, '');
}

export function parseOpenAIModelSpec(
  modelSpec: unknown,
  reasoningEfforts?: string[],
): { model: string; reasoningEffort?: string } | null {
  if (typeof modelSpec !== 'string') return null;
  const spec = modelSpec.trim();
  if (!spec) return null;

  const dash = spec.lastIndexOf('-');
  if (dash <= 0 || dash === spec.length - 1) {
    return { model: spec };
  }

  const base = spec.slice(0, dash);
  const suffix = spec.slice(dash + 1);

  const allowed = (reasoningEfforts && reasoningEfforts.length ? reasoningEfforts : Array.from(DEFAULT_REASONING_EFFORTS))
    .filter(e => typeof e === 'string' && e.trim())
    .map(normalizeEffort);

  const allowedSet = new Set(allowed);
  const normalizedSuffix = normalizeEffort(suffix);
  if (allowedSet.has(normalizedSuffix)) {
    return { model: base, reasoningEffort: normalizedSuffix };
  }

  // 兼容诸如 "x-high" 这类由两个 segment 组成的 effort（例如 xhigh）
  const dash2 = base.lastIndexOf('-');
  if (dash2 > 0) {
    const base2 = spec.slice(0, dash2);
    const suffix2 = spec.slice(dash2 + 1); // 形如 "x-high"
    const normalizedSuffix2 = normalizeEffort(suffix2);
    if (allowedSet.has(normalizedSuffix2)) {
      return { model: base2, reasoningEffort: normalizedSuffix2 };
    }
  }

  return { model: spec };
}
