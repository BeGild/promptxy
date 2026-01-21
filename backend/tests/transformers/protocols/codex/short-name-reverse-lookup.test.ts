import { describe, it, expect } from 'vitest';
import {
  buildShortNameMap,
} from '../../../../src/promptxy/transformers/protocols/codex/tool-name.js';
import {
  buildReverseShortNameMap,
  restoreOriginalName,
} from '../../../../src/promptxy/transformers/protocols/codex/short-name-reverse-lookup.js';

describe('buildReverseShortNameMap', () => {
  it('应构建正确的反向映射', () => {
    const shortMap = {
      'very_long_tool_name_that_exceeds': 'very_long_tool_name_that_exceeds',
      'mcp__server__tool': 'mcp__tool',
    };
    const reverse = buildReverseShortNameMap(shortMap);

    expect(reverse['very_long_tool_name_that_exceeds']).toBe('very_long_tool_name_that_exceeds');
    expect(reverse['mcp__tool']).toBe('mcp__server__tool');
  });

  it('应处理空映射', () => {
    const reverse = buildReverseShortNameMap({});
    expect(Object.keys(reverse).length).toBe(0);
  });
});

describe('restoreOriginalName', () => {
  it('应恢复被缩短的 mcp__ 工具名称', () => {
    // 构造一个超过64字符的mcp工具名
    // mcp__very_very_long_server_name_that_exceeds_limit__actual_tool_name
    const longMcpName = 'mcp__very_very_long_server_name_that_exceeds_limit__actual_tool_name';
    // 长度: 5(mcp__) + 37(server) + 2(__) + 15(tool) = 59，还没超过64
    // 再长一点
    const longerMcpName = 'mcp__extremely_long_server_name_component_that_definitely_exceeds_the_limit__and_tool_name';
    // 长度检查: 5 + 52 + 2 + 13 = 72，超过64了

    const shortMap = buildShortNameMap([
      longerMcpName,
      'short_tool',
    ]);

    // 构建反向映射
    const reverse = buildReverseShortNameMap(shortMap);

    // 验证短名称映射（应该保留mcp__前缀和最后的tool部分）
    const expectedShort = 'mcp__and_tool_name';
    expect(shortMap[longerMcpName]).toBe(expectedShort);
    expect(shortMap['short_tool']).toBe('short_tool');

    // 验证反向恢复
    expect(restoreOriginalName(expectedShort, reverse)).toBe(longerMcpName);
    expect(restoreOriginalName('short_tool', reverse)).toBe('short_tool');
  });

  it('对超过64字符的非mcp名称应截断并恢复', () => {
    const longName = 'this_is_a_very_long_tool_name_that_definitely_exceeds_the_sixty_four_character_limit';
    const shortMap = buildShortNameMap([longName]);
    const reverse = buildReverseShortNameMap(shortMap);

    // 验证截断
    expect(shortMap[longName].length).toBe(64);
    expect(shortMap[longName]).toBe(longName.substring(0, 64));

    // 验证恢复
    expect(restoreOriginalName(shortMap[longName], reverse)).toBe(longName);
  });

  it('对未缩短的名称应返回原值', () => {
    const shortMap = buildShortNameMap(['short', 'tool_name']);
    const reverse = buildReverseShortNameMap(shortMap);

    expect(restoreOriginalName('short', reverse)).toBe('short');
    expect(restoreOriginalName('tool_name', reverse)).toBe('tool_name');
  });

  it('对未知名称应返回原值', () => {
    const shortMap = buildShortNameMap(['known_tool']);
    const reverse = buildReverseShortNameMap(shortMap);

    expect(restoreOriginalName('unknown_tool', reverse)).toBe('unknown_tool');
  });
});
