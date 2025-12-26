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
 * 只高亮标签本身（`<tag ...>` / `</tag>` / `<tag .../>`），不处理标签内容
 *
 * 高亮规则：
 * - 仅高亮“可闭合成对”的 open/close 标签
 * - 显式自闭合（以 `/>` 结尾）的标签永远高亮
 * - 未闭合的标签、以及 void 标签写法（如 `<br>` / `<img>` 不带 `/>`）原样保留但不高亮
 */
export const rehypeXmlHighlight: Plugin<[], Root> = () => {
  return tree => {
    // 直接访问所有文本节点
    visit(tree, 'text', (textNode: Text, index, parent) => {
      if (!parent || index === undefined) return;
      // 跳过已经是 code 元素子节点的文本（已处理的）
      if (parent.type === 'element' && (parent.tagName === 'code' || parent.tagName === 'pre'))
        return;

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

      // 使用栈匹配可闭合的 open/close 标签；仅对“配对成功”的标签做高亮
      const shouldHighlight: boolean[] = new Array(matches.length).fill(false);
      const openStack: Array<{ tagName: string; matchIndex: number }> = [];

      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];

        if (m.type === 'selfclose') {
          shouldHighlight[i] = true;
          continue;
        }

        if (m.type === 'open') {
          openStack.push({ tagName: m.tagName, matchIndex: i });
          continue;
        }

        if (m.type === 'close') {
          for (let j = openStack.length - 1; j >= 0; j--) {
            if (openStack[j].tagName !== m.tagName) continue;
            const open = openStack.splice(j, 1)[0];
            shouldHighlight[open.matchIndex] = true;
            shouldHighlight[i] = true;
            break;
          }
        }
      }

      if (!shouldHighlight.some(Boolean)) return;

      // 仅在“需要高亮的标签”处拆分，避免无谓地产生大量节点
      const highlightMatches: TagMatch[] = [];
      for (let i = 0; i < matches.length; i++) {
        if (shouldHighlight[i]) highlightMatches.push(matches[i]);
      }

      const newChildren: Array<Text | Element> = [];
      let lastIndex = 0;

      for (const m of highlightMatches) {
        if (m.start > lastIndex) {
          newChildren.push({ type: 'text', value: value.slice(lastIndex, m.start) });
        }

        newChildren.push({
          type: 'element',
          tagName: 'code',
          properties: { className: ['xml-tag-highlight'] },
          children: [{ type: 'text', value: m.fullMatch }],
        });

        lastIndex = m.end;
      }

      if (lastIndex < value.length) {
        newChildren.push({ type: 'text', value: value.slice(lastIndex) });
      }

      const parentChildren = parent.children as Array<Text | Element>;
      parentChildren.splice(index, 1, ...newChildren);
    });
  };
};
