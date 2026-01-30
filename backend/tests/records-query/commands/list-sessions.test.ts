import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listSessions } from '../../../src/records-query/commands/list-sessions';
import * as loader from '../../../src/records-query/loader';
import type { ParsedRecord } from '../../../src/records-query/types';

vi.mock('../../../src/records-query/loader');

describe('list-sessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应该返回空列表当没有记录时', () => {
    vi.mocked(loader.loadRecords).mockReturnValue([]);

    const result = listSessions();

    expect(result.total).toBe(0);
    expect(result.sessions).toHaveLength(0);
  });

  it('应该按 conversationId 分组会话', () => {
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
        conversationId: 'conv-1'
      },
      {
        id: 'req-3',
        timestamp: 3000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: { conversation_id: 'conv-2' },
        modifiedBody: {},
        matchedRules: [],
        supplierName: 'openai',
        conversationId: 'conv-2'
      }
    ];

    vi.mocked(loader.loadRecords).mockReturnValue(mockRecords);

    const result = listSessions();

    expect(result.total).toBe(2);
    expect(result.sessions).toHaveLength(2);

    const conv1 = result.sessions.find(s => s.conversationId === 'conv-1');
    expect(conv1?.requestCount).toBe(2);

    const conv2 = result.sessions.find(s => s.conversationId === 'conv-2');
    expect(conv2?.requestCount).toBe(1);
  });

  it('应该支持 client 过滤器', () => {
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
      },
      {
        id: 'req-2',
        timestamp: 2000,
        client: 'openai',
        path: '/v1/chat',
        method: 'POST',
        originalBody: {},
        modifiedBody: {},
        matchedRules: []
      }
    ];

    vi.mocked(loader.loadRecords).mockReturnValue(mockRecords);

    const result = listSessions({ filter: 'client=claude' });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].client).toBe('claude');
  });

  it('应该支持 hasError 过滤器', () => {
    const mockRecords: ParsedRecord[] = [
      {
        id: 'req-1',
        timestamp: 1000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: {},
        modifiedBody: {},
        matchedRules: [],
        responseStatus: 200
      },
      {
        id: 'req-2',
        timestamp: 2000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: {},
        modifiedBody: {},
        matchedRules: [],
        responseStatus: 500
      }
    ];

    vi.mocked(loader.loadRecords).mockReturnValue(mockRecords);

    const result = listSessions({ filter: 'hasError=true' });

    expect(result.sessions).toHaveLength(1);
  });

  it('应该限制返回数量', () => {
    const mockRecords: ParsedRecord[] = Array.from({ length: 10 }, (_, i) => ({
      id: 'req-' + i,
      timestamp: i * 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: { conversation_id: 'conv-' + i },
      modifiedBody: {},
      matchedRules: [],
      conversationId: 'conv-' + i
    }));

    vi.mocked(loader.loadRecords).mockReturnValue(mockRecords);

    const result = listSessions({ limit: 5 });

    expect(result.sessions).toHaveLength(5);
  });
});
