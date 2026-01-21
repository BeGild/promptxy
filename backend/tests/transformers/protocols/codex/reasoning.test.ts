import { describe, it, expect } from 'vitest';
import { thinkingBudgetToEffort, extractReasoningEffort } from '../../../src/promptxy/transformers/protocols/codex/reasoning.js';

describe('thinkingBudgetToEffort', () => {
  it('对于不使用 thinking levels 的模型返回 undefined', () => {
    expect(thinkingBudgetToEffort('gpt-4', 10000)).toBeUndefined();
    expect(thinkingBudgetToEffort('gpt-3.5-turbo', 5000)).toBeUndefined();
    expect(thinkingBudgetToEffort('claude-3.5-sonnet', 20000)).toBeUndefined();
  });

  it('对于 o1 模型正确映射 effort', () => {
    expect(thinkingBudgetToEffort('o1-preview', 25000)).toBe('high');
    expect(thinkingBudgetToEffort('o1-mini', 20000)).toBe('high');
    expect(thinkingBudgetToEffort('o1-preview', 10000)).toBe('medium');
    expect(thinkingBudgetToEffort('o1-mini', 5000)).toBe('medium');
    expect(thinkingBudgetToEffort('o1-preview', 1000)).toBe('low');
    expect(thinkingBudgetToEffort('o1-mini', 1000)).toBe('low');
  });

  it('对于 o3 模型正确映射 effort', () => {
    expect(thinkingBudgetToEffort('o3-mini', 25000)).toBe('high');
    expect(thinkingBudgetToEffort('o3-high', 20000)).toBe('high');
    expect(thinkingBudgetToEffort('o3-medium', 10000)).toBe('medium');
    expect(thinkingBudgetToEffort('o3-low', 5000)).toBe('medium');
    expect(thinkingBudgetToEffort('o3-mini', 1000)).toBe('low');
    expect(thinkingBudgetToEffort('o3-high', 1000)).toBe('low');
  });

  it('边界值测试', () => {
    expect(thinkingBudgetToEffort('o1-preview', 20000)).toBe('high');
    expect(thinkingBudgetToEffort('o1-preview', 19999)).toBe('medium');
    expect(thinkingBudgetToEffort('o1-preview', 5000)).toBe('medium');
    expect(thinkingBudgetToEffort('o1-preview', 4999)).toBe('low');
  });
});

describe('extractReasoningEffort', () => {
  it('没有 thinking config 时返回默认值 medium', () => {
    expect(extractReasoningEffort('o1-preview', undefined)).toBe('medium');
    expect(extractReasoningEffort('o3-mini', null)).toBe('medium');
  });

  it('type=disabled 时返回 low', () => {
    expect(extractReasoningEffort('o1-preview', { type: 'disabled' })).toBe('low');
    expect(extractReasoningEffort('o3-mini', { type: 'disabled' })).toBe('low');
  });

  it('type=enabled 且有 budget_tokens 时正确映射', () => {
    expect(extractReasoningEffort('o1-preview', { type: 'enabled', budget_tokens: 25000 })).toBe('high');
    expect(extractReasoningEffort('o1-preview', { type: 'enabled', budget_tokens: 10000 })).toBe('medium');
    expect(extractReasoningEffort('o1-preview', { type: 'enabled', budget_tokens: 1000 })).toBe('low');
    expect(extractReasoningEffort('o3-mini', { type: 'enabled', budget_tokens: 25000 })).toBe('high');
    expect(extractReasoningEffort('o3-mini', { type: 'enabled', budget_tokens: 10000 })).toBe('medium');
    expect(extractReasoningEffort('o3-mini', { type: 'enabled', budget_tokens: 1000 })).toBe('low');
  });

  it('type=enabled 但没有 budget_tokens 时返回默认值', () => {
    expect(extractReasoningEffort('o1-preview', { type: 'enabled' })).toBe('medium');
    expect(extractReasoningEffort('o3-mini', { type: 'enabled' })).toBe('medium');
  });

  it('对于不支持 thinking levels 的模型始终返回默认值', () => {
    expect(extractReasoningEffort('gpt-4', { type: 'disabled' })).toBe('medium');
    expect(extractReasoningEffort('gpt-4', { type: 'enabled', budget_tokens: 25000 })).toBe('medium');
    expect(extractReasoningEffort('claude-3.5-sonnet', { type: 'disabled' })).toBe('medium');
  });

  it('无效的 type 值时返回默认值', () => {
    expect(extractReasoningEffort('o1-preview', { type: 'invalid' } as any)).toBe('medium');
  });
});