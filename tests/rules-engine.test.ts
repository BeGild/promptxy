import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPromptRules } from '../src/promptxy/rules/engine.js';
import { PromptxyRequestContext, PromptxyRule } from '../src/promptxy/types.js';

const baseCtx: PromptxyRequestContext = {
  client: 'codex',
  field: 'instructions',
  method: 'POST',
  path: '/v1/responses',
};

test('rules: no-op when no rules match', () => {
  const rules: PromptxyRule[] = [
    {
      id: 'only-claude',
      when: { client: 'claude', field: 'system' },
      ops: [{ type: 'append', text: 'x' }],
    },
  ];

  const result = applyPromptRules('hello', baseCtx, rules);
  assert.equal(result.text, 'hello');
  assert.deepEqual(result.matches, []);
});

test('rules: ordered ops (replace then append)', () => {
  const rules: PromptxyRule[] = [
    {
      id: 'r1',
      when: { client: 'codex', field: 'instructions' },
      ops: [
        { type: 'replace', match: 'world', replacement: 'there' },
        { type: 'append', text: '!' },
      ],
    },
  ];

  const result = applyPromptRules('hello world', baseCtx, rules);
  assert.equal(result.text, 'hello there!');
  assert.deepEqual(
    result.matches.map(m => m.ruleId),
    ['r1', 'r1'],
  );
});

test('rules: regex delete', () => {
  const rules: PromptxyRule[] = [
    {
      id: 'r1',
      when: { client: 'codex', field: 'instructions' },
      ops: [{ type: 'delete', regex: '\\s+', flags: 'g' }],
    },
  ];

  const result = applyPromptRules('a  b\tc\n', baseCtx, rules);
  assert.equal(result.text, 'abc');
});

test('rules: insert_after regex', () => {
  const rules: PromptxyRule[] = [
    {
      id: 'r1',
      when: { client: 'codex', field: 'instructions' },
      ops: [{ type: 'insert_after', regex: '^hello', flags: 'm', text: '!' }],
    },
  ];

  const result = applyPromptRules('hello world', baseCtx, rules);
  assert.equal(result.text, 'hello! world');
});
