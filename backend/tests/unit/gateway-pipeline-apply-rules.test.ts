import { describe, it, expect, vi } from 'vitest';
import { createApplyRules } from '../../src/promptxy/gateway-pipeline/steps/apply-rules';

describe('applyRules', () => {
  it('applies codex rules when localService is codex', async () => {
    const mockMutateCodexBody = vi.fn().mockReturnValue({
      body: { model: 'gpt-4', modified: true },
      matches: [{ ruleId: 'r1' }],
      warnings: ['warn1'],
    });

    const applyRules = createApplyRules({
      mutateCodexBody: mockMutateCodexBody,
      mutateGeminiBody: vi.fn(),
      config: { rules: [{ id: 'r1' }] } as any,
    });

    const ctx: any = {
      req: { url: '/codex/v1/responses' },
      jsonBody: { model: 'gpt-4' },
      routePlan: { localService: 'codex', transformer: 'none' },
      startTime: Date.now(),
    };

    const result = await applyRules(ctx);

    expect(mockMutateCodexBody).toHaveBeenCalled();
    expect(result.jsonBody).toEqual({ model: 'gpt-4', modified: true });
    expect(result.matches).toEqual([{ ruleId: 'r1' }]);
    expect(result.warnings).toEqual(['warn1']);
  });

  it('applies gemini rules when localService is gemini', async () => {
    const mockMutateGeminiBody = vi.fn().mockReturnValue({
      body: { model: 'gemini-pro', modified: true },
      matches: [{ ruleId: 'r2' }],
      warnings: [],
    });

    const applyRules = createApplyRules({
      mutateCodexBody: vi.fn(),
      mutateGeminiBody: mockMutateGeminiBody,
      config: { rules: [{ id: 'r2' }] } as any,
    });

    const ctx: any = {
      req: { url: '/gemini/v1/models' },
      jsonBody: { model: 'gemini-pro' },
      routePlan: { localService: 'gemini', transformer: 'none' },
      startTime: Date.now(),
    };

    const result = await applyRules(ctx);

    expect(mockMutateGeminiBody).toHaveBeenCalled();
    expect(result.jsonBody).toEqual({ model: 'gemini-pro', modified: true });
  });

  it('skips rules for claude with transformer (avoid double apply)', async () => {
    const mockMutateCodexBody = vi.fn();
    const mockMutateGeminiBody = vi.fn();

    const applyRules = createApplyRules({
      mutateCodexBody: mockMutateCodexBody,
      mutateGeminiBody: mockMutateGeminiBody,
      config: { rules: [] } as any,
    });

    const ctx: any = {
      req: { url: '/claude/v1/messages' },
      jsonBody: { model: 'claude-sonnet' },
      routePlan: { localService: 'claude', transformer: 'openai-chat' },
      startTime: Date.now(),
    };

    const result = await applyRules(ctx);

    expect(mockMutateCodexBody).not.toHaveBeenCalled();
    expect(mockMutateGeminiBody).not.toHaveBeenCalled();
    expect(result.jsonBody).toEqual({ model: 'claude-sonnet' });
  });

  it('skips rules for claude with transformer=none (claude rules applied elsewhere)', async () => {
    const mockMutateCodexBody = vi.fn();
    const mockMutateGeminiBody = vi.fn();

    const applyRules = createApplyRules({
      mutateCodexBody: mockMutateCodexBody,
      mutateGeminiBody: mockMutateGeminiBody,
      config: { rules: [] } as any,
    });

    const ctx: any = {
      req: { url: '/claude/v1/messages' },
      jsonBody: { model: 'claude-sonnet' },
      routePlan: { localService: 'claude', transformer: 'none' },
      startTime: Date.now(),
    };

    const result = await applyRules(ctx);

    // Claude 规则在转换后统一应用，不在此步骤处理
    expect(mockMutateCodexBody).not.toHaveBeenCalled();
    expect(mockMutateGeminiBody).not.toHaveBeenCalled();
    expect(result.jsonBody).toEqual({ model: 'claude-sonnet' });
  });

  it('handles missing jsonBody gracefully', async () => {
    const applyRules = createApplyRules({
      mutateCodexBody: vi.fn(),
      mutateGeminiBody: vi.fn(),
      config: { rules: [] } as any,
    });

    const ctx: any = {
      req: { url: '/codex/v1/responses' },
      routePlan: { localService: 'codex', transformer: 'none' },
      startTime: Date.now(),
    };

    const result = await applyRules(ctx);

    expect(result).toBe(ctx);
  });
});
