import type { RoutePlan } from "../gateway-contracts.js";
import type { TransformerType } from "../types.js";

export type TransformPlan = {
  transformer: TransformerType;
};

export function deriveTransformPlan(routePlan: RoutePlan): TransformPlan {
  return {
    transformer: (routePlan.transformer || "none") as TransformerType,
  };
}
