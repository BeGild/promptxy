import type { RequestContext, RoutePlan } from "../gateway-contracts.js";
import type { Route, Supplier, TransformerType } from "../types.js";
import { resolveModelMapping } from "../model-mapping.js";

export function deriveRoutePlan(
  ctx: RequestContext,
  deps: {
    routes: Route[];
    suppliers: Supplier[];
  },
): RoutePlan {
  const route = (deps.routes || []).find(r => r.enabled && ctx.path.startsWith(`/${r.localService}`));
  if (!route) {
    return {
      localService: "claude",
      supplier: "",
      supplierProtocol: "",
      targetModel: "",
      transformer: "none",
    };
  }

  const inboundModel = ctx.bodySummary?.model;

  if (route.localService === "codex" || route.localService === "gemini") {
    const supplier = (deps.suppliers || []).find(s => s.id === route.singleSupplierId);
    return {
      localService: route.localService,
      supplier: supplier?.id || "",
      supplierProtocol: supplier?.protocol || "",
      targetModel: inboundModel ?? "",
      transformer: "none",
    };
  }

  const mapping = resolveModelMapping(inboundModel, route.modelMappings);
  const supplierId = mapping.matched ? mapping.targetSupplierId : "";
  const supplier = (deps.suppliers || []).find(s => s.id === supplierId);

  const transformer: TransformerType = mapping.matched
    ? (mapping.transformer ??
        (supplier?.protocol === 'openai-codex'
          ? 'codex'
          : supplier?.protocol === 'openai-chat'
            ? 'openai-chat'
            : supplier?.protocol === 'gemini'
              ? 'gemini'
              : 'none'))
    : 'none';

  return {
    localService: route.localService,
    supplier: supplier?.id || "",
    supplierProtocol: supplier?.protocol || "",
    targetModel: (mapping.matched ? mapping.outboundModel ?? inboundModel : inboundModel) ?? "",
    transformer,
  };
}
