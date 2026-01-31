import type { GatewayContext } from "../context";

export type HandleResponseDeps = {
  // 由 gateway.ts 直接处理响应，此步骤作为 pipeline 的终点标记
  // 实际响应处理逻辑保留在 gateway.ts 以保持与现有流式/落库逻辑兼容
};

export function createHandleResponse(_deps: HandleResponseDeps) {
  return async function handleResponse(ctx: GatewayContext): Promise<GatewayContext> {
    // 此步骤作为 pipeline 的终点
    // 实际响应处理（SSE 转换、流式输出、落库）保留在 gateway.ts
    // 以避免高风险重构影响流式终止和落库逻辑
    return ctx;
  };
}
