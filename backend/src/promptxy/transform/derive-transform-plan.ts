import type { RoutePlan } from "../gateway-contracts";
import type { TransformerType } from "../types";

export type TransformPlan = {
  transformer: TransformerType;
};

export function deriveTransformPlan(routePlan: RoutePlan): TransformPlan {
  return {
    transformer: (routePlan.transformer || "none") as TransformerType,
  };
}
