import { describe, it, expect } from 'vitest';
import type { GatewayContext, GatewayError } from '../../src/promptxy/gateway-pipeline/context';

describe('gateway pipeline context', () => {
  it('exports GatewayContext/GatewayError types', () => {
    const x: GatewayContext | GatewayError | null = null;
    expect(x).toBe(null);
  });
});
