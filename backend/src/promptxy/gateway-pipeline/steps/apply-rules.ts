import type { GatewayContext } from "../context.js";
import type { PromptxyConfig, PromptxyRule, PromptxyRuleMatch } from "../../types.js";

export type MutateResult = {
  body: any;
  matches: PromptxyRuleMatch[];
  warnings: string[];
};

export type ApplyRulesDeps = {
  mutateCodexBody: (input: {
    body: any;
    method: string;
    path: string;
    rules: PromptxyRule[];
  }) => MutateResult;
  mutateGeminiBody: (input: {
    body: any;
    method: string;
    path: string;
    rules: PromptxyRule[];
  }) => MutateResult;
  config: PromptxyConfig;
};

function shouldApplyRules(ctx: GatewayContext): boolean {
  const routePlan = ctx.routePlan;
  if (!routePlan) return false;

  // Claude 跨协议转换场景：避免在转换前应用规则（会在转换后统一应用）
  if (routePlan.localService === "claude" && routePlan.transformer !== "none") {
    return false;
  }

  return true;
}

export function createApplyRules(deps: ApplyRulesDeps) {
  return async function applyRules(ctx: GatewayContext): Promise<GatewayContext> {
    const jsonBody = ctx.jsonBody;
    if (!jsonBody || typeof jsonBody !== "object") {
      return ctx;
    }

    if (!shouldApplyRules(ctx)) {
      return ctx;
    }

    const routePlan = ctx.routePlan!;
    const url = ctx.url || new URL(ctx.req.url || "/", "http://localhost");
    const path = url.pathname;

    // 移除 localService 前缀
    const pathPrefix = `/${routePlan.localService}`;
    const strippedPath = path.startsWith(pathPrefix) ? path.slice(pathPrefix.length) : path;

    let result: MutateResult | undefined;

    if (routePlan.localService === "codex") {
      result = deps.mutateCodexBody({
        body: jsonBody,
        method: ctx.method || "POST",
        path: strippedPath,
        rules: deps.config.rules,
      });
    } else if (routePlan.localService === "gemini") {
      result = deps.mutateGeminiBody({
        body: jsonBody,
        method: ctx.method || "POST",
        path: strippedPath,
        rules: deps.config.rules,
      });
    }

    if (result) {
      ctx.jsonBody = result.body;
      ctx.matches = result.matches;
      ctx.warnings = [...(ctx.warnings || []), ...result.warnings];
    }

    return ctx;
  };
}
