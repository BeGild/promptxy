import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ViewNode } from '@/components/request-viewer/types';
import { DiffStatus, NodeType } from '@/components/request-viewer/types';
import DiffView from '@/components/request-viewer/components/views/DiffView';

const scrollToRow = vi.fn();

vi.mock('react-resizable-panels', () => {
  return {
    Group: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
    Panel: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
    Separator: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
    useDefaultLayout: () => ({
      defaultLayout: null,
      onLayoutChange: () => {},
    }),
  };
});

vi.mock('@/components/request-viewer/components/file-tree/FileTree', () => {
  return {
    default: (props: { rootNode: ViewNode; onNodeSelect: (node: ViewNode) => void }) => {
      return (
        <div>
          <button type="button" onClick={() => props.onNodeSelect(props.rootNode)}>
            选中根节点
          </button>
          <button
            type="button"
            onClick={() => props.onNodeSelect((props.rootNode.children?.[0] as ViewNode) ?? props.rootNode)}
          >
            选中叶子节点
          </button>
        </div>
      );
    },
  };
});

vi.mock('@/components/request-viewer/components/diff/TextDiffViewer', () => {
  return {
    default: (props: { listRef: React.MutableRefObject<any> }) => {
      props.listRef.current = { scrollToRow };
      return <div data-testid="text-diff-viewer" />;
    },
  };
});

function makeNode(partial: Partial<ViewNode>): ViewNode {
  return {
    id: partial.id ?? 'root',
    type: partial.type ?? NodeType.PRIMITIVE,
    label: partial.label ?? 'root',
    path: partial.path ?? partial.id ?? 'root',
    value: partial.value,
    diffStatus: partial.diffStatus ?? DiffStatus.SAME,
    children: partial.children,
    metadata: partial.metadata,
    collapsible: partial.collapsible,
    defaultCollapsed: partial.defaultCollapsed,
    customRenderer: partial.customRenderer,
  };
}

describe('DiffView（叶子节点=虚拟文件的行级文本 diff）', () => {
  it('点击差异块导航应触发滚动跳转（scrollToRow）', async () => {
    scrollToRow.mockClear();

    const originalTree = makeNode({
      id: 'root',
      type: NodeType.JSON,
      value: {},
      diffStatus: DiffStatus.MODIFIED,
      children: [
        makeNode({
          id: 'root.leaf',
          path: 'root.leaf',
          type: NodeType.PRIMITIVE,
          value: 'a\nb\nc',
          diffStatus: DiffStatus.SAME,
        }),
      ],
    });

    const modifiedTree = makeNode({
      id: 'root',
      type: NodeType.JSON,
      value: {},
      diffStatus: DiffStatus.MODIFIED,
      children: [
        makeNode({
          id: 'root.leaf',
          path: 'root.leaf',
          type: NodeType.PRIMITIVE,
          value: 'a\nx\nc',
          diffStatus: DiffStatus.MODIFIED,
        }),
      ],
    });

    render(<DiffView originalTree={originalTree} modifiedTree={modifiedTree} />);

    const hunkButton = await screen.findByLabelText('第 1 / 1 个差异块');
    fireEvent.click(hunkButton);

    expect(scrollToRow).toHaveBeenCalledTimes(1);
    expect(scrollToRow).toHaveBeenCalledWith({ index: 1, align: 'start' });
  });

  it('选择非叶子节点时应显示中文提示（不渲染结构化内容）', async () => {
    const originalTree = makeNode({
      id: 'root',
      type: NodeType.JSON,
      value: {},
      diffStatus: DiffStatus.MODIFIED,
      children: [
        makeNode({
          id: 'root.leaf',
          path: 'root.leaf',
          type: NodeType.PRIMITIVE,
          value: 'a',
          diffStatus: DiffStatus.SAME,
        }),
      ],
    });

    const modifiedTree = makeNode({
      id: 'root',
      type: NodeType.JSON,
      value: {},
      diffStatus: DiffStatus.MODIFIED,
      children: [
        makeNode({
          id: 'root.leaf',
          path: 'root.leaf',
          type: NodeType.PRIMITIVE,
          value: 'b',
          diffStatus: DiffStatus.MODIFIED,
        }),
      ],
    });

    render(<DiffView originalTree={originalTree} modifiedTree={modifiedTree} />);

    // 通过 mock 的 FileTree 选择根节点（非叶子）
    fireEvent.click(screen.getByText('选中根节点'));

    expect(await screen.findByText('请选择叶子节点查看内容差异')).toBeInTheDocument();
    expect(screen.queryByTestId('text-diff-viewer')).not.toBeInTheDocument();
  });
});
