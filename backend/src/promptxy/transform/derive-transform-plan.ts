import type { RoutePlan } from "../gateway-contracts.js";
import type { TransformerType } from "../types.js";

export type TransformPlan = {
  transformer: TransformerType;
};

export function deriveTransformPlan(routePlan: RoutePlan): TransformPlan {
  const transformer = String(routePlan.transformer || 'none');

  const normalized: TransformerType = (
    transformer === 'anthropic' ||
    transformer === 'openai' ||
    transformer === 'codex' ||
    transformer === 'openai-chat' ||
    transformer === 'gemini' ||
    transformer === 'none'
      ? transformer
      : 'none'
  ) as TransformerType;

  return {
    transformer: normalized,
  };
}
