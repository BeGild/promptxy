import type { ModelMappingRule, TransformerType } from './types.js';

/**
 * 将通配符模式转换为正则表达式
 * 支持 * 匹配任意字符（0个或多个）
 * 使用非贪婪匹配以支持多个 * 模式
 */
function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
    .replace(/\*/g, '.*?'); // * → .*?（非贪婪匹配）
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * 匹配模型名称（通配符模式）
 */
function matchModel(model: string, inboundModel: string): boolean {
  return wildcardToRegex(inboundModel).test(model);
}

/**
 * 解析模型映射结果
 */
export type ModelMappingResult =
  | {
      matched: true;
      targetSupplierId: string;
      outboundModel?: string;
      transformer?: TransformerType;
      rule: ModelMappingRule;
    }
  | { matched: false };

/**
 * 解析模型映射
 * @param inboundModel 入站模型名称
 * @param rules 模型映射规则数组
 * @returns 映射结果；matched=false 表示未匹配任何规则
 */
export function resolveModelMapping(
  inboundModel: string | undefined,
  rules: ModelMappingRule[] | undefined,
): ModelMappingResult {
  // 无规则或无入站模型：不匹配
  if (!rules || rules.length === 0 || !inboundModel) {
    return { matched: false };
  }

  // 按顺序匹配规则
  for (const rule of rules) {
    // 跳过未启用的规则
    if (rule.enabled === false) continue;

    if (matchModel(inboundModel, rule.inboundModel)) {
      return {
        matched: true,
        targetSupplierId: rule.targetSupplierId,
        outboundModel: rule.outboundModel,
        transformer: rule.transformer,
        rule,
      };
    }
  }

  // 未命中任何规则
  return { matched: false };
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
