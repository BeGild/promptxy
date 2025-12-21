import { describe, it, expect } from 'vitest';
import { applyPromptRules } from '../../src/promptxy/rules/engine.js';
import { PromptxyRule, PromptxyRequestContext } from '../../src/promptxy/types.js';

describe('Rules Engine', () => {
  const baseContext: PromptxyRequestContext = {
    client: 'claude',
    field: 'system',
    method: 'POST',
    path: '/v1/messages',
    model: 'claude-3-5-sonnet-20241022',
  };

  describe('Basic Operations', () => {
    it('should apply set operation', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'set-rule',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'set', text: 'new system prompt' }],
        },
      ];

      const result = applyPromptRules('original prompt', baseContext, rules);
      expect(result.text).toBe('new system prompt');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].ruleId).toBe('set-rule');
      expect(result.matches[0].opType).toBe('set');
    });

    it('should apply append operation', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'append-rule',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' appended' }],
        },
      ];

      const result = applyPromptRules('original', baseContext, rules);
      expect(result.text).toBe('original appended');
    });

    it('should apply prepend operation', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'prepend-rule',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'prepend', text: 'prepended ' }],
        },
      ];

      const result = applyPromptRules('original', baseContext, rules);
      expect(result.text).toBe('prepended original');
    });

    it('should apply replace operation with match', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'replace-rule',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace', match: 'old', replacement: 'new' }],
        },
      ];

      const result = applyPromptRules('This is old text', baseContext, rules);
      expect(result.text).toBe('This is new text');
    });

    it('should apply replace operation with regex', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'replace-regex',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace', regex: '\\d+', replacement: 'NUMBER' }],
        },
      ];

      const result = applyPromptRules('There are 123 items', baseContext, rules);
      expect(result.text).toBe('There are NUMBER items');
    });

    it('should apply delete operation with match', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'delete-rule',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'delete', match: 'unwanted' }],
        },
      ];

      const result = applyPromptRules('This is unwanted text', baseContext, rules);
      expect(result.text).toBe('This is  text');
    });

    it('should apply delete operation with regex', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'delete-regex',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'delete', regex: '\\[.*?\\]' }],
        },
      ];

      const result = applyPromptRules('Remove [this] but keep text', baseContext, rules);
      expect(result.text).toBe('Remove  but keep text');
    });

    it('should apply insert_before operation', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'insert-before',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'insert_before', regex: 'target', text: 'BEFORE-' }],
        },
      ];

      const result = applyPromptRules('Find target here', baseContext, rules);
      expect(result.text).toBe('Find BEFORE-target here');
    });

    it('should apply insert_after operation', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'insert-after',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'insert_after', regex: 'target', text: '-AFTER' }],
        },
      ];

      const result = applyPromptRules('Find target here', baseContext, rules);
      expect(result.text).toBe('Find target-AFTER here');
    });
  });

  describe('Multiple Operations', () => {
    it('should apply multiple operations in sequence', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'multi-op',
          when: { client: 'claude', field: 'system' },
          ops: [
            { type: 'prepend', text: 'START: ' },
            { type: 'append', text: ' :END' },
            { type: 'replace', match: 'original', replacement: 'MODIFIED' },
          ],
        },
      ];

      const result = applyPromptRules('original text', baseContext, rules);
      expect(result.text).toBe('START: MODIFIED text :END');
      expect(result.matches).toHaveLength(3);
    });

    it('should apply multiple rules in order', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'rule-1',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
        {
          id: 'rule-2',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' +2' }],
        },
      ];

      const result = applyPromptRules('base', baseContext, rules);
      expect(result.text).toBe('base +1 +2');
      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].ruleId).toBe('rule-1');
      expect(result.matches[1].ruleId).toBe('rule-2');
    });
  });

  describe('Rule Matching', () => {
    it('should only apply rules matching client', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'claude-only',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' claude' }],
        },
        {
          id: 'codex-only',
          when: { client: 'codex', field: 'system' },
          ops: [{ type: 'append', text: ' codex' }],
        },
      ];

      const result = applyPromptRules('base', baseContext, rules);
      expect(result.text).toBe('base claude');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].ruleId).toBe('claude-only');
    });

    it('should only apply rules matching field', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'system-field',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' system' }],
        },
        {
          id: 'instructions-field',
          when: { client: 'claude', field: 'instructions' },
          ops: [{ type: 'append', text: ' instructions' }],
        },
      ];

      const result = applyPromptRules('base', baseContext, rules);
      expect(result.text).toBe('base system');
    });

    it('should match path regex', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'path-rule',
          when: { client: 'claude', field: 'system', pathRegex: '^/v1/' },
          ops: [{ type: 'append', text: ' v1' }],
        },
      ];

      const result = applyPromptRules('base', baseContext, rules);
      expect(result.text).toBe('base v1');
    });

    it('should not match when path regex fails', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'path-rule',
          when: { client: 'claude', field: 'system', pathRegex: '^/v2/' },
          ops: [{ type: 'append', text: ' v2' }],
        },
      ];

      const result = applyPromptRules('base', baseContext, rules);
      expect(result.text).toBe('base');
    });

    it('should match model regex', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'model-rule',
          when: { client: 'claude', field: 'system', modelRegex: 'sonnet' },
          ops: [{ type: 'append', text: ' sonnet' }],
        },
      ];

      const result = applyPromptRules('base', baseContext, rules);
      expect(result.text).toBe('base sonnet');
    });

    it('should match method', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'method-rule',
          when: { client: 'claude', field: 'system', method: 'POST' },
          ops: [{ type: 'append', text: ' POST' }],
        },
      ];

      const result = applyPromptRules('base', baseContext, rules);
      expect(result.text).toBe('base POST');
    });

    it('should not match when method differs', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'method-rule',
          when: { client: 'claude', field: 'system', method: 'GET' },
          ops: [{ type: 'append', text: ' GET' }],
        },
      ];

      const result = applyPromptRules('base', baseContext, rules);
      expect(result.text).toBe('base');
    });
  });

  describe('Disabled Rules', () => {
    it('should skip disabled rules', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'enabled',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' enabled' }],
        },
        {
          id: 'disabled',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' disabled' }],
          enabled: false,
        },
      ];

      const result = applyPromptRules('base', baseContext, rules);
      expect(result.text).toBe('base enabled');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].ruleId).toBe('enabled');
    });
  });

  describe('Stop Flag', () => {
    it('should stop processing when stop flag is set', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'stop-rule',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'set', text: 'stopped' }],
          stop: true,
        },
        {
          id: 'should-not-run',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' extra' }],
        },
      ];

      const result = applyPromptRules('original', baseContext, rules);
      expect(result.text).toBe('stopped');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].ruleId).toBe('stop-rule');
    });
  });

  describe('Regex Flags', () => {
    it('should apply regex with flags', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'case-insensitive',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace', regex: 'test', flags: 'gi', replacement: 'PASS' }],
        },
      ];

      const result = applyPromptRules('Test TEST test', baseContext, rules);
      expect(result.text).toBe('PASS PASS PASS');
    });

    it('should handle regex with multiline flag', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'multiline',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'delete', regex: '^line$', flags: 'gm' }],
        },
      ];

      const result = applyPromptRules('line1\nline\nline2', baseContext, rules);
      expect(result.text).toBe('line1\n\nline2');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid regex in replace', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'invalid-regex',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace', regex: '[invalid', replacement: 'test' }],
        },
      ];

      expect(() => applyPromptRules('test', baseContext, rules)).toThrow('invalid regex');
    });

    it('should throw error for empty match in replace', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'empty-match',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace', match: '', replacement: 'test' }],
        },
      ];

      expect(() => applyPromptRules('test', baseContext, rules)).toThrow('match must not be empty');
    });

    it('should throw error for empty match in delete', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'empty-delete',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'delete', match: '' }],
        },
      ];

      expect(() => applyPromptRules('test', baseContext, rules)).toThrow('match must not be empty');
    });

    it('should throw error for replace without match or regex', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'bad-replace',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace', replacement: 'test' } as any],
        },
      ];

      expect(() => applyPromptRules('test', baseContext, rules)).toThrow(
        'must provide match or regex',
      );
    });

    it('should throw error for delete without match or regex', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'bad-delete',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'delete' } as any],
        },
      ];

      expect(() => applyPromptRules('test', baseContext, rules)).toThrow(
        'must provide match or regex',
      );
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle regex with capture groups in replace', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'capture-groups',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace', regex: '(\\w+)\\s+(\\w+)', replacement: '$2, $1' }],
        },
      ];

      const result = applyPromptRules('hello world', baseContext, rules);
      expect(result.text).toBe('world, hello');
    });

    it('should handle multiple insert operations', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'multi-insert',
          when: { client: 'claude', field: 'system' },
          ops: [
            { type: 'insert_before', regex: 'A', text: 'X' },
            { type: 'insert_after', regex: 'B', text: 'Y' },
          ],
        },
      ];

      const result = applyPromptRules('A B', baseContext, rules);
      expect(result.text).toBe('XA BY');
    });

    it('should handle empty input', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'empty-input',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: 'added' }],
        },
      ];

      const result = applyPromptRules('', baseContext, rules);
      expect(result.text).toBe('added');
    });

    it('should handle special characters in text', () => {
      const rules: PromptxyRule[] = [
        {
          id: 'special-chars',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace', match: 'test', replacement: '$pecial @chars!' }],
        },
      ];

      const result = applyPromptRules('This is test text', baseContext, rules);
      expect(result.text).toBe('This is $pecial @chars! text');
    });
  });

  describe('Different Clients', () => {
    it('should work with codex client', () => {
      const codexContext: PromptxyRequestContext = {
        client: 'codex',
        field: 'instructions',
        method: 'POST',
        path: '/v1/responses',
      };

      const rules: PromptxyRule[] = [
        {
          id: 'codex-rule',
          when: { client: 'codex', field: 'instructions' },
          ops: [{ type: 'append', text: ' codex' }],
        },
      ];

      const result = applyPromptRules('base', codexContext, rules);
      expect(result.text).toBe('base codex');
    });

    it('should work with gemini client', () => {
      const geminiContext: PromptxyRequestContext = {
        client: 'gemini',
        field: 'system',
        method: 'POST',
        path: '/v1beta/models/gemini-pro:generateContent',
      };

      const rules: PromptxyRule[] = [
        {
          id: 'gemini-rule',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' gemini' }],
        },
      ];

      const result = applyPromptRules('base', geminiContext, rules);
      expect(result.text).toBe('base gemini');
    });
  });
});
