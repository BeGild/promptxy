import { describe, it, expect } from 'vitest';
import {
  detectClaudeModelTier,
  parseOpenAIModelSpec,
  resolveClaudeMappedModelSpec,
} from '../../src/promptxy/model-mapping.js';

describe('model-mapping', () => {
  it('detectClaudeModelTier 应按 opus>haiku>sonnet，并在未知时默认 sonnet', () => {
    expect(detectClaudeModelTier('claude-3-5-opus-20241022')).toBe('opus');
    expect(detectClaudeModelTier('claude-3-5-haiku-20241022')).toBe('haiku');
    expect(detectClaudeModelTier('claude-3-5-sonnet-20241022')).toBe('sonnet');
    expect(detectClaudeModelTier('claude-unknown')).toBe('sonnet');
    expect(detectClaudeModelTier(undefined)).toBe('sonnet');
  });

  it('resolveClaudeMappedModelSpec 应在缺失 haiku/opus 时回落到 sonnet', () => {
    const map = { sonnet: 'gpt-5.2-codex-medium' };
    expect(resolveClaudeMappedModelSpec(map, 'sonnet')).toEqual({ ok: true, modelSpec: 'gpt-5.2-codex-medium' });
    expect(resolveClaudeMappedModelSpec(map, 'haiku')).toEqual({ ok: true, modelSpec: 'gpt-5.2-codex-medium' });
    expect(resolveClaudeMappedModelSpec(map, 'opus')).toEqual({ ok: true, modelSpec: 'gpt-5.2-codex-medium' });
  });

  it('resolveClaudeMappedModelSpec 在缺失 claudeModelMap 或 sonnet 时返回错误', () => {
    expect(resolveClaudeMappedModelSpec(undefined, 'sonnet').ok).toBe(false);
    expect(resolveClaudeMappedModelSpec({}, 'sonnet').ok).toBe(false);
    expect(resolveClaudeMappedModelSpec({ sonnet: '' }, 'sonnet').ok).toBe(false);
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
});
