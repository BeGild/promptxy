import { describe, it, expectTypeOf } from "vitest";
import type { RequestContext, RoutePlan } from "../../src/promptxy/gateway-contracts";

describe("gateway contracts", () => {
  it("exports RequestContext and RoutePlan with stable shapes", () => {
    expectTypeOf<RequestContext>().toEqualTypeOf<{
      requestId?: string;
      sessionId?: string;
      path: string;
      headers: Record<string, string | string[] | undefined>;
      bodySummary?: {
        model?: string;
        stream?: boolean;
      };
    }>();

    expectTypeOf<RoutePlan>().toEqualTypeOf<{
      localService: string;
      supplier: string;
      supplierProtocol: string;
      targetModel: string;
      transformer?: string;
      flags?: {
        allowPassthrough?: boolean;
        forceStream?: boolean;
      };
    }>();
  });
});
