import { describe, it, expect } from 'vitest';
import {
  buildShortNameMap,
  shortenNameIfNeeded,
  type ShortNameMap,
} from '../../../../src/promptxy/transformers/protocols/codex/tool-name.js';

describe('buildShortNameMap', () => {
  it('应保持短名称不变', () => {
    const names = ['short', 'tool_name', 'TestTool'];
    const result = buildShortNameMap(names);
    expect(result).toEqual({
      'short': 'short',
      'tool_name': 'tool_name',
      'TestTool': 'TestTool',
    });
  });

  it('应将长名称截断到 64 字符', () => {
    const longName = 'a'.repeat(100);
    const names = [longName];
    const result = buildShortNameMap(names);
    expect(result[longName]).toBe('a'.repeat(64));
  });

  it('应处理 mcp__ 前缀的长名称', () => {
    const longName = 'mcp__very_long_server_name_with_many_underscores__extremely_long_tool_name_that_exceeds_limit';
    const names = [longName];
    const result = buildShortNameMap(names);
    // 期望保留 mcp__ 前缀，保留最后 __ 后的部分，然后截断到 64
    expect(result[longName].length).toBeLessThanOrEqual(64);
    expect(result[longName]).toMatch(/^mcp__/);
  });

  it('应确保缩短后的名称唯一性', () => {
    const name1 = 'mcp__server1__tool_name';
    const name2 = 'mcp__server2__tool_name';
    const names = [name1, name2];
    const result = buildShortNameMap(names);
    // 两者应该映射到不同的短名称
    expect(result[name1]).not.toBe(result[name2]);
    expect(result[name1].length).toBeLessThanOrEqual(64);
    expect(result[name2].length).toBeLessThanOrEqual(64);
  });

  it('应通过添加数字后缀处理重复', () => {
    const name1 = 'a'.repeat(70);  // 都会缩短到 64 字符 'aaa...a'
    const name2 = 'b'.repeat(70);  // 都会缩短到 64 字符 'bbb...b'
    const name3 = 'c'.repeat(70);
    const names = [name1, name2, name3];
    const result = buildShortNameMap(names);
    // 每个应该有唯一的短名称
    const shortNames = Object.values(result);
    const uniqueShortNames = new Set(shortNames);
    expect(uniqueShortNames.size).toBe(names.length);
  });
});

describe('shortenNameIfNeeded', () => {
  it('应保持短名称不变', () => {
    expect(shortenNameIfNeeded('short')).toBe('short');
    expect(shortenNameIfNeeded('tool_name')).toBe('tool_name');
  });

  it('应截断长名称', () => {
    const longName = 'a'.repeat(100);
    expect(shortenNameIfNeeded(longName)).toBe('a'.repeat(64));
  });

  it('应智能处理 mcp__ 前缀', () => {
    // mcp__server__tool  -> mcp__tool (如果超过 64)
    const longName = 'mcp__very_long_server_name__tool_name_here';
    const result = shortenNameIfNeeded(longName);
    expect(result).toMatch(/^mcp__/);
    expect(result.length).toBeLessThanOrEqual(64);
  });
});
