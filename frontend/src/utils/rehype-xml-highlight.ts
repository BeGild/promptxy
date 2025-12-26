import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Element, Text } from 'hast';

/**
 * rehype-xml-highlight
 *
 * 将 XML/HTML 标签转换为带颜色高亮的文本
 * 防止标签被解析为实际的 HTML 元素
 */
export const rehypeXmlHighlight: Plugin<[], Root> = () => {
  return (tree) => {
    // 直接访问所有文本节点，避免嵌套 visit 导致的无限循环
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

      // 匹配 XML/HTML 标签的正则表达式
      const tagRegex = /(<\/?[\w-]+(?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?)*\s*\/?>)/g;

      // 如果没有标签，直接返回
      if (!tagRegex.test(value)) return;

      // 重置正则的 lastIndex
      tagRegex.lastIndex = 0;

      // 分割文本，将标签和普通文本分开
      const parts: Array<{ type: 'text' | 'tag'; value: string }> = [];
      let lastIndex = 0;
      let match;

      while ((match = tagRegex.exec(value)) !== null) {
        // 添加标签前的普通文本
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            value: value.slice(lastIndex, match.index),
          });
        }

        // 添加标签
        parts.push({
          type: 'tag',
          value: match[1],
        });

        lastIndex = tagRegex.lastIndex;
      }

      // 添加剩余的普通文本
      if (lastIndex < value.length) {
        parts.push({
          type: 'text',
          value: value.slice(lastIndex),
        });
      }

      // 如果没有找到任何标签或只有标签，保持原样
      if (parts.length <= 1) {
        return;
      }

      // 替换当前节点为新的节点数组
      const newChildren: Array<Text | Element> = parts.map((part) => {
        if (part.type === 'text') {
          return { type: 'text', value: part.value };
        } else {
          // 将标签包装在 code 元素中，应用绿色高亮
          return {
            type: 'element',
            tagName: 'code',
            properties: {
              className: ['xml-tag-highlight'],
            },
            children: [{ type: 'text', value: part.value }],
          };
        }
      });

      // 用新节点替换原来的文本节点
      const parentChildren = parent.children as Array<Text | Element>;
      parentChildren.splice(index, 1, ...newChildren);
    });
  };
};
