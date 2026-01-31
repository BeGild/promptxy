import { describe, it, expect, vi } from 'vitest';
import { createTransformRequest } from '../../src/promptxy/gateway-pipeline/steps/transform-request';

describe('transformRequest', () => {
  it('marks trace for claude cross-protocol request', async () => {
    const mockDeriveTransformPlan = vi.fn().mockReturnValue({
      transformer: 'openai-chat',
    });

    const transformRequest = createTransformRequest({
      deriveTransformPlan: mockDeriveTransformPlan,
      config: {} as any,
    });

    const ctx: any = {
      req: { url: '/claude/v1/messages' },
      jsonBody: { model: 'claude-sonnet' },
      routePlan: {
        localService: 'claude',
        supplierProtocol: 'openai-chat',
        transformer: 'openai-chat',
      },
      startTime: Date.now(),
    };

    const result = await transformRequest(ctx);

    expect(mockDeriveTransformPlan).toHaveBeenCalled();
    expect(result.jsonBody).toEqual({ model: 'claude-sonnet' });
    expect(result.transformTrace).toEqual({ transformed: true, transformer: 'openai-chat' });
  });

  it('skips transformation for codex routes', async () => {
    const mockDeriveTransformPlan = vi.fn();

    const transformRequest = createTransformRequest({
      deriveTransformPlan: mockDeriveTransformPlan,
      config: {} as any,
    });

    const ctx: any = {
      req: { url: '/codex/v1/responses' },
      jsonBody: { model: 'gpt-4' },
      routePlan: {
        localService: 'codex',
        supplierProtocol: 'openai-codex',
        transformer: 'none',
      },
      startTime: Date.now(),
    };

    const result = await transformRequest(ctx);

    expect(mockDeriveTransformPlan).not.toHaveBeenCalled();
    expect(result.jsonBody).toEqual({ model: 'gpt-4' });
  });

  it('skips transformation when transformer is none', async () => {
    const mockDeriveTransformPlan = vi.fn().mockReturnValue({
      transformer: 'none',
    });

    const transformRequest = createTransformRequest({
      deriveTransformPlan: mockDeriveTransformPlan,
      config: {} as any,
    });

    const ctx: any = {
      req: { url: '/claude/v1/messages' },
      jsonBody: { model: 'claude-sonnet' },
      routePlan: {
        localService: 'claude',
        supplierProtocol: 'openai-chat',
        transformer: 'openai-chat',
      },
      startTime: Date.now(),
    };

    const result = await transformRequest(ctx);

    expect(result.jsonBody).toEqual({ model: 'claude-sonnet' });
    expect(result.transformTrace).toBeUndefined();
  });
});
