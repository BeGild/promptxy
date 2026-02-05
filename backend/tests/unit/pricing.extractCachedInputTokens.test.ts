import { describe, it, expect } from 'vitest';
import { getPricingService, resetPricingService } from '../../src/promptxy/pricing.js';

describe('PricingService.extractCachedInputTokens', () => {
  it('应从 Codex Responses SSE 的 response.completed.response.usage.input_tokens_details.cached_tokens 提取缓存命中 tokens', () => {
    resetPricingService();
    const pricing = getPricingService();

    const events = [
      { type: 'response.created', response: { usage: null } },
      {
        type: 'response.completed',
        response: {
          usage: {
            input_tokens: 7,
            input_tokens_details: { cached_tokens: 2 },
            output_tokens: 14,
          },
        },
      },
    ];

    const cached = pricing.extractCachedInputTokens(events);
    expect(cached.cachedInputTokens).toBe(2);
    expect(cached.subtractFromInputTokens).toBe(true);
  });

  it('应从 OpenAI Chat usage.prompt_tokens_details.cached_tokens 提取缓存命中 tokens', () => {
    resetPricingService();
    const pricing = getPricingService();

    const response = {
      id: 'chatcmpl_xxx',
      object: 'chat.completion',
      usage: {
        prompt_tokens: 11,
        completion_tokens: 3,
        total_tokens: 14,
        prompt_tokens_details: { cached_tokens: 4 },
      },
    };

    const cached = pricing.extractCachedInputTokens(response);
    expect(cached.cachedInputTokens).toBe(4);
    expect(cached.subtractFromInputTokens).toBe(true);
  });

  it('遇到 Claude usage.cache_read_input_tokens 时应返回缓存命中 tokens，但不应再从 inputTokens 扣除', () => {
    resetPricingService();
    const pricing = getPricingService();

    const response = {
      type: 'message',
      usage: {
        input_tokens: 5,
        output_tokens: 1,
        cache_read_input_tokens: 5,
        cache_creation_input_tokens: 0,
      },
    };

    const cached = pricing.extractCachedInputTokens(response);
    expect(cached.cachedInputTokens).toBe(5);
    expect(cached.subtractFromInputTokens).toBe(false);
  });
});

