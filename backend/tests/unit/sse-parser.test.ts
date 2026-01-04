/**
 * SSE 解析器单元测试
 */

import { describe, it, expect } from 'vitest';
import { parseSSEToEvents, isSSEContent, eventsToSSE, ParsedSSEEvent } from '../../src/promptxy/utils/sse-parser.js';

describe('SSE Parser', () => {
  describe('isSSEContent', () => {
    it('应该检测到以 data: 开头的内容', () => {
      expect(isSSEContent('data: hello\n\n')).toBe(true);
    });

    it('应该检测到以 event: 开头的内容', () => {
      expect(isSSEContent('event: message\n\n')).toBe(true);
    });

    it('应该拒绝非 SSE 内容', () => {
      expect(isSSEContent('{"json": "data"}')).toBe(false);
      expect(isSSEContent('plain text')).toBe(false);
    });

    it('应该处理空字符串', () => {
      expect(isSSEContent('')).toBe(false);
    });

    it('应该处理 undefined', () => {
      expect(isSSEContent(undefined as any)).toBe(false);
    });
  });

  describe('parseSSEToEvents', () => {
    it('应该解析单个事件', () => {
      const input = 'data: hello\n\n';
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        data: 'hello',
      });
    });

    it('应该解析多个事件', () => {
      const input = 'data: first\n\ndata: second\n\n';
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ data: 'first' });
      expect(events[1]).toEqual({ data: 'second' });
    });

    it('应该解析包含 event 字段的事件', () => {
      const input = 'event: message\ndata: hello\n\n';
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        event: 'message',
        data: 'hello',
      });
    });

    it('应该解析包含 id 字段的事件', () => {
      const input = 'id: 123\ndata: hello\n\n';
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        id: '123',
        data: 'hello',
      });
    });

    it('应该解析包含 retry 字段的事件', () => {
      const input = 'retry: 5000\ndata: hello\n\n';
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        data: 'hello',
        retry: 5000,
      });
    });

    it('应该处理多行 data 字段', () => {
      const input = 'data: line1\ndata: line2\n\n';
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        data: 'line1\nline2',
      });
    });

    it('应该忽略注释行（以 : 开头）', () => {
      const input = ': this is a comment\ndata: hello\n\n';
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        data: 'hello',
      });
    });

    it('应该处理没有空行结尾的事件', () => {
      const input = 'data: hello';
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        data: 'hello',
      });
    });

    it('应该处理空输入', () => {
      expect(parseSSEToEvents('')).toEqual([]);
    });

    it('应该处理 undefined 输入', () => {
      expect(parseSSEToEvents(undefined as any)).toEqual([]);
    });

    it('应该移除冒号后的单个空格（SSE 规范）', () => {
      const input = 'data: hello\n\n'; // 冒号后一个空格
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        data: 'hello', // 移除空格后
      });
    });

    it('应该保留冒号后的多个空格（仅移除第一个）', () => {
      const input = 'data:  hello\n\n'; // 冒号后两个空格
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        data: ' hello', // 移除第一个空格，保留第二个
      });
    });

    it('应该解析完整的事件结构', () => {
      const input = 'id: 1\nevent: message\nretry: 3000\ndata: test\n\n';
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        id: '1',
        event: 'message',
        retry: 3000,
        data: 'test',
      });
    });

    it('应该忽略未知字段', () => {
      const input = 'unknown: value\ndata: hello\n\n';
      const events = parseSSEToEvents(input);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        data: 'hello',
      });
    });
  });

  describe('eventsToSSE', () => {
    it('应该将事件数组转换为 SSE 文本', () => {
      const events: ParsedSSEEvent[] = [
        { data: 'hello' },
        { data: 'world' },
      ];
      const output = eventsToSSE(events);
      expect(output).toBe('data: hello\n\ndata: world\n\n');
    });

    it('应该包含所有字段', () => {
      const events: ParsedSSEEvent[] = [
        {
          id: '123',
          event: 'message',
          retry: 5000,
          data: 'test',
        },
      ];
      const output = eventsToSSE(events);
      expect(output).toContain('id: 123');
      expect(output).toContain('event: message');
      expect(output).toContain('retry: 5000');
      expect(output).toContain('data: test');
    });

    it('应该处理多行 data', () => {
      const events: ParsedSSEEvent[] = [
        {
          data: 'line1\nline2',
        },
      ];
      const output = eventsToSSE(events);
      expect(output).toContain('data: line1');
      expect(output).toContain('data: line2');
    });

    it('应该处理空数组', () => {
      const output = eventsToSSE([]);
      expect(output).toBe('');
    });
  });

  describe('往返转换', () => {
    it('应该能够解析并重新生成相同的 SSE 内容', () => {
      const input = 'id: 1\nevent: message\nretry: 3000\ndata: line1\ndata: line2\n\n';
      const events = parseSSEToEvents(input);
      const output = eventsToSSE(events);

      // 解析输出应该得到相同的事件
      const reParsed = parseSSEToEvents(output);
      expect(reParsed).toEqual(events);
    });
  });
});
