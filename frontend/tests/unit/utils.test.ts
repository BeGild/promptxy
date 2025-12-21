/**
 * 工具函数测试
 * 覆盖 formatter.ts, validator.ts, diff.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatTime,
  formatRelativeTime,
  formatBytes,
  formatJSON,
  formatDuration,
  truncate,
  formatClient,
  formatStatus,
  getStatusColor,
  generateUUID,
} from '@/utils/formatter';
import {
  validateRule,
  validateRegex,
  checkRuleConflicts,
  createDefaultRule,
} from '@/utils/validator';
import {
  generateJSONDiff,
  generateLineDiff,
  highlightDiff,
  formatJSONWithPath,
} from '@/utils/diff';
import type { PromptxyRule, PromptxyOp } from '@/types';

describe('Formatter Utils', () => {
  describe('formatTime', () => {
    it('应该正确格式化今天的时间', () => {
      const now = new Date();
      const timestamp = now.getTime();
      const result = formatTime(timestamp);
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('应该正确格式化今年的时间', () => {
      const date = new Date();
      date.setMonth(0); // 一月
      date.setDate(15);
      const timestamp = date.getTime();
      const result = formatTime(timestamp);
      expect(result).toMatch(/\d{1,2}月\s*\d{1,2}日/);
    });

    it('应该正确格式化往年的时间', () => {
      const date = new Date('2020-01-15T10:30:00');
      const timestamp = date.getTime();
      const result = formatTime(timestamp);
      expect(result).toContain('2020');
    });
  });

  describe('formatRelativeTime', () => {
    it('应该返回"刚刚"对于小于1秒的差异', () => {
      const timestamp = Date.now() - 500;
      expect(formatRelativeTime(timestamp)).toBe('刚刚');
    });

    it('应该返回秒数对于小于1分钟的差异', () => {
      const timestamp = Date.now() - 30000; // 30秒
      expect(formatRelativeTime(timestamp)).toBe('30秒前');
    });

    it('应该返回分钟数对于小于1小时的差异', () => {
      const timestamp = Date.now() - 120000; // 2分钟
      expect(formatRelativeTime(timestamp)).toBe('2分钟前');
    });

    it('应该返回小时数对于小于1天的差异', () => {
      const timestamp = Date.now() - 7200000; // 2小时
      expect(formatRelativeTime(timestamp)).toBe('2小时前');
    });

    it('应该返回天数对于小于1周的差异', () => {
      const timestamp = Date.now() - 172800000; // 2天
      expect(formatRelativeTime(timestamp)).toBe('2天前');
    });
  });

  describe('formatBytes', () => {
    it('应该正确格式化0字节', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('应该正确格式化字节', () => {
      expect(formatBytes(512)).toBe('0.50 KB');
    });

    it('应该正确格式化KB', () => {
      expect(formatBytes(1024)).toBe('1.00 KB');
    });

    it('应该正确格式化MB', () => {
      expect(formatBytes(1048576)).toBe('1.00 MB');
    });

    it('应该正确格式化GB', () => {
      expect(formatBytes(1073741824)).toBe('1.00 GB');
    });
  });

  describe('formatJSON', () => {
    it('应该正确格式化JSON对象', () => {
      const obj = { a: 1, b: 2 };
      const result = formatJSON(obj);
      expect(result).toContain('"a": 1');
      expect(result).toContain('"b": 2');
    });

    it('应该处理无效JSON', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      const result = formatJSON(circular);
      expect(result).toBe('[object Object]');
    });

    it('应该处理非对象输入', () => {
      expect(formatJSON('test')).toBe('test');
      expect(formatJSON(123)).toBe('123');
    });
  });

  describe('formatDuration', () => {
    it('应该格式化毫秒', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('应该格式化秒', () => {
      expect(formatDuration(1500)).toBe('1.50s');
    });

    it('应该格式化分钟', () => {
      expect(formatDuration(120000)).toBe('2.00m');
    });
  });

  describe('truncate', () => {
    it('应该截断过长的字符串', () => {
      const str = '这是一个很长的字符串';
      expect(truncate(str, 5)).toBe('这是一个...');
    });

    it('不应该截断短字符串', () => {
      const str = '短';
      expect(truncate(str, 10)).toBe('短');
    });

    it('应该使用自定义后缀', () => {
      const str = '很长的字符串';
      expect(truncate(str, 5, '>>')).toBe('很长>>');
    });

    it('应该处理空字符串', () => {
      expect(truncate('', 10)).toBe('');
    });
  });

  describe('formatClient', () => {
    it('应该格式化已知客户端', () => {
      expect(formatClient('claude')).toBe('Claude');
      expect(formatClient('codex')).toBe('Codex');
      expect(formatClient('gemini')).toBe('Gemini');
    });

    it('应该返回未知客户端原值', () => {
      expect(formatClient('unknown')).toBe('unknown');
    });
  });

  describe('formatStatus', () => {
    it('应该正确格式化成功状态码', () => {
      expect(formatStatus(200)).toBe('200 ✓');
      expect(formatStatus(201)).toBe('201 ✓');
    });

    it('应该正确格式化错误状态码', () => {
      expect(formatStatus(400)).toBe('400 ✗');
      expect(formatStatus(500)).toBe('500 ✗');
    });

    it('应该正确格式化其他状态码', () => {
      expect(formatStatus(301)).toBe('301');
    });

    it('应该处理未定义状态码', () => {
      expect(formatStatus(undefined)).toBe('N/A');
    });
  });

  describe('getStatusColor', () => {
    it('应该返回成功颜色', () => {
      expect(getStatusColor(200)).toBe('success');
      expect(getStatusColor(299)).toBe('success');
    });

    it('应该返回警告颜色', () => {
      expect(getStatusColor(300)).toBe('warning');
      expect(getStatusColor(399)).toBe('warning');
    });

    it('应该返回危险颜色', () => {
      expect(getStatusColor(400)).toBe('danger');
      expect(getStatusColor(500)).toBe('danger');
    });

    it('应该返回默认颜色', () => {
      expect(getStatusColor(undefined)).toBe('default');
      expect(getStatusColor(0)).toBe('default');
    });
  });

  describe('generateUUID', () => {
    it('应该生成符合UUID格式的字符串', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('应该生成不同的UUID', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });
});

describe('Validator Utils', () => {
  describe('validateRule', () => {
    let validRule: PromptxyRule;

    beforeEach(() => {
      validRule = {
        id: 'test-rule',
        description: '测试规则',
        when: {
          client: 'claude',
          field: 'system',
        },
        ops: [{ type: 'append', text: 'test' }],
        enabled: true,
      };
    });

    it('应该验证有效的规则', () => {
      const result = validateRule(validRule);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺少ID', () => {
      const rule = { ...validRule, id: '' };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('规则ID是必需的');
    });

    it('应该检测缺少when条件', () => {
      const rule = { ...validRule, when: undefined as any };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('when 条件是必需的');
    });

    it('应该检测缺少客户端类型', () => {
      const rule = { ...validRule, when: { field: 'system' } as any };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('客户端类型是必需的');
    });

    it('应该检测缺少字段类型', () => {
      const rule = { ...validRule, when: { client: 'claude' } as any };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('字段类型是必需的');
    });

    it('应该检测空操作序列', () => {
      const rule = { ...validRule, ops: [] };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('操作序列不能为空');
    });

    it('应该验证操作格式', () => {
      const rule = { ...validRule, ops: [{ type: 'invalid' }] as any };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('操作 1: 不支持的操作类型: invalid');
    });

    it('应该检测未指定启用状态的警告', () => {
      const rule = { ...validRule, enabled: undefined };
      const result = validateRule(rule);
      expect(result.warnings).toContain('未指定启用状态，默认启用');
    });

    it('应该验证replace操作需要match或regex', () => {
      const rule: PromptxyRule = {
        id: 'test',
        when: { client: 'claude', field: 'system' },
        ops: [{ type: 'replace', replacement: 'new' }] as any,
      };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('操作 1: 需要 match 或 regex');
    });

    it('应该验证delete操作需要match或regex', () => {
      const rule: PromptxyRule = {
        id: 'test',
        when: { client: 'claude', field: 'system' },
        ops: [{ type: 'delete' }] as any,
      };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('操作 1: 需要 match 或 regex');
    });

    it('应该验证insert_before操作需要regex和text', () => {
      const rule: PromptxyRule = {
        id: 'test',
        when: { client: 'claude', field: 'system' },
        ops: [{ type: 'insert_before', regex: 'test' }] as any,
      };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('操作 1: 需要 text');
    });

    it('应该验证正则表达式语法', () => {
      const rule: PromptxyRule = {
        id: 'test',
        when: { client: 'claude', field: 'system' },
        ops: [{ type: 'replace', regex: '[invalid', replacement: 'new' }] as any,
      };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('正则表达式无效');
    });
  });

  describe('validateRegex', () => {
    it('应该验证有效的正则表达式', () => {
      const result = validateRegex('test', 'gi');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该检测无效的正则表达式', () => {
      const result = validateRegex('[invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('checkRuleConflicts', () => {
    const existingRules: PromptxyRule[] = [
      {
        id: 'rule-1',
        when: { client: 'claude', field: 'system', method: 'POST' },
        ops: [{ type: 'append', text: 'test' }],
      },
      {
        id: 'rule-2',
        when: { client: 'claude', field: 'instructions' },
        ops: [{ type: 'set', text: 'new' }],
      },
    ];

    it('应该检测相同条件的冲突', () => {
      const newRule: PromptxyRule = {
        id: 'rule-3',
        when: { client: 'claude', field: 'system', method: 'POST' },
        ops: [{ type: 'append', text: 'another' }],
      };
      const conflicts = checkRuleConflicts(existingRules, newRule);
      expect(conflicts).toContain('与规则 rule-1 的条件相同');
    });

    it('应该忽略自身', () => {
      const newRule: PromptxyRule = {
        id: 'rule-1',
        when: { client: 'claude', field: 'system', method: 'POST' },
        ops: [{ type: 'append', text: 'test' }],
      };
      const conflicts = checkRuleConflicts(existingRules, newRule);
      expect(conflicts).toHaveLength(0);
    });

    it('应该返回空数组如果没有冲突', () => {
      const newRule: PromptxyRule = {
        id: 'rule-3',
        when: { client: 'gemini', field: 'system' },
        ops: [{ type: 'append', text: 'test' }],
      };
      const conflicts = checkRuleConflicts(existingRules, newRule);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('createDefaultRule', () => {
    it('应该创建具有默认值的规则', () => {
      const rule = createDefaultRule();
      expect(rule.id).toMatch(/^rule-\d+$/);
      expect(rule.description).toBe('');
      expect(rule.when.client).toBe('claude');
      expect(rule.when.field).toBe('system');
      expect(rule.ops).toHaveLength(1);
      expect(rule.ops[0].type).toBe('append');
      expect(rule.enabled).toBe(true);
    });
  });
});

describe('Diff Utils', () => {
  describe('generateJSONDiff', () => {
    it('应该检测相同的值', () => {
      const diff = generateJSONDiff('test', 'test');
      expect(diff).toHaveLength(1);
      expect(diff[0].type).toBe('same');
      expect(diff[0].left).toBe('"test"');
    });

    it('应该检测修改的值', () => {
      const diff = generateJSONDiff('old', 'new');
      expect(diff).toHaveLength(1);
      expect(diff[0].type).toBe('modified');
    });

    it('应该检测添加的数组元素', () => {
      const diff = generateJSONDiff([1], [1, 2]);
      expect(diff).toHaveLength(3); // 1, 2, and added 2
      expect(diff[1].type).toBe('same');
      expect(diff[2].type).toBe('added');
    });

    it('应该检测删除的数组元素', () => {
      const diff = generateJSONDiff([1, 2], [1]);
      expect(diff).toHaveLength(3); // 1, 2, and removed 2
      expect(diff[1].type).toBe('same');
      expect(diff[2].type).toBe('removed');
    });

    it('应该检测添加的对象字段', () => {
      const diff = generateJSONDiff({ a: 1 }, { a: 1, b: 2 });
      expect(diff).toHaveLength(2);
      expect(diff[1].type).toBe('added');
      expect(diff[1].path).toBe('b');
    });

    it('应该检测删除的对象字段', () => {
      const diff = generateJSONDiff({ a: 1, b: 2 }, { a: 1 });
      expect(diff).toHaveLength(2);
      expect(diff[1].type).toBe('removed');
      expect(diff[1].path).toBe('b');
    });

    it('应该处理嵌套对象', () => {
      const diff = generateJSONDiff(
        { user: { name: 'John', age: 30 } },
        { user: { name: 'John', age: 31 } },
      );
      expect(diff).toHaveLength(3); // user, user.name, user.age
      const ageDiff = diff.find(d => d.path === 'user.age');
      expect(ageDiff?.type).toBe('modified');
    });

    it('应该处理null和undefined', () => {
      const diff1 = generateJSONDiff(null, null);
      expect(diff1[0].type).toBe('same');

      const diff2 = generateJSONDiff(undefined, null);
      expect(diff2[0].type).toBe('modified');
    });
  });

  describe('generateLineDiff', () => {
    it('应该生成行级差异', () => {
      const result = generateLineDiff('line1\nline2', 'line1\nline3');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('  line1');
      expect(result[1]).toBe('- line2');
      expect(result[2]).toBe('+ line3');
    });

    it('应该处理添加的行', () => {
      const result = generateLineDiff('line1', 'line1\nline2');
      expect(result).toHaveLength(2);
      expect(result[1]).toBe('+ line2');
    });

    it('应该处理删除的行', () => {
      const result = generateLineDiff('line1\nline2', 'line1');
      expect(result).toHaveLength(2);
      expect(result[1]).toBe('- line2');
    });
  });

  describe('highlightDiff', () => {
    it('应该高亮显示差异', () => {
      const diff = [
        { type: 'same' as const, left: 'a', right: 'a', path: 'field' },
        { type: 'removed' as const, left: 'old', path: 'field' },
        { type: 'added' as const, right: 'new', path: 'field' },
        { type: 'modified' as const, left: 'old', right: 'new', path: 'field' },
      ];
      const result = highlightDiff(diff);
      expect(result.left).toHaveLength(4);
      expect(result.right).toHaveLength(4);
      expect(result.left[1]).toContain('-');
      expect(result.right[2]).toContain('+');
    });
  });

  describe('formatJSONWithPath', () => {
    it('应该格式化JSON并高亮指定路径', () => {
      const obj = { user: { name: 'John', age: 30 } };
      const result = formatJSONWithPath(obj, ['user.name']);
      expect(result).toContain('>>>\"John\"<<<');
      expect(result).toContain('30');
    });

    it('应该处理数组', () => {
      const obj = { items: [1, 2, 3] };
      const result = formatJSONWithPath(obj, ['items[1]']);
      expect(result).toContain('>>>2<<<');
    });

    it('应该处理空对象和数组', () => {
      expect(formatJSONWithPath({})).toBe('{}');
      expect(formatJSONWithPath([])).toBe('[]');
    });

    it('应该处理基本类型', () => {
      expect(formatJSONWithPath(null)).toBe('null');
      expect(formatJSONWithPath(undefined)).toBe('undefined');
      expect(formatJSONWithPath('test')).toBe('\"test\"');
      expect(formatJSONWithPath(123)).toBe('123');
    });
  });
});
