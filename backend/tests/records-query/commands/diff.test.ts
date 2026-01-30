import { describe, it, expect, vi, beforeEach } from 'vitest';
import { diffRequests } from '../../../src/records-query/commands/diff';
import * as loader from '../../../src/records-query/loader';
import type { ParsedRecord } from '../../../src/records-query/types';

vi.mock('../../../src/records-query/loader');

describe('diff', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应该比较两个请求的结构', () => {
    const mockRecord1: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: { model: 'claude-3-5-sonnet', messages: [] },
      modifiedBody: { model: 'claude-3-5-sonnet', messages: [] },
      matchedRules: []
    };

    const mockRecord2: ParsedRecord = {
      id: 'req-2',
      timestamp: 2000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: { model: 'gpt-4', messages: [], temperature: 0.7 },
      modifiedBody: { model: 'gpt-4', messages: [], temperature: 0.7 },
      matchedRules: []
    };

    vi.mocked(loader.loadRecord).mockImplementation((id) => {
      if (id === 'req-1') return mockRecord1;
      if (id === 'req-2') return mockRecord2;
      return null;
    });

    const result = diffRequests('req-1', 'req-2');

    expect(result.request1).toBe('req-1');
    expect(result.request2).toBe('req-2');
    expect(result.structuralDifferences).toBeDefined();
    expect(result.structuralDifferences?.originalBody?.addedFields).toContain('temperature');
  });

  it('当记录不存在时应该抛出错误', () => {
    vi.mocked(loader.loadRecord).mockReturnValue(null);

    expect(() => diffRequests('req-1', 'req-2')).toThrow('One or both records not found');
  });

  it('应该支持字段模式比较', () => {
    const mockRecord1: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: { model: 'claude-3-5-sonnet' },
      modifiedBody: { model: 'claude-3-5-sonnet' },
      matchedRules: []
    };

    const mockRecord2: ParsedRecord = {
      id: 'req-2',
      timestamp: 2000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: { model: 'gpt-4' },
      modifiedBody: { model: 'gpt-4' },
      matchedRules: []
    };

    vi.mocked(loader.loadRecord).mockImplementation((id) => {
      if (id === 'req-1') return mockRecord1;
      if (id === 'req-2') return mockRecord2;
      return null;
    });

    const result = diffRequests('req-1', 'req-2', { mode: 'field', field: 'originalBody.model' });

    expect(result.fieldDifferences).toBeDefined();
    expect(result.fieldDifferences?.['originalBody.model'].from).toBe('claude-3-5-sonnet');
    expect(result.fieldDifferences?.['originalBody.model'].to).toBe('gpt-4');
    expect(result.fieldDifferences?.['originalBody.model'].different).toBe(true);
  });
});
