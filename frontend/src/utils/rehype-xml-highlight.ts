import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Element, Text } from 'hast';

interface TagMatch {
  type: 'open' | 'close' | 'selfclose';
  tagName: string;
  fullMatch: string;
  start: number;
  end: number;
}

/**
 * rehype-xml-highlight
 *
 * 将 XML/HTML 标签转换为带颜色高亮的文本
 * 只高亮标签本身，不处理标签内容
 * 只处理闭合的标签对
 */
export const rehypeXmlHighlight: Plugin<[], Root> = () => {
  return (tree) => {
    // 直接访问所有文本节点
    visit(tree, 'text', (textNode: Text, index, parent) => {
      if (!parent || index === undefined) return;
      // 跳过已经是 code 元素子节点的文本（已处理的）
      if (
        parent.type === 'element' &&
        (parent.tagName === 'code' || parent.tagName === 'pre')
      ) {
        return;
      }

      const value = textNode.value;
      if (!value) return;

      // 匹配所有 XML/HTML 标签
      const tagRegex = /<\/?([\w-]+)(?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?)*\s*\/?>/g;
      const matches: TagMatch[] = [];
      let match;

      // 收集所有标签
      while ((match = tagRegex.exec(value)) !== null) {
        const fullMatch = match[0];
        const isClosing = fullMatch.startsWith('</');
        const isSelfClosing = fullMatch.endsWith('/>');
        const tagName = match[1];

        matches.push({
          type: isClosing ? 'close' : isSelfClosing ? 'selfclose' : 'open',
          tagName,
          fullMatch,
          start: match.index,
          end: tagRegex.lastIndex,
        });
      }

      if (matches.length === 0) return;

      // 使用栈匹配闭合的标签对
      const stack: Array<{ match: TagMatch; index: number }> = [];
      const pairs: Array<{ open: TagMatch; close?: TagMatch; startIndex: number; endIndex: number }> = [];

      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];

        if (m.type === 'open') {
          stack.push({ match: m, index: i });
        } else if (m.type === 'close') {
          // 查找匹配的开放标签
          for (let j = stack.length - 1; j >= 0; j--) {
            if (stack[j].match.tagName === m.tagName) {
              const openMatch = stack.splice(j, 1)[0];
              pairs.push({
                open: openMatch.match,
                close: m,
                startIndex: openMatch.index,
                endIndex: m.end,
              });
              break;
            }
          }
        } else if (m.type === 'selfclose') {
          // 自闭合标签单独处理
          pairs.push({
            open: m,
            startIndex: m.start,
            endIndex: m.end,
          });
        }
      }

      if (pairs.length === 0) return;

      // 构建新的子节点数组
      const newChildren: Array<Text | Element> = [];
      let lastIndex = 0;

      // 处理每个标签对
      for (const pair of pairs) {
        // 添加标签前的普通文本
        if (pair.startIndex > lastIndex) {
          newChildren.push({
            type: 'text',
            value: value.slice(lastIndex, pair.startIndex),
          });
        }

        // 添加开始标签（高亮）
        newChildren.push({
          type: 'element',
          tagName: 'code',
          properties: {
            className: ['xml-tag-highlight'],
          },
          children: [{ type: 'text', value: pair.open.fullMatch }],
        });

        // 添加标签内容（普通文本）
        const contentStart = pair.open.end;
        const contentEnd = pair.close ? pair.close.start : pair.open.end;
        if (contentEnd > contentStart) {
          newChildren.push({
            type: 'text',
            value: value.slice(contentStart, contentEnd),
          });
        }

        // 如果有结束标签，添加它（高亮）
        if (pair.close) {
          newChildren.push({
            type: 'element',
            tagName: 'code',
            properties: {
              className: ['xml-tag-highlight'],
            },
            children: [{ type: 'text', value: pair.close.fullMatch }],
          });
        }

        lastIndex = pair.close ? pair.close.end : pair.open.end;
      }

      // 添加剩余的普通文本
      if (lastIndex < value.length) {
        newChildren.push({
          type: 'text',
          value: value.slice(lastIndex),
        });
      }

      // 如果没有变化，保持原样
      if (newChildren.length <= 1) {
        return;
      }

      // 用新节点替换原来的文本节点
      const parentChildren = parent.children as Array<Text | Element>;
      parentChildren.splice(index, 1, ...newChildren);
    });
  };
};
