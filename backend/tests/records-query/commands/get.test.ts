import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getValue } from '../../../src/records-query/commands/get';
import * as loader from '../../../src/records-query/loader';
import type { ParsedRecord } from '../../../src/records-query/types';

vi.mock('../../../src/records-query/loader');

describe('get', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应该获取指定路径的值', () => {
    const mockRecord: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: {
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'hello' }]
      },
      modifiedBody: {},
      matchedRules: []
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getValue('req-1', { path: 'originalBody.model' });

    expect(result).toBe('claude-3-5-sonnet');
  });

  it('应该支持嵌套路径', () => {
    const mockRecord: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: {
        messages: [{ role: 'user', content: 'hello' }]
      },
      modifiedBody: {},
      matchedRules: []
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getValue('req-1', { path: 'originalBody.messages[0].role' });

    expect(result).toBe('user');
  });

  it('当记录不存在时应该抛出错误', () => {
    vi.mocked(loader.loadRecord).mockReturnValue(null);

    expect(() => getValue('non-existent', { path: 'originalBody' })).toThrow('Record not found: non-existent');
  });

  it('应该截断长字符串', () => {
    const longContent = 'a'.repeat(1000);
    const mockRecord: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: {
        content: longContent
      },
      modifiedBody: {},
      matchedRules: []
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getValue('req-1', { path: 'originalBody.content', truncate: 100 });

    expect(typeof result).toBe('string');
    expect((result as string).length).toBeLessThan(longContent.length);
    expect((result as string)).toContain('more chars');
  });

  it('应该支持 summary 格式', () => {
    const mockRecord: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: {
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi' }
        ]
      },
      modifiedBody: {},
      matchedRules: []
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getValue('req-1', { path: 'originalBody.messages', format: 'summary' });

    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('roles');
  });
});
