import { describe, it, expect } from 'vitest';
import { getPricingService, resetPricingService } from '../../src/promptxy/pricing.js';

describe('PricingService.extractUsage - codex responses sse', () => {
  it('应从 response.completed.response.usage 读取 input/output tokens', () => {
    resetPricingService();
    const pricing = getPricingService();

    const events = [
      { type: 'response.created', response: { usage: null } },
      {
        type: 'response.completed',
        response: {
          model: 'gpt-5.2-2025-12-11',
          usage: {
            input_tokens: 7,
            input_tokens_details: { cached_tokens: 2 },
            output_tokens: 14,
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: 21,
          },
        },
      },
    ];

    const usage = pricing.extractUsage(events);
    expect(usage.inputTokens).toBe(7);
    expect(usage.outputTokens).toBe(14);
  });
});
