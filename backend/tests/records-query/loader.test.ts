import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadRecords, loadRecord, parseRecord, extractConversationId } from '../../src/records-query/loader';
import type { RawRecord } from '../../src/records-query/types';

vi.mock('fs');
vi.mock('path');

describe('loader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('extractConversationId', () => {
    it('应该从 body 中提取 conversation_id', () => {
      const body = {
        conversation_id: 'conv_123',
        messages: []
      };
      expect(extractConversationId(body)).toBe('conv_123');
    });

    it('应该从 body 中提取 id 作为回退', () => {
      const body = {
        id: 'msg_456',
        messages: []
      };
      expect(extractConversationId(body)).toBe('msg_456');
    });

    it('应该返回 undefined 如果没有可识别的字段', () => {
      const body = { messages: [] };
      expect(extractConversationId(body)).toBeUndefined();
    });
  });

  describe('parseRecord', () => {
    it('应该正确解析原始记录', () => {
      const raw: RawRecord = {
        id: 'test-123',
        timestamp: 1737312568000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: '{"model":"claude-3-5-sonnet","messages":[{"role":"user","content":"hello"}]}',
        modifiedBody: '{"model":"claude-3-5-sonnet","messages":[{"role":"user","content":"hello"}]}',
        matchedRules: '[]'
      };

      const parsed = parseRecord(raw);

      expect(parsed.id).toBe('test-123');
      expect(parsed.originalBody).toEqual({
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'hello' }]
      });
      expect(parsed.conversationId).toBeUndefined();
    });

    it('应该正确解析带有 conversation_id 的记录', () => {
      const raw: RawRecord = {
        id: 'test-456',
        timestamp: 1737312568000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: '{"model":"claude-3-5-sonnet","conversation_id":"conv_abc","messages":[]}',
        modifiedBody: '{"model":"claude-3-5-sonnet","conversation_id":"conv_abc","messages":[]}',
        matchedRules: '[]'
      };

      const parsed = parseRecord(raw);
      expect(parsed.conversationId).toBe('conv_abc');
    });
  });
});
