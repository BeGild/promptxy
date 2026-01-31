import type { GatewayContext } from "../context";
import type { PromptxyConfig, RoutePlan } from "../../types";
import { deriveTransformPlan } from "../../transform/index.js";
import { createProtocolTransformer } from "../../transformers/index.js";

export type TransformRequestDeps = {
  deriveTransformPlan: typeof deriveTransformPlan;
  createProtocolTransformer: typeof createProtocolTransformer;
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

    const transformPlan = deps.deriveTransformPlan(
      {
        localService: routePlan.localService,
        supplierProtocol: routePlan.supplierProtocol,
        transformer: routePlan.transformer,
      },
      deps.config
    );

    if (!transformPlan.shouldTransform) {
      return ctx;
    }

    // 创建转换器并转换请求体
    const transformer = deps.createProtocolTransformer(transformPlan.transformer);
    if (transformer?.transformRequest) {
      ctx.jsonBody = transformer.transformRequest(jsonBody);
      ctx.transformTrace = { transformed: true, transformer: transformPlan.transformer };
    }

    return ctx;
  };
}
