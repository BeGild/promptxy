import { describe, it, expect } from "vitest";
import type { PromptxyConfig, TransformerType } from "../../src/promptxy/types";

describe("gateway routing compat", () => {
  it("fails until routing module is implemented", async () => {
    const module = await import("../../src/promptxy/routing");
    expect(module).toBeDefined();
  });

  it("derives stable route decisions for representative cases", async () => {
    const { deriveRoutePlan } = await import("../../src/promptxy/routing");

    const config: PromptxyConfig = {
      listen: { host: "127.0.0.1", port: 0 },
      suppliers: [
        {
          id: "codex-up",
          name: "codex-up",
          displayName: "codex-up",
          baseUrl: "http://127.0.0.1:1",
          protocol: "openai-codex",
          enabled: true,
          auth: { type: "none" },
          supportedModels: [],
        },
        {
          id: "openai-chat-up",
          name: "openai-chat-up",
          displayName: "openai-chat-up",
          baseUrl: "http://127.0.0.1:2",
          protocol: "openai-chat",
          enabled: true,
          auth: { type: "none" },
          supportedModels: [],
        },
      ],
      routes: [
        {
          id: "r-claude",
          localService: "claude",
          enabled: true,
          modelMappings: [
            {
              id: "mm-any-to-openai-chat",
              inboundModel: "*",
              targetSupplierId: "openai-chat-up",
              enabled: true,
            },
          ],
        },
        {
          id: "r-codex",
          localService: "codex",
          enabled: true,
          singleSupplierId: "codex-up",
        },
      ],
      rules: [],
      storage: { maxHistory: 1000 },
      debug: false,
    };

    const cases: Array<{
      name: string;
      pathname: string;
      body: any;
      expect: {
        localService: "claude" | "codex" | "gemini";
        supplierId: string;
        supplierProtocol: string;
        targetModel: string | undefined;
        transformer: TransformerType;
      };
    }> = [
      {
        name: "claude routes via model mapping to openai-chat",
        pathname: "/claude/v1/messages",
        body: { model: "claude-sonnet-4-20250514" },
        expect: {
          localService: "claude",
          supplierId: "openai-chat-up",
          supplierProtocol: "openai-chat",
          targetModel: "claude-sonnet-4-20250514",
          transformer: "openai-chat",
        },
      },
      {
        name: "codex routes to singleSupplierId with passthrough transformer",
        pathname: "/codex/v1/responses",
        body: { model: "gpt-4o-mini" },
        expect: {
          localService: "codex",
          supplierId: "codex-up",
          supplierProtocol: "openai-codex",
          targetModel: "gpt-4o-mini",
          transformer: "none",
        },
      },
    ];

    for (const c of cases) {
      const plan = deriveRoutePlan(
        {
          path: c.pathname,
          headers: {},
          bodySummary: {
            model: c.body?.model,
            stream: Boolean(c.body?.stream),
          },
        },
        { routes: config.routes, suppliers: config.suppliers },
      );

      expect(plan.localService, c.name).toBe(c.expect.localService);
      expect(plan.supplier, c.name).toBe(c.expect.supplierId);
      expect(plan.supplierProtocol, c.name).toBe(c.expect.supplierProtocol);
      expect(plan.targetModel, c.name).toBe(c.expect.targetModel);
      expect(plan.transformer, c.name).toBe(c.expect.transformer);
    }
  });
});
