import { describe, it, expect, vi } from 'vitest';
import { createAuthInbound } from '../../src/promptxy/gateway-pipeline/steps/auth-inbound';
import { GatewayError } from '../../src/promptxy/gateway-pipeline/context';

describe('authInbound', () => {
  it('returns ctx when auth is disabled', async () => {
    const mockAuthenticate = vi.fn();
    const mockClearAuthHeaders = vi.fn().mockReturnValue({});

    const authInbound = createAuthInbound({
      authenticateRequest: mockAuthenticate,
      clearAuthHeaders: mockClearAuthHeaders,
      config: { gatewayAuth: { enabled: false } } as any,
    });

    const ctx: any = {
      req: { headers: {} },
      res: {},
      startTime: Date.now(),
    };

    const result = await authInbound(ctx);

    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(result).toBe(ctx);
  });

  it('throws GatewayError when auth fails', async () => {
    const mockAuthenticate = vi.fn().mockReturnValue({
      authenticated: false,
      error: 'Invalid token',
    });
    const mockClearAuthHeaders = vi.fn();

    const authInbound = createAuthInbound({
      authenticateRequest: mockAuthenticate,
      clearAuthHeaders: mockClearAuthHeaders,
      config: { gatewayAuth: { enabled: true } } as any,
    });

    const ctx: any = {
      req: { headers: { authorization: 'Bearer invalid' } },
      res: {},
      startTime: Date.now(),
    };

    await expect(authInbound(ctx)).rejects.toThrow(GatewayError);
    await expect(authInbound(ctx)).rejects.toMatchObject({
      category: 'auth',
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('returns ctx when auth succeeds', async () => {
    const mockAuthenticate = vi.fn().mockReturnValue({
      authenticated: true,
      authHeaderUsed: 'authorization',
    });
    const mockClearAuthHeaders = vi.fn().mockReturnValue({ 'content-type': 'application/json' });

    const authInbound = createAuthInbound({
      authenticateRequest: mockAuthenticate,
      clearAuthHeaders: mockClearAuthHeaders,
      config: { gatewayAuth: { enabled: true } } as any,
    });

    const ctx: any = {
      req: { headers: { authorization: 'Bearer valid' } },
      res: {},
      startTime: Date.now(),
    };

    const result = await authInbound(ctx);

    expect(mockAuthenticate).toHaveBeenCalledWith(ctx.req.headers, { enabled: true });
    expect(result).toBe(ctx);
  });
});
