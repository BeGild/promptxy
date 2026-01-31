import { describe, it, expect } from "vitest";

import type { RoutePlan } from "../../src/promptxy/gateway-contracts";

describe("transform plan", () => {
  it("fails until transform module is implemented", async () => {
    const module = await import("../../src/promptxy/transform");
    expect(module).toBeDefined();
  });

  it("derives transformer from route plan", async () => {
    const { deriveTransformPlan } = await import("../../src/promptxy/transform");

    const routePlan: RoutePlan = {
      localService: "claude",
      supplier: "openai-chat-up",
      supplierProtocol: "openai-chat",
      targetModel: "gpt-4o-mini",
      transformer: "openai-chat",
    };

    expect(deriveTransformPlan(routePlan)).toEqual({
      transformer: "openai-chat",
    });
  });
});
