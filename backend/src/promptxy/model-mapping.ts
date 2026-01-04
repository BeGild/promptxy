export type ClaudeModelTier = 'haiku' | 'sonnet' | 'opus';

export function detectClaudeModelTier(model: unknown): ClaudeModelTier {
  if (typeof model !== 'string') return 'sonnet';
  const lower = model.toLowerCase();
  // 优先级：opus > haiku > sonnet（识别不到默认 sonnet）
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('haiku')) return 'haiku';
  return 'sonnet';
}

export type ClaudeModelMap = {
  sonnet: string;
  haiku?: string;
  opus?: string;
};

export function resolveClaudeMappedModelSpec(
  claudeModelMap: unknown,
  tier: ClaudeModelTier,
): { ok: true; modelSpec: string } | { ok: false; error: string } {
  if (!claudeModelMap || typeof claudeModelMap !== 'object') {
    return { ok: false, error: 'Claude 路由跨协议转换时必须配置 claudeModelMap（至少 sonnet）' };
  }
  const map = claudeModelMap as Record<string, unknown>;
  const sonnet = map.sonnet;
  if (typeof sonnet !== 'string' || !sonnet.trim()) {
    return { ok: false, error: 'Claude 路由跨协议转换时必须配置 claudeModelMap.sonnet' };
  }

  const tierValue = map[tier];
  if (typeof tierValue === 'string' && tierValue.trim()) {
    return { ok: true, modelSpec: tierValue };
  }

  return { ok: true, modelSpec: sonnet };
}

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
