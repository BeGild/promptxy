import { describe, it, expect } from 'vitest';
import type { Root, Element, Text } from 'hast';
import { rehypeXmlHighlight } from '@/utils/rehype-xml-highlight';

function transform(tree: Root) {
  const transformer = rehypeXmlHighlight() as unknown as (t: Root) => void;
  transformer(tree);
}

function getFirstTextChild(element: Element) {
  return (element.children?.[0] as Text | undefined)?.value ?? '';
}

describe('rehypeXmlHighlight', () => {
  it('应该只高亮闭合成对的标签本身', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [{ type: 'text', value: 'Hello <a>world</a> end' }],
        },
      ],
    };

    transform(tree);

    const p = tree.children[0] as Element;
    const children = p.children as Array<Text | Element>;

    expect(children).toHaveLength(5);
    expect(children[0]).toMatchObject({ type: 'text', value: 'Hello ' });
    expect(children[1]).toMatchObject({ type: 'element', tagName: 'code' });
    expect(getFirstTextChild(children[1] as Element)).toBe('<a>');
    expect(children[2]).toMatchObject({ type: 'text', value: 'world' });
    expect(children[3]).toMatchObject({ type: 'element', tagName: 'code' });
    expect(getFirstTextChild(children[3] as Element)).toBe('</a>');
    expect(children[4]).toMatchObject({ type: 'text', value: ' end' });
  });

  it('未闭合标签应该原样保留但不高亮', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [{ type: 'text', value: 'Hello <a>world end' }],
        },
      ],
    };

    transform(tree);

    const p = tree.children[0] as Element;
    const children = p.children as Array<Text | Element>;
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ type: 'text', value: 'Hello <a>world end' });
  });

  it('void 标签写法（如 <br>）应该不高亮（即使出现于可高亮标签附近）', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [{ type: 'text', value: 'A <b>c</b> D <br> E' }],
        },
      ],
    };

    transform(tree);

    const p = tree.children[0] as Element;
    const children = p.children as Array<Text | Element>;

    // 只应高亮 <b> 与 </b>，<br> 保持在普通文本里
    expect(children).toHaveLength(5);
    expect(getFirstTextChild(children[1] as Element)).toBe('<b>');
    expect(getFirstTextChild(children[3] as Element)).toBe('</b>');
    expect((children[4] as Text).value).toContain('<br>');
  });

  it('显式自闭合标签（以 /> 结尾）应该高亮', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [{ type: 'text', value: 'X <img src="a" /> Y' }],
        },
      ],
    };

    transform(tree);

    const p = tree.children[0] as Element;
    const children = p.children as Array<Text | Element>;

    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ type: 'text', value: 'X ' });
    expect(children[1]).toMatchObject({ type: 'element', tagName: 'code' });
    expect(getFirstTextChild(children[1] as Element)).toBe('<img src="a" />');
    expect(children[2]).toMatchObject({ type: 'text', value: ' Y' });
  });

  it('code/pre 内的文本不应该被处理', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: {},
              children: [{ type: 'text', value: 'Hello <a>world</a> end' }],
            },
          ],
        },
      ],
    };

    transform(tree);

    const pre = tree.children[0] as Element;
    const code = (pre.children?.[0] as Element) ?? ({} as Element);
    const children = code.children as Array<Text | Element>;
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ type: 'text', value: 'Hello <a>world</a> end' });
  });
});
