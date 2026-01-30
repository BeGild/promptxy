import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStructure } from '../../../src/records-query/commands/structure';
import * as loader from '../../../src/records-query/loader';
import type { ParsedRecord } from '../../../src/records-query/types';

vi.mock('../../../src/records-query/loader');

describe('structure', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应该返回请求结构', () => {
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
      modifiedBody: {
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'hello' }]
      },
      matchedRules: []
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getStructure('req-1');

    expect(result.requestId).toBe('req-1');
    expect(result.structure.originalBody).toBeDefined();
    expect(result.structure.originalBody?.type).toBe('object');
    expect(result.structure.originalBody?.fields?.model?.type).toBe('string');
  });

  it('应该返回响应结构', () => {
    const mockRecord: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: {},
      modifiedBody: {},
      responseBody: {
        content: [{ type: 'text', text: 'response' }]
      },
      matchedRules: []
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getStructure('req-1', { part: 'response' });

    expect(result.structure.responseBody).toBeDefined();
    expect(result.structure.responseBody?.type).toBe('object');
  });

  it('当记录不存在时应该抛出错误', () => {
    vi.mocked(loader.loadRecord).mockReturnValue(null);

    expect(() => getStructure('non-existent')).toThrow('Record not found: non-existent');
  });

  it('应该包含 transformedBody 当存在时', () => {
    const mockRecord: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: { model: 'claude-3-5-sonnet' },
      modifiedBody: { model: 'gpt-4' },
      transformedBody: { model: 'gpt-4-turbo' },
      matchedRules: []
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getStructure('req-1');

    expect(result.structure.transformedBody).toBeDefined();
    expect(result.structure.originalBody).toBeDefined();
    expect(result.structure.modifiedBody).toBeDefined();
  });
});
