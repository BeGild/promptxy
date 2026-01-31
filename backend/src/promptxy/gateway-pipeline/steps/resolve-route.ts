import type { GatewayContext } from "../context.js";
import type { PromptxyConfig, Route, Supplier } from "../../types.js";
import type { RequestContext, RoutePlan } from "../../gateway-contracts.js";

export type ResolveRouteDeps = {
  deriveRoutePlan: (ctx: RequestContext, deps: { routes: Route[]; suppliers: Supplier[] }) => RoutePlan;
  config: PromptxyConfig;
};

export function createResolveRoute(deps: ResolveRouteDeps) {
  return async function resolveRoute(ctx: GatewayContext): Promise<GatewayContext> {
    const url = ctx.url || new URL(ctx.req.url || "/", "http://localhost");
    const jsonBody = ctx.jsonBody;

    const routingCtx: RequestContext = {
      path: url.pathname,
      headers: ctx.req.headers as any,
      bodySummary:
        jsonBody && typeof jsonBody === "object"
          ? {
              model: (jsonBody as any).model as string | undefined,
              stream: Boolean((jsonBody as any).stream),
            }
          : undefined,
    };

    const routePlan = deps.deriveRoutePlan(routingCtx, {
      routes: deps.config.routes,
      suppliers: deps.config.suppliers,
    });

    ctx.routePlan = routePlan;
    return ctx;
  };
}
