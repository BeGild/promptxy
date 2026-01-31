import { describe, it, expect, vi } from 'vitest';
import { createResolveRoute } from '../../src/promptxy/gateway-pipeline/steps/resolve-route';

describe('resolveRoute', () => {
  it('resolves route plan from ctx.jsonBody and req.url', async () => {
    const mockDeriveRoutePlan = vi.fn().mockReturnValue({
      localService: 'claude',
      supplier: 'openai-chat-up',
      supplierProtocol: 'openai-chat',
      targetModel: 'claude-sonnet-4-20250514',
      transformer: 'openai-chat',
    });

    const resolveRoute = createResolveRoute({
      deriveRoutePlan: mockDeriveRoutePlan,
      config: {
        routes: [{ id: 'r-claude', localService: 'claude' }],
        suppliers: [{ id: 'openai-chat-up', protocol: 'openai-chat' }],
      } as any,
    });

    const ctx: any = {
      req: { url: '/claude/v1/messages', headers: {} },
      jsonBody: { model: 'claude-sonnet-4-20250514', stream: true },
      startTime: Date.now(),
    };

    const result = await resolveRoute(ctx);

    expect(mockDeriveRoutePlan).toHaveBeenCalledWith(
      {
        path: '/claude/v1/messages',
        headers: {},
        bodySummary: {
          model: 'claude-sonnet-4-20250514',
          stream: true,
        },
      },
      { routes: [{ id: 'r-claude', localService: 'claude' }], suppliers: [{ id: 'openai-chat-up', protocol: 'openai-chat' }] }
    );
    expect(result.routePlan).toEqual({
      localService: 'claude',
      supplier: 'openai-chat-up',
      supplierProtocol: 'openai-chat',
      targetModel: 'claude-sonnet-4-20250514',
      transformer: 'openai-chat',
    });
  });

  it('handles missing jsonBody gracefully', async () => {
    const mockDeriveRoutePlan = vi.fn().mockReturnValue({
      localService: 'codex',
      supplier: 'codex-up',
      supplierProtocol: 'openai-codex',
      targetModel: '',
      transformer: 'none',
    });

    const resolveRoute = createResolveRoute({
      deriveRoutePlan: mockDeriveRoutePlan,
      config: { routes: [], suppliers: [] } as any,
    });

    const ctx: any = {
      req: { url: '/codex/v1/responses', headers: {} },
      startTime: Date.now(),
    };

    const result = await resolveRoute(ctx);

    expect(mockDeriveRoutePlan).toHaveBeenCalledWith(
      {
        path: '/codex/v1/responses',
        headers: {},
        bodySummary: undefined,
      },
      { routes: [], suppliers: [] }
    );
    expect(result.routePlan).toBeDefined();
  });
});
