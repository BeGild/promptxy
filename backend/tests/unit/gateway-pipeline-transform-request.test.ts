import { describe, it, expect, vi } from 'vitest';
import { createTransformRequest } from '../../src/promptxy/gateway-pipeline/steps/transform-request';

describe('transformRequest', () => {
  it('transforms claude request when cross-protocol', async () => {
    const mockDeriveTransformPlan = vi.fn().mockReturnValue({
      shouldTransform: true,
      transformer: 'openai-chat',
    });
    const mockTransformRequest = vi.fn().mockReturnValue({ transformed: true });
    const mockCreateTransformer = vi.fn().mockReturnValue({
      transformRequest: mockTransformRequest,
    });

    const transformRequest = createTransformRequest({
      deriveTransformPlan: mockDeriveTransformPlan,
      createProtocolTransformer: mockCreateTransformer,
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
    expect(mockCreateTransformer).toHaveBeenCalledWith('openai-chat');
    expect(mockTransformRequest).toHaveBeenCalledWith({ model: 'claude-sonnet' });
    expect(result.jsonBody).toEqual({ transformed: true });
    expect(result.transformTrace).toEqual({ transformed: true, transformer: 'openai-chat' });
  });

  it('skips transformation for codex routes', async () => {
    const mockDeriveTransformPlan = vi.fn();
    const mockCreateTransformer = vi.fn();

    const transformRequest = createTransformRequest({
      deriveTransformPlan: mockDeriveTransformPlan,
      createProtocolTransformer: mockCreateTransformer,
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

  it('skips transformation when shouldTransform is false', async () => {
    const mockDeriveTransformPlan = vi.fn().mockReturnValue({
      shouldTransform: false,
    });
    const mockCreateTransformer = vi.fn();

    const transformRequest = createTransformRequest({
      deriveTransformPlan: mockDeriveTransformPlan,
      createProtocolTransformer: mockCreateTransformer,
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

    expect(mockCreateTransformer).not.toHaveBeenCalled();
    expect(result.jsonBody).toEqual({ model: 'claude-sonnet' });
  });
});
