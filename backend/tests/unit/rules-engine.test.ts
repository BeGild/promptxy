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
          uuid: 'set-rule',
          name: 'set-rule',
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
          uuid: 'append-rule',
          name: 'append-rule',
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
          uuid: 'prepend-rule',
          name: 'prepend-rule',
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
          uuid: 'replace-rule',
          name: 'replace-rule',
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
          uuid: 'replace-regex',
          name: 'replace-regex',
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
          uuid: 'delete-rule',
          name: 'delete-rule',
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
          uuid: 'delete-regex',
          name: 'delete-regex',
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
          uuid: 'insert-before',
          name: 'insert-before',
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
          uuid: 'insert-after',
          name: 'insert-after',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'insert_after', regex: 'target', text: '-AFTER' }],
        },
      ];

      const result = applyPromptRules('Find target here', baseContext, rules);
      expect(result.text).toBe('Find target-AFTER here');
    });

    // 测试用户报告的场景：XXX pattern + yyy text
    it('should apply insert_before with XXX pattern correctly', () => {
      const rules: PromptxyRule[] = [
        {
          uuid: 'test-xxx',
          name: 'test-xxx',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'insert_before', regex: 'XXX', text: 'yyy' }],
        },
      ];

      // 用户场景：输入是 XXX，匹配 XXX，在前面插入 yyy
      const result = applyPromptRules('XXX world', baseContext, rules);
      // 预期：yyyXXX world（XXX 被保留，在前面插入 yyy）
      expect(result.text).toBe('yyyXXX world');
      // 确认 XXX 没有被删除
      expect(result.text).toContain('XXX');
    });

    // 测试用户的具体规则场景：匹配 # Code References 前插内容
    it('should apply insert_before for # Code References correctly', () => {
      const rules: PromptxyRule[] = [
        {
          uuid: 'test-code-references',
          name: 'test-code-references',
          when: { client: 'claude', field: 'system' },
          ops: [
            {
              type: 'insert_before',
              regex: '^# Code References\\b',
              flags: 'im',
              text: '# Core Mandates\n\n1. Cross-Compilation\n2. Build-Driven Development\n',
            },
          ],
        },
      ];

      const inputText = 'Some content\n# Code References\nSome more content';
      const result = applyPromptRules(inputText, baseContext, rules);

      // 验证插入的内容存在
      expect(result.text).toContain('# Core Mandates');
      // 验证原始的 # Code References 仍然存在（没有被替换）
      expect(result.text).toContain('# Code References');
      // 验证插入的内容在 # Code References 之前
      const coreMandatesIndex = result.text.indexOf('# Core Mandates');
      const codeReferencesIndex = result.text.indexOf('# Code References');
      expect(coreMandatesIndex).toBeLessThan(codeReferencesIndex);
      // 验证原始内容仍然存在
      expect(result.text).toContain('Some content');
      expect(result.text).toContain('Some more content');
    });
  });

  describe('Multiple Operations', () => {
    it('should apply multiple operations in sequence', () => {
      const rules: PromptxyRule[] = [
        {
          uuid: 'multi-op',
          name: 'multi-op',
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
          uuid: 'rule-1',
          name: 'rule-1',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' +1' }],
        },
        {
          uuid: 'rule-2',
          name: 'rule-2',
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
          uuid: 'claude-only',
          name: 'claude-only',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' claude' }],
        },
        {
          uuid: 'codex-only',
          name: 'codex-only',
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
          uuid: 'system-field',
          name: 'system-field',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' system' }],
        },
        {
          uuid: 'instructions-field',
          name: 'instructions-field',
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
          uuid: 'path-rule',
          name: 'path-rule',
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
          uuid: 'path-rule',
          name: 'path-rule',
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
          uuid: 'model-rule',
          name: 'model-rule',
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
          uuid: 'method-rule',
          name: 'method-rule',
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
          uuid: 'method-rule',
          name: 'method-rule',
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
          uuid: 'enabled',
          name: 'enabled',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: ' enabled' }],
        },
        {
          uuid: 'disabled',
          name: 'disabled',
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
          uuid: 'stop-rule',
          name: 'stop-rule',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'set', text: 'stopped' }],
          stop: true,
        },
        {
          uuid: 'should-not-run',
          name: 'should-not-run',
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
          uuid: 'case-insensitive',
          name: 'case-insensitive',
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
          uuid: 'multiline',
          name: 'multiline',
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
          uuid: 'invalid-regex',
          name: 'invalid-regex',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace', regex: '[invalid', replacement: 'test' }],
        },
      ];

      expect(() => applyPromptRules('test', baseContext, rules)).toThrow('invalid regex');
    });

    it('should throw error for empty match in replace', () => {
      const rules: PromptxyRule[] = [
        {
          uuid: 'empty-match',
          name: 'empty-match',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace', match: '', replacement: 'test' }],
        },
      ];

      expect(() => applyPromptRules('test', baseContext, rules)).toThrow('match must not be empty');
    });

    it('should throw error for empty match in delete', () => {
      const rules: PromptxyRule[] = [
        {
          uuid: 'empty-delete',
          name: 'empty-delete',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'delete', match: '' }],
        },
      ];

      expect(() => applyPromptRules('test', baseContext, rules)).toThrow('match must not be empty');
    });

    it('should throw error for replace without match or regex', () => {
      const rules: PromptxyRule[] = [
        {
          uuid: 'bad-replace',
          name: 'bad-replace',
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
          uuid: 'bad-delete',
          name: 'bad-delete',
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
          uuid: 'capture-groups',
          name: 'capture-groups',
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
          uuid: 'multi-insert',
          name: 'multi-insert',
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
          uuid: 'empty-input',
          name: 'empty-input',
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
          uuid: 'special-chars',
          name: 'special-chars',
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
          uuid: 'codex-rule',
          name: 'codex-rule',
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
          uuid: 'gemini-rule',
          name: 'gemini-rule',
          when: { client: 'gemini', field: 'system' },
          ops: [{ type: 'append', text: ' gemini' }],
        },
      ];

      const result = applyPromptRules('base', geminiContext, rules);
      expect(result.text).toBe('base gemini');
    });
  });
});
