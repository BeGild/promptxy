import { describe, it, expect } from 'vitest';
import { mutateClaudeBody } from '../../src/promptxy/adapters/claude.js';
import { mutateCodexBody } from '../../src/promptxy/adapters/codex.js';
import { mutateGeminiBody } from '../../src/promptxy/adapters/gemini.js';
import { PromptxyRule } from '../../src/promptxy/types.js';

describe('Adapters', () => {
  const baseRules: PromptxyRule[] = [
    {
      uuid: 'test-rule',
      name: 'test-rule',
      when: { client: 'claude', field: 'system' },
      ops: [{ type: 'append', text: ' [MODIFIED]' }],
    },
  ];

  describe('Claude Adapter', () => {
    it('should handle string system field', () => {
      const body = {
        model: 'claude-3-5-sonnet-20241022',
        system: 'original system prompt',
        messages: [{ role: 'user', content: 'test' }],
      };

      const result = mutateClaudeBody({
        body,
        method: 'POST',
        path: '/v1/messages',
        rules: baseRules,
      });

      expect(result.body.system).toBe('original system prompt [MODIFIED]');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].ruleId).toBe('test-rule');
    });

    it('should handle array system field with text blocks', () => {
      const body = {
        model: 'claude-3-5-sonnet-20241022',
        system: [
          { type: 'text', text: 'block1' },
          { type: 'text', text: 'block2' },
        ],
        messages: [{ role: 'user', content: 'test' }],
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'array-rule',
          name: 'array-rule',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const result = mutateClaudeBody({
        body,
        method: 'POST',
        path: '/v1/messages',
        rules,
      });

      expect(result.body.system[0].text).toBe('block1 +1');
      expect(result.body.system[1].text).toBe('block2 +1');
      expect(result.matches).toHaveLength(2);
    });

    it('should skip non-text blocks in array', () => {
      const body = {
        model: 'claude-3-5-sonnet-20241022',
        system: [
          { type: 'text', text: 'text-block' },
          { type: 'image', source: 'base64-data' },
          { type: 'text', text: 'another-text' },
        ],
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'mixed-rule',
          name: 'mixed-rule',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const result = mutateClaudeBody({
        body,
        method: 'POST',
        path: '/v1/messages',
        rules,
      });

      expect(result.body.system[0].text).toBe('text-block +1');
      expect(result.body.system[1].type).toBe('image');
      expect(result.body.system[2].text).toBe('another-text +1');
    });

    it('should handle array with non-string text values', () => {
      const body = {
        model: 'claude-3-5-sonnet-20241022',
        system: [
          { type: 'text', text: ['part1', 'part2'] }, // Array of strings
          { type: 'text', text: 'single' },
        ],
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'array-text',
          name: 'array-text',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const result = mutateClaudeBody({
        body,
        method: 'POST',
        path: '/v1/messages',
        rules,
      });

      expect(result.body.system[0].text).toBe('part1part2 +1');
      expect(result.body.system[1].text).toBe('single +1');
    });

    it('should return unchanged body when system is undefined', () => {
      const body = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'test' }],
      };

      const result = mutateClaudeBody({
        body,
        method: 'POST',
        path: '/v1/messages',
        rules: baseRules,
      });

      expect(result.body).toEqual(body);
      expect(result.matches).toEqual([]);
    });

    it('should return unchanged body when system is null', () => {
      const body = {
        model: 'claude-3-5-sonnet-20241022',
        system: null,
        messages: [{ role: 'user', content: 'test' }],
      };

      const result = mutateClaudeBody({
        body,
        method: 'POST',
        path: '/v1/messages',
        rules: baseRules,
      });

      expect(result.body).toEqual(body);
      expect(result.matches).toEqual([]);
    });

    it('should return unchanged body for non-object input', () => {
      const result = mutateClaudeBody({
        body: 'not an object',
        method: 'POST',
        path: '/v1/messages',
        rules: baseRules,
      });

      expect(result.body).toBe('not an object');
      expect(result.matches).toEqual([]);
    });

    it('should handle multiple rules for claude', () => {
      const body = {
        model: 'claude-3-5-sonnet-20241022',
        system: 'original',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'rule-1',
          name: 'rule-1',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'prepend', text: 'A' }],
        },
        {
          uuid: 'rule-2',
          name: 'rule-2',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: 'B' }],
        },
      ];

      const result = mutateClaudeBody({
        body,
        method: 'POST',
        path: '/v1/messages',
        rules,
      });

      expect(result.body.system).toBe('AoriginalB');
      expect(result.matches).toHaveLength(2);
    });

    it('should respect client filter in rules', () => {
      const body = {
        model: 'claude-3-5-sonnet-20241022',
        system: 'test',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'claude-rule',
          name: 'claude-rule',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: '-claude' }],
        },
        {
          uuid: 'codex-rule',
          name: 'codex-rule',
          when: { client: 'codex', field: 'system' },
          ops: [{ type: 'append', text: '-codex' }],
        },
      ];

      const result = mutateClaudeBody({
        body,
        method: 'POST',
        path: '/v1/messages',
        rules,
      });

      expect(result.body.system).toBe('test-claude');
      expect(result.matches).toHaveLength(1);
    });
  });

  describe('Codex Adapter', () => {
    it('should handle instructions field', () => {
      const body = {
        model: 'gpt-4',
        instructions: 'original instructions',
        input: 'test input',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'codex-rule',
          name: 'codex-rule',
          when: { client: 'codex', field: 'instructions' },
          ops: [{ type: 'append', text: ' [CODEX]' }],
        },
      ];

      const result = mutateCodexBody({
        body,
        method: 'POST',
        path: '/v1/responses',
        rules,
      });

      expect(result.body.instructions).toBe('original instructions [CODEX]');
      expect(result.matches).toHaveLength(1);
      expect(result.warnings).toEqual([]);
    });

    it('should return unchanged when instructions is not a string', () => {
      const body = {
        model: 'gpt-4',
        instructions: 123,
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'test',
          name: 'test',
          when: { client: 'codex', field: 'instructions' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const result = mutateCodexBody({
        body,
        method: 'POST',
        path: '/v1/responses',
        rules,
      });

      expect(result.body).toEqual(body);
      expect(result.matches).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should return unchanged when instructions is missing', () => {
      const body = {
        model: 'gpt-4',
        input: 'test',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'test',
          name: 'test',
          when: { client: 'codex', field: 'instructions' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const result = mutateCodexBody({
        body,
        method: 'POST',
        path: '/v1/responses',
        rules,
      });

      expect(result.body).toEqual(body);
      expect(result.matches).toEqual([]);
    });

    it('should warn when prefix changes significantly', () => {
      const body = {
        model: 'gpt-4',
        instructions:
          'This is a long instruction that will be completely replaced with something else',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'prefix-change',
          name: 'prefix-change',
          when: { client: 'codex', field: 'instructions' },
          ops: [{ type: 'set', text: 'Completely different instructions' }],
        },
      ];

      const result = mutateCodexBody({
        body,
        method: 'POST',
        path: '/v1/responses',
        rules,
      });

      expect(result.body.instructions).toBe('Completely different instructions');
      expect(result.warnings).toContain(
        'Codex instructions prefix changed (first 64 chars differ from original).',
      );
    });

    it('should not warn when prefix is similar', () => {
      const body = {
        model: 'gpt-4',
        instructions: 'This is a long instruction that will be slightly modified',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'slight-change',
          name: 'slight-change',
          when: { client: 'codex', field: 'instructions' },
          ops: [{ type: 'append', text: ' and more' }],
        },
      ];

      const result = mutateCodexBody({
        body,
        method: 'POST',
        path: '/v1/responses',
        rules,
      });

      expect(result.body.instructions).toBe(
        'This is a long instruction that will be slightly modified and more',
      );
      expect(result.warnings).toEqual([]);
    });

    it('should handle multiple rules for codex', () => {
      const body = {
        model: 'gpt-4',
        instructions: 'base',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'rule-1',
          name: 'rule-1',
          when: { client: 'codex', field: 'instructions' },
          ops: [{ type: 'prepend', text: 'A' }],
        },
        {
          uuid: 'rule-2',
          name: 'rule-2',
          when: { client: 'codex', field: 'instructions' },
          ops: [{ type: 'append', text: 'B' }],
        },
      ];

      const result = mutateCodexBody({
        body,
        method: 'POST',
        path: '/v1/responses',
        rules,
      });

      expect(result.body.instructions).toBe('AbaseB');
      expect(result.matches).toHaveLength(2);
    });
  });

  describe('Gemini Adapter', () => {
    it('should handle system_instruction as string', () => {
      const body = {
        model: 'gemini-pro',
        system_instruction: 'original system',
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'gemini-rule',
          name: 'gemini-rule',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' [GEMINI]' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
        rules,
      });

      expect(result.body.system_instruction).toBe('original system [GEMINI]');
      expect(result.matches).toHaveLength(1);
    });

    it('should handle systemInstruction as string (camelCase)', () => {
      const body = {
        model: 'gemini-pro',
        systemInstruction: 'original system',
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'gemini-rule',
          name: 'gemini-rule',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' [GEMINI]' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
        rules,
      });

      expect(result.body.systemInstruction).toBe('original system [GEMINI]');
      expect(result.matches).toHaveLength(1);
    });

    it('should handle system_instruction as object with parts', () => {
      const body = {
        model: 'gemini-pro',
        system_instruction: {
          parts: [{ text: 'part1' }, { text: 'part2' }],
        },
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'gemini-parts',
          name: 'gemini-parts',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' +parts' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
        rules,
      });

      expect(result.body.system_instruction).toEqual({
        parts: [{ text: 'part1part2 +parts' }],
      });
      expect(result.matches).toHaveLength(1);
    });

    it('should extract model from path', () => {
      const body = {
        system_instruction: 'test',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'model-test',
          name: 'model-test',
          when: { client: 'gemini', field: 'system', modelRegex: 'gemini-pro' },
          ops: [{ type: 'append', text: ' matched' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
        rules,
      });

      expect(result.body.system_instruction).toBe('test matched');
    });

    it('should fallback to body.model for model extraction', () => {
      const body = {
        model: 'gemini-pro',
        system_instruction: 'test',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'model-test',
          name: 'model-test',
          when: { client: 'gemini', field: 'system', modelRegex: 'gemini-pro' },
          ops: [{ type: 'append', text: ' matched' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-ultra:generateContent', // Path extracts "gemini-ultra"
        rules,
      });

      // Should NOT match because path extracts "gemini-ultra" which doesn't match "gemini-pro"
      // So it should return unchanged
      expect(result.body.system_instruction).toBe('test');
    });

    it('should extract model from path and match rules', () => {
      const body = {
        model: 'gemini-pro', // This should be ignored since path has model
        system_instruction: 'test',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'model-test',
          name: 'model-test',
          when: { client: 'gemini', field: 'system', modelRegex: 'gemini-ultra' },
          ops: [{ type: 'append', text: ' matched' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-ultra:generateContent', // Path extracts "gemini-ultra"
        rules,
      });

      // Should match because path extracts "gemini-ultra" which matches the rule
      expect(result.body.system_instruction).toBe('test matched');
    });

    it('should return unchanged when system fields are missing', () => {
      const body = {
        model: 'gemini-pro',
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'test',
          name: 'test',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
        rules,
      });

      expect(result.body).toEqual(body);
      expect(result.matches).toEqual([]);
    });

    it('should handle non-object parts in system_instruction', () => {
      const body = {
        model: 'gemini-pro',
        system_instruction: {
          parts: [
            { text: 'valid' },
            { notText: 'invalid' },
            { text: 123 }, // Not a string
            { text: 'also-valid' },
          ],
        },
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'mixed-parts',
          name: 'mixed-parts',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
        rules,
      });

      expect(result.body.system_instruction).toEqual({
        parts: [{ text: 'validalso-valid +1' }],
      });
    });

    it('should handle empty parts array', () => {
      const body = {
        model: 'gemini-pro',
        system_instruction: {
          parts: [],
        },
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'empty-parts',
          name: 'empty-parts',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
        rules,
      });

      expect(result.body.system_instruction).toEqual({
        parts: [{ text: ' +1' }],
      });
    });

    it('should handle non-object system_instruction', () => {
      const body = {
        model: 'gemini-pro',
        system_instruction: 123,
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'test',
          name: 'test',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
        rules,
      });

      expect(result.body).toEqual(body);
      expect(result.matches).toEqual([]);
    });

    it('should handle multiple rules for gemini', () => {
      const body = {
        model: 'gemini-pro',
        system_instruction: 'base',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'rule-1',
          name: 'rule-1',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'prepend', text: 'A' }],
        },
        {
          uuid: 'rule-2',
          name: 'rule-2',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: 'B' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
        rules,
      });

      expect(result.body.system_instruction).toBe('AbaseB');
      expect(result.matches).toHaveLength(2);
    });

    it('should prioritize system_instruction over systemInstruction', () => {
      const body = {
        model: 'gemini-pro',
        system_instruction: 'underscore',
        systemInstruction: 'camelCase',
      };

      const rules: PromptxyRule[] = [
        {
          uuid: 'priority',
          name: 'priority',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const result = mutateGeminiBody({
        body,
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
        rules,
      });

      // Should modify the first one found (system_instruction)
      expect(result.body.system_instruction).toBe('underscore +1');
      expect(result.body.systemInstruction).toBe('camelCase');
    });
  });

  describe('Cross-Adapter Consistency', () => {
    it('should all return same structure', () => {
      const claudeBody = { model: 'test', system: 'original' };
      const codexBody = { model: 'test', instructions: 'original' };
      const geminiBody = { model: 'test', system_instruction: 'original' };

      const rules: PromptxyRule[] = [
        {
          uuid: 'test',
          name: 'test',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const claudeResult = mutateClaudeBody({
        body: claudeBody,
        method: 'POST',
        path: '/test',
        rules,
      });

      const codexRules: PromptxyRule[] = [
        {
          uuid: 'test',
          name: 'test',
          when: { client: 'codex', field: 'instructions' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const codexResult = mutateCodexBody({
        body: codexBody,
        method: 'POST',
        path: '/test',
        rules: codexRules,
      });

      const geminiRules: PromptxyRule[] = [
        {
          uuid: 'test',
          name: 'test',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
      ];

      const geminiResult = mutateGeminiBody({
        body: geminiBody,
        method: 'POST',
        path: '/test',
        rules: geminiRules,
      });

      // All should have the same structure
      expect(claudeResult).toHaveProperty('body');
      expect(claudeResult).toHaveProperty('matches');
      expect(codexResult).toHaveProperty('body');
      expect(codexResult).toHaveProperty('matches');
      expect(codexResult).toHaveProperty('warnings');
      expect(geminiResult).toHaveProperty('body');
      expect(geminiResult).toHaveProperty('matches');

      // All should modify the text
      expect(claudeResult.body.system).toBe('original +1');
      expect(codexResult.body.instructions).toBe('original +1');
      expect(geminiResult.body.system_instruction).toBe('original +1');
    });
  });
});
