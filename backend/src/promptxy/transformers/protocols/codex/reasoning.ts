/**
 * Reasoning/Effort 映射工具
 */

function modelUsesThinkingLevels(model: string): boolean {
  return /o[13]-/.test(model) || model.includes('o1') || model.includes('o3');
}

export function thinkingBudgetToEffort(
  model: string,
  budgetTokens: number,
): string | undefined {
  if (!modelUsesThinkingLevels(model)) {
    return undefined;
  }

  if (model.includes('o1')) {
    if (budgetTokens >= 20000) return 'high';
    if (budgetTokens >= 5000) return 'medium';
    return 'low';
  }

  if (model.includes('o3')) {
    if (budgetTokens >= 20000) return 'high';
    if (budgetTokens >= 5000) return 'medium';
    return 'low';
  }

  return undefined;
}

export function extractReasoningEffort(
  model: string,
  thinkingConfig: { type: string; budget_tokens?: number } | undefined,
): string {
  const defaultEffort = 'medium';

  if (!thinkingConfig) {
    return defaultEffort;
  }

  if (thinkingConfig.type === 'disabled') {
    const result = thinkingBudgetToEffort(model, 0);
    return result || defaultEffort;
  }

  if (thinkingConfig.type === 'enabled' && thinkingConfig.budget_tokens !== undefined) {
    const result = thinkingBudgetToEffort(model, thinkingConfig.budget_tokens);
    return result || defaultEffort;
  }

  return defaultEffort;
}