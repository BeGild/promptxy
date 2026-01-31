import type { GatewayContext, GatewayError } from "../context.js";
import type { Supplier } from "../../types.js";

export type ExecuteUpstreamInput = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal: AbortSignal;
  supplier: Supplier;
};

export type ExecuteUpstreamDeps = {
  executeUpstream: (input: ExecuteUpstreamInput) => Promise<Response>;
};

export function createExecuteUpstream(deps: ExecuteUpstreamDeps) {
  return async function executeUpstreamStep(ctx: GatewayContext): Promise<GatewayContext> {
    const routePlan = ctx.routePlan;

    if (!routePlan || !routePlan.supplier) {
      throw new (await import("../context.js")).GatewayError({
        category: "routing",
        status: 500,
        code: "SUPPLIER_NOT_FOUND",
        message: "No supplier resolved for request",
      });
    }

    // 由 gateway.ts 设置 upstreamUrl 和上游 headers
    if (!ctx.upstreamUrl) {
      throw new (await import("../context.js")).GatewayError({
        category: "routing",
        status: 500,
        code: "UPSTREAM_URL_NOT_SET",
        message: "Upstream URL not set",
      });
    }

    return ctx;
  };
}
