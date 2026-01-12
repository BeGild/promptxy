import { describe, it, expect } from 'vitest';
import { parseOpenAIModelSpec, resolveModelMapping } from '../../src/promptxy/model-mapping.js';

describe('model-mapping', () => {
  it('resolveModelMapping 未启用/未命中时返回 matched=false', () => {
    expect(resolveModelMapping('claude-3-5-sonnet-20241022', undefined).matched).toBe(false);

    expect(
      resolveModelMapping('claude-3-5-sonnet-20241022', { enabled: false, rules: [] }).matched,
    ).toBe(false);

    expect(
      resolveModelMapping('claude-3-5-sonnet-20241022', {
        enabled: true,
        rules: [
          {
            id: 'r1',
            pattern: 'claude-*-haiku-*',
            targetSupplierId: 'openai-up',
            targetModel: 'gpt-4o-mini',
          },
        ],
      }).matched,
    ).toBe(false);
  });

  it('resolveModelMapping 命中后返回 targetSupplierId + 可选 targetModel', () => {
    const res = resolveModelMapping('claude-3-5-sonnet-20241022', {
      enabled: true,
      rules: [
        {
          id: 'r1',
          pattern: 'claude-*-sonnet-*',
          targetSupplierId: 'openai-up',
          targetModel: 'gpt-4o-mini',
        },
      ],
    });

    expect(res).toEqual({
      matched: true,
      targetSupplierId: 'openai-up',
      targetModel: 'gpt-4o-mini',
      rule: {
        id: 'r1',
        pattern: 'claude-*-sonnet-*',
        targetSupplierId: 'openai-up',
        targetModel: 'gpt-4o-mini',
      },
    });
  });

  it('resolveModelMapping 支持 targetModel 为空（透传语义由上层处理）', () => {
    const res = resolveModelMapping('claude-3-5-sonnet-20241022', {
      enabled: true,
      rules: [
        {
          id: 'r1',
          pattern: 'claude-*-sonnet-*',
          targetSupplierId: 'openai-up',
        },
      ],
    });

    expect(res.matched).toBe(true);
    if (res.matched) {
      expect(res.targetSupplierId).toBe('openai-up');
      expect(res.targetModel).toBeUndefined();
    }
  });

  it('parseOpenAIModelSpec 应仅在 effort 命中列表时拆解，否则透传', () => {
    expect(parseOpenAIModelSpec('gpt-5.2-codex-high', undefined)).toEqual({
      model: 'gpt-5.2-codex',
      reasoningEffort: 'high',
    });

    // 不应误拆常见模型后缀
    expect(parseOpenAIModelSpec('gpt-4o-mini', undefined)).toEqual({ model: 'gpt-4o-mini' });

    // 未识别 effort：透传
    expect(parseOpenAIModelSpec('gpt-5.2-codex-ultra', undefined)).toEqual({ model: 'gpt-5.2-codex-ultra' });

    // 自定义 effort 列表：允许未来扩展
    expect(parseOpenAIModelSpec('gpt-5.2-codex-ultra', ['ultra'])).toEqual({
      model: 'gpt-5.2-codex',
      reasoningEffort: 'ultra',
    });
  });

  it('parseOpenAIModelSpec 对连字符分段应遵循“最后一段”为 effort 的规则，并兼容 x_high→xhigh', () => {
    expect(parseOpenAIModelSpec('gpt-5.2-codex-x-high', undefined)).toEqual({
      model: 'gpt-5.2-codex-x',
      reasoningEffort: 'high',
    });
    expect(parseOpenAIModelSpec('gpt-5.2-codex-x_high', undefined)).toEqual({
      model: 'gpt-5.2-codex',
      reasoningEffort: 'xhigh',
    });
  });

  it('parseOpenAIModelSpec 不应误拆常见模型后缀（mini）', () => {
    expect(parseOpenAIModelSpec('gpt-4o-mini', undefined)).toEqual({ model: 'gpt-4o-mini' });
  });
});
