import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTrace } from '../../../src/records-query/commands/trace';
import * as loader from '../../../src/records-query/loader';
import type { ParsedRecord } from '../../../src/records-query/types';

vi.mock('../../../src/records-query/loader');

describe('trace', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应该返回转换链', () => {
    const mockRecord: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: {},
      modifiedBody: {},
      matchedRules: [],
      transformerChain: 'ClaudeToOpenAI, OpenAIGateway'
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getTrace('req-1');

    expect(result.requestId).toBe('req-1');
    expect(result.transformChain).toHaveLength(2);
    expect(result.transformChain[0].step).toBe('ClaudeToOpenAI');
    expect(result.transformChain[1].step).toBe('OpenAIGateway');
  });

  it('应该解析 transformTrace JSON', () => {
    const mockRecord: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: {},
      modifiedBody: {},
      matchedRules: [],
      transformTrace: JSON.stringify([
        {
          step: 'ClaudeToOpenAI',
          fromProtocol: 'claude',
          toProtocol: 'openai',
          changes: {
            addedFields: ['temperature'],
            removedFields: [],
            renamedFields: {},
            typeChanges: {}
          }
        }
      ])
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getTrace('req-1');

    expect(result.transformChain).toHaveLength(1);
    expect(result.transformChain[0].step).toBe('ClaudeToOpenAI');
    expect(result.transformChain[0].fromProtocol).toBe('claude');
    expect(result.transformChain[0].toProtocol).toBe('openai');
  });

  it('当记录不存在时应该抛出错误', () => {
    vi.mocked(loader.loadRecord).mockReturnValue(null);

    expect(() => getTrace('non-existent')).toThrow('Record not found: non-existent');
  });

  it('应该处理空的转换链', () => {
    const mockRecord: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: {},
      modifiedBody: {},
      matchedRules: []
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getTrace('req-1');

    expect(result.transformChain).toHaveLength(0);
  });

  it('应该处理无效的 transformTrace JSON', () => {
    const mockRecord: ParsedRecord = {
      id: 'req-1',
      timestamp: 1000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: {},
      modifiedBody: {},
      matchedRules: [],
      transformerChain: 'Step1',
      transformTrace: 'invalid json'
    };

    vi.mocked(loader.loadRecord).mockReturnValue(mockRecord);

    const result = getTrace('req-1');

    expect(result.transformChain).toHaveLength(1);
    expect(result.transformChain[0].step).toBe('Step1');
  });
});
