import type { GatewayContext } from "../context.js";
import type { PromptxyConfig, TransformerType } from "../../types.js";
import type { RoutePlan } from "../../gateway-contracts.js";
import type { TransformPlan } from "../../transform/derive-transform-plan.js";

export type TransformRequestDeps = {
  deriveTransformPlan: (routePlan: RoutePlan) => TransformPlan;
  config: PromptxyConfig;
};

export function createTransformRequest(deps: TransformRequestDeps) {
  return async function transformRequest(ctx: GatewayContext): Promise<GatewayContext> {
    const routePlan = ctx.routePlan;
    const jsonBody = ctx.jsonBody;

    if (!routePlan || !jsonBody || typeof jsonBody !== "object") {
      return ctx;
    }

    // 仅对 Claude 跨协议转换进行处理
    if (routePlan.localService !== "claude" || routePlan.transformer === "none") {
      return ctx;
    }

    const transformPlan = deps.deriveTransformPlan(routePlan);

    if (transformPlan.transformer === "none") {
      return ctx;
    }

    // 转换逻辑由 gateway.ts 直接处理，此步骤仅做标记
    // 实际请求体转换保留在 gateway.ts 以保持与现有逻辑兼容
    ctx.transformTrace = {
      transformed: true,
      transformer: transformPlan.transformer
    };

    return ctx;
  };
}
