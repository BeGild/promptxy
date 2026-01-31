import { describe, it, expect } from 'vitest';
import { runPipeline } from '../../src/promptxy/gateway-pipeline/pipeline';

describe('gateway pipeline', () => {
  it('runs steps in order', async () => {
    const calls: string[] = [];
    const ctx: any = { startTime: Date.now() };

    await runPipeline(ctx, [
      async c => { calls.push('a'); return c; },
      async c => { calls.push('b'); return c; },
    ]);

    expect(calls).toEqual(['a', 'b']);
  });
});
