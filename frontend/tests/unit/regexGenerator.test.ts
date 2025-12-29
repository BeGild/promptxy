import { describe, it, expect } from 'vitest';
import { RegexGenerator, MatchMode } from '@/utils/regexGenerator';

describe('RegexGenerator', () => {
  describe('escapeRegex', () => {
    it('应该转义正则特殊字符', () => {
      expect(RegexGenerator.escapeRegex('a?b')).toBe('a\\?b');
      expect(RegexGenerator.escapeRegex('test*')).toBe('test\\*');
      expect(RegexGenerator.escapeRegex('(group)')).toBe('\\(group\\)');
      expect(RegexGenerator.escapeRegex('[0-9]')).toBe('\\[0-9\\]');
      expect(RegexGenerator.escapeRegex('{count}')).toBe('\\{count\\}');
      expect(RegexGenerator.escapeRegex('^start')).toBe('\\^start');
      expect(RegexGenerator.escapeRegex('end$')).toBe('end\\$');
      expect(RegexGenerator.escapeRegex('a|b')).toBe('a\\|b');
      expect(RegexGenerator.escapeRegex('path\\file')).toBe('path\\\\file');
      expect(RegexGenerator.escapeRegex('dot.test')).toBe('dot\\.test');
    });

    it('应该保留普通字符不变', () => {
      expect(RegexGenerator.escapeRegex('abc123')).toBe('abc123');
      expect(RegexGenerator.escapeRegex('gpt-4')).toBe('gpt-4');
    });

    it('应该处理包含换行符的文本', () => {
      const textWithNewline = 'line1\nline2';
      expect(RegexGenerator.escapeRegex(textWithNewline)).toBe(textWithNewline);
    });
  });

  describe('generateExactMatch', () => {
    it('应该生成完整匹配正则表达式', () => {
      const result = RegexGenerator.generateExactMatch('gpt-4');
      expect(result.pattern).toBe('^gpt-4$');
      expect(result.flags).toBe('');
      expect(result.display).toBe('^gpt-4$');

      const result2 = RegexGenerator.generateExactMatch('claude-3-opus');
      expect(result2.pattern).toBe('^claude-3-opus$');
    });

    it('应该转义特殊字符', () => {
      const result = RegexGenerator.generateExactMatch('test.file');
      expect(result.pattern).toBe('^test\\.file$');

      const result2 = RegexGenerator.generateExactMatch('a?b');
      expect(result2.pattern).toBe('^a\\?b$');
    });

    it('应该支持忽略大小写', () => {
      const result = RegexGenerator.generateExactMatch('GPT-4', true);
      expect(result.pattern).toBe('^GPT-4$');
      expect(result.flags).toBe('i');
      expect(result.display).toBe('/^GPT-4$/i');
    });

    it('应该处理包含换行符的文本', () => {
      const text = 'line1\nline2';
      const result = RegexGenerator.generateExactMatch(text);
      expect(result.pattern).toBe(`^${text}$`);
    });
  });

  describe('generatePrefixMatch', () => {
    it('应该生成前缀匹配正则表达式', () => {
      const result = RegexGenerator.generatePrefixMatch('claude-');
      expect(result.pattern).toBe('^claude-');
      expect(result.flags).toBe('');

      const result2 = RegexGenerator.generatePrefixMatch('gpt');
      expect(result2.pattern).toBe('^gpt');
    });

    it('应该转义特殊字符', () => {
      const result = RegexGenerator.generatePrefixMatch('test.');
      expect(result.pattern).toBe('^test\\.');
    });

    it('应该支持忽略大小写', () => {
      const result = RegexGenerator.generatePrefixMatch('CLAUDE-', true);
      expect(result.pattern).toBe('^CLAUDE-');
      expect(result.flags).toBe('i');
      expect(result.display).toBe('/^CLAUDE-/i');
    });
  });

  describe('generateSuffixMatch', () => {
    it('应该生成后缀匹配正则表达式', () => {
      const result = RegexGenerator.generateSuffixMatch('-opus');
      expect(result.pattern).toBe('-opus$');

      const result2 = RegexGenerator.generateSuffixMatch('2024');
      expect(result2.pattern).toBe('2024$');
    });

    it('应该转义特殊字符', () => {
      const result = RegexGenerator.generateSuffixMatch('.txt');
      expect(result.pattern).toBe('\\.txt$');
    });

    it('应该支持忽略大小写', () => {
      const result = RegexGenerator.generateSuffixMatch('-OPUS', true);
      expect(result.pattern).toBe('-OPUS$');
      expect(result.flags).toBe('i');
      expect(result.display).toBe('/-OPUS$/i');
    });
  });

  describe('generateContainsMatch', () => {
    it('应该生成包含匹配正则表达式', () => {
      const result = RegexGenerator.generateContainsMatch('2024');
      expect(result.pattern).toBe('2024');

      const result2 = RegexGenerator.generateContainsMatch('opus');
      expect(result2.pattern).toBe('opus');
    });

    it('应该转义特殊字符', () => {
      const result = RegexGenerator.generateContainsMatch('a.b');
      expect(result.pattern).toBe('a\\.b');
    });

    it('应该支持忽略大小写', () => {
      const result = RegexGenerator.generateContainsMatch('GPT', true);
      expect(result.pattern).toBe('GPT');
      expect(result.flags).toBe('i');
      expect(result.display).toBe('/GPT/i');
    });
  });

  describe('generateWholeWordMatch', () => {
    it('英文文本应该使用 \\b 单词边界', () => {
      const result = RegexGenerator.generateWholeWordMatch('gpt');
      expect(result.pattern).toBe('\\bgpt\\b');

      const result2 = RegexGenerator.generateWholeWordMatch('gpt-4');
      expect(result2.pattern).toBe('\\bgpt-4\\b');
    });

    it('中文文本不应该使用 \\b 边界', () => {
      const result = RegexGenerator.generateWholeWordMatch('你好');
      expect(result.pattern).toBe('你好');

      const result2 = RegexGenerator.generateWholeWordMatch('测试');
      expect(result2.pattern).toBe('测试');
    });

    it('中日韩混合文本不应该使用 \\b 边界', () => {
      const result = RegexGenerator.generateWholeWordMatch('测试test');
      expect(result.pattern).toBe('测试test');

      const result2 = RegexGenerator.generateWholeWordMatch('こんにちは');
      expect(result2.pattern).toBe('こんにちは');
    });

    it('应该转义特殊字符', () => {
      const result = RegexGenerator.generateWholeWordMatch('test.file');
      expect(result.pattern).toBe('\\btest\\.file\\b');
    });

    it('应该支持忽略大小写', () => {
      const result = RegexGenerator.generateWholeWordMatch('GPT', true);
      expect(result.pattern).toBe('\\bGPT\\b');
      expect(result.flags).toBe('i');
      expect(result.display).toBe('/\\bGPT\\b/i');
    });
  });

  describe('generateRegex (主函数)', () => {
    it('应该根据不同模式生成正确的正则表达式', () => {
      const text = 'gpt-4';

      const exact = RegexGenerator.generateRegex(text, MatchMode.EXACT);
      expect(exact.pattern).toBe('^gpt-4$');

      const prefix = RegexGenerator.generateRegex(text, MatchMode.PREFIX);
      expect(prefix.pattern).toBe('^gpt-4');

      const suffix = RegexGenerator.generateRegex(text, MatchMode.SUFFIX);
      expect(suffix.pattern).toBe('gpt-4$');

      const contains = RegexGenerator.generateRegex(text, MatchMode.CONTAINS);
      expect(contains.pattern).toBe('gpt-4');

      const wholeWord = RegexGenerator.generateRegex(text, MatchMode.WHOLE_WORD);
      expect(wholeWord.pattern).toBe('\\bgpt-4\\b');
    });

    it('应该正确处理基于当前请求模式', () => {
      const result = RegexGenerator.generateRegex('any', MatchMode.BASED_ON_REQUEST);
      expect(result.pattern).toBe('');
      expect(result.flags).toBe('');
      expect(result.display).toBe('');
    });

    it('应该支持忽略大小写选项', () => {
      const exact = RegexGenerator.generateRegex('GPT-4', MatchMode.EXACT, true);
      expect(exact.pattern).toBe('^GPT-4$');
      expect(exact.flags).toBe('i');

      const wholeWord = RegexGenerator.generateRegex('GPT-4', MatchMode.WHOLE_WORD, true);
      expect(wholeWord.pattern).toBe('\\bGPT-4\\b');
      expect(wholeWord.flags).toBe('i');
    });

    it('应该处理默认模式（完整匹配）', () => {
      // @ts-ignore - 测试无效模式
      const result = RegexGenerator.generateRegex('test', 'invalid');
      expect(result.pattern).toBe('^test$');
    });
  });

  describe('getMatchModeLabel', () => {
    it('应该返回正确的中文标签', () => {
      expect(RegexGenerator.getMatchModeLabel(MatchMode.EXACT)).toBe('完整匹配');
      expect(RegexGenerator.getMatchModeLabel(MatchMode.PREFIX)).toBe('前缀匹配');
      expect(RegexGenerator.getMatchModeLabel(MatchMode.SUFFIX)).toBe('后缀匹配');
      expect(RegexGenerator.getMatchModeLabel(MatchMode.CONTAINS)).toBe('包含匹配');
      expect(RegexGenerator.getMatchModeLabel(MatchMode.WHOLE_WORD)).toBe('全词语匹配');
      expect(RegexGenerator.getMatchModeLabel(MatchMode.BASED_ON_REQUEST)).toBe('基于当前请求');
    });
  });

  describe('getMatchModeDescription', () => {
    it('应该返回正确的描述文本', () => {
      expect(RegexGenerator.getMatchModeDescription(MatchMode.EXACT)).toBe(
        '匹配完整文本，如 "^gpt-4$"',
      );
      expect(RegexGenerator.getMatchModeDescription(MatchMode.PREFIX)).toBe(
        '匹配开头部分，如 "^claude-"',
      );
      expect(RegexGenerator.getMatchModeDescription(MatchMode.SUFFIX)).toBe(
        '匹配结尾部分，如 "-2024$"',
      );
      expect(RegexGenerator.getMatchModeDescription(MatchMode.CONTAINS)).toBe(
        '匹配包含该文本，如 "2024"',
      );
      expect(RegexGenerator.getMatchModeDescription(MatchMode.WHOLE_WORD)).toBe(
        '匹配完整词语（英文使用\\b边界）',
      );
    });
  });

  describe('isValidRegex', () => {
    it('应该验证有效的正则表达式', () => {
      expect(RegexGenerator.isValidRegex('^test$')).toBe(true);
      expect(RegexGenerator.isValidRegex('\\btest\\b')).toBe(true);
      expect(RegexGenerator.isValidRegex('^test$', 'i')).toBe(true);
    });

    it('应该拒绝无效的正则表达式', () => {
      expect(RegexGenerator.isValidRegex('^unclosed(')).toBe(false);
      expect(RegexGenerator.isValidRegex('[unclosed')).toBe(false);
    });

    it('应该接受空字符串', () => {
      expect(RegexGenerator.isValidRegex('')).toBe(true);
    });
  });

  describe('toBackendFormat', () => {
    it('应该将 RegexResult 转换为后端格式', () => {
      const withFlags = { pattern: '^test$', flags: 'i', display: '/^test$/i' };
      expect(RegexGenerator.toBackendFormat(withFlags)).toBe('/^test$/i');

      const withoutFlags = { pattern: '^test$', flags: '', display: '^test$' };
      expect(RegexGenerator.toBackendFormat(withoutFlags)).toBe('^test$');
    });
  });

  describe('fromBackendFormat', () => {
    it('应该解析后端格式为 RegexResult', () => {
      const result1 = RegexGenerator.fromBackendFormat('/^test$/i');
      expect(result1.pattern).toBe('^test$');
      expect(result1.flags).toBe('i');
      expect(result1.display).toBe('/^test$/i');

      const result2 = RegexGenerator.fromBackendFormat('^test$');
      expect(result2.pattern).toBe('^test$');
      expect(result2.flags).toBe('');
      expect(result2.display).toBe('^test$');
    });
  });
});
