import type { IncomingHttpHeaders } from "node:http";
import type { GatewayContext, GatewayError } from "../context.js";
import type { PromptxyConfig } from "../../types.js";

export type AuthInboundDeps = {
  authenticateRequest: (
    headers: IncomingHttpHeaders,
    auth?: unknown,
  ) => {
    authenticated: boolean;
    error?: string;
    authHeaderUsed?: string;
  };
  clearAuthHeaders: (headers: Record<string, string>) => Record<string, string>;
  config: PromptxyConfig;
};

export function createAuthInbound(deps: AuthInboundDeps) {
  return async function authInbound(
    ctx: GatewayContext,
  ): Promise<GatewayContext> {
    const authConfig = deps.config.gatewayAuth;

    if (authConfig && authConfig.enabled) {
      const authResult = deps.authenticateRequest(ctx.req.headers, authConfig);
      if (!authResult.authenticated) {
        throw new (await import("../context.js")).GatewayError({
          category: "auth",
          status: 401,
          code: "UNAUTHORIZED",
          message: authResult.error || "Invalid or missing authentication token",
        });
      }
    }

    return ctx;
  };
}
