import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listRequests } from '../../../src/records-query/commands/list-requests';
import * as loader from '../../../src/records-query/loader';
import type { ParsedRecord } from '../../../src/records-query/types';

vi.mock('../../../src/records-query/loader');

describe('list-requests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应该返回指定会话的请求列表', () => {
    const mockRecords: ParsedRecord[] = [
      {
        id: 'req-1',
        timestamp: 1000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: { conversation_id: 'conv-1' },
        modifiedBody: {},
        matchedRules: [],
        supplierName: 'anthropic',
        model: 'claude-3-5-sonnet',
        conversationId: 'conv-1'
      },
      {
        id: 'req-2',
        timestamp: 2000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: { conversation_id: 'conv-1' },
        modifiedBody: {},
        matchedRules: [],
        supplierName: 'anthropic',
        model: 'claude-3-5-sonnet',
        responseStatus: 200,
        durationMs: 1500,
        conversationId: 'conv-1'
      }
    ];

    vi.mocked(loader.loadRecords).mockReturnValue(mockRecords);

    const result = listRequests({ conversationId: 'conv-1' });

    expect(result.conversationId).toBe('conv-1');
    expect(result.requestCount).toBe(2);
    expect(result.requests).toHaveLength(2);
    expect(result.requests[0].id).toBe('req-1');
    expect(result.requests[1].id).toBe('req-2');
  });

  it('应该按时间戳排序', () => {
    const mockRecords: ParsedRecord[] = [
      {
        id: 'req-2',
        timestamp: 2000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: { conversation_id: 'conv-1' },
        modifiedBody: {},
        matchedRules: [],
        conversationId: 'conv-1'
      },
      {
        id: 'req-1',
        timestamp: 1000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: { conversation_id: 'conv-1' },
        modifiedBody: {},
        matchedRules: [],
        conversationId: 'conv-1'
      }
    ];

    vi.mocked(loader.loadRecords).mockReturnValue(mockRecords);

    const result = listRequests({ conversationId: 'conv-1' });

    expect(result.requests[0].id).toBe('req-1');
    expect(result.requests[1].id).toBe('req-2');
  });

  it('应该支持通过 requestId 查询', () => {
    const mockRecords: ParsedRecord[] = [
      {
        id: 'req-1',
        timestamp: 1000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: {},
        modifiedBody: {},
        matchedRules: []
      }
    ];

    vi.mocked(loader.loadRecords).mockReturnValue(mockRecords);

    const result = listRequests({ conversationId: 'req-1' });

    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].id).toBe('req-1');
  });

  it('应该限制返回数量', () => {
    const mockRecords: ParsedRecord[] = Array.from({ length: 10 }, (_, i) => ({
      id: 'req-' + i,
      timestamp: i * 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: { conversation_id: 'conv-1' },
      modifiedBody: {},
      matchedRules: [],
      conversationId: 'conv-1'
    }));

    vi.mocked(loader.loadRecords).mockReturnValue(mockRecords);

    const result = listRequests({ conversationId: 'conv-1', limit: 5 });

    expect(result.requests).toHaveLength(5);
  });
});
