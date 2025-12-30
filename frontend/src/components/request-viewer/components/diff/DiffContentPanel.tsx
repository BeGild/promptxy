/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - 硬编码颜色值（如 #007acc, #ff0000）
 * - 硬编码尺寸值（如 16px, 8px）
 * - 旧 Tailwind 颜色类（如 gray-*, blue-*, slate-*）
 *
 * ✅ REQUIRED:
 * - 使用语义化变量和类名
 * - 参考 styles/tokens/colors.css 中的可用变量
 */

import React, { useEffect, useMemo, useState } from 'react';
import { getScrollbarSize } from 'react-window';
import type { ListImperativeAPI } from 'react-window';
import type { ViewNode } from '../../types';
import type { TextDiffHunk, TextDiffRow } from '../../utils/textDiff';
import DiffHunkNavigator from './DiffHunkNavigator';
import TextDiffViewer from './TextDiffViewer';

export interface DiffContentPanelProps {
  hasAnyChanges: boolean;
  /** 当前选中节点（来自 modifiedTree 或 originalTree） */
  selectedNode: ViewNode | null;
  /** 是否为叶子节点（按内容详情语义） */
  isLeaf: boolean;
  /** 对齐后的行级 diff（全量行） */
  rows: TextDiffRow[];
  /** 差异块（hunks） */
  hunks: TextDiffHunk[];
  /** 当前激活 hunk 索引 */
  activeHunkIndex: number | null;
  /** 点击差异块（含导航条/工具栏）时回调 */
  onSelectHunk: (index: number) => void;
  /** react-window 的 listRef（用于跳转） */
  listRef: React.MutableRefObject<ListImperativeAPI | null>;
  /** 单行高度（px） */
  rowHeightPx: number;
}

function PanelEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="h-full min-h-0 flex items-center justify-center p-6">
      <div className="max-w-lg text-center">
        <div className="text-4xl">📎</div>
        <div className="mt-3 text-lg font-semibold text-text-primary">{title}</div>
        <div className="mt-1 text-sm text-secondary">{description}</div>
      </div>
    </div>
  );
}

/**
 * 右侧内容区容器
 * - 叶子节点：两栏文本 diff（虚拟文件）
 * - 非叶子节点：提示信息（不做结构化渲染）
 */
const DiffContentPanel: React.FC<DiffContentPanelProps> = React.memo(
  ({
    hasAnyChanges,
    selectedNode,
    isLeaf,
    rows,
    hunks,
    activeHunkIndex,
    onSelectHunk,
    listRef,
    rowHeightPx,
  }) => {
    const [scrollbarGutterPx, setScrollbarGutterPx] = useState(0);

    const maxLineColumns = useMemo(() => {
      // 分割线固定 50/50，因此这里仅用于横向滚动条的“可滚动范围”，不再影响列分割位置。
      let max = 1;
      for (const row of rows) {
        const leftLen = row.left ? Array.from(row.left).length : 0;
        const rightLen = row.right ? Array.from(row.right).length : 0;
        if (leftLen > max) max = leftLen;
        if (rightLen > max) max = rightLen;
      }
      return max;
    }, [rows]);

    useEffect(() => {
      if (typeof window === 'undefined') return;

      const update = () => {
        const el = listRef.current?.element;
        if (!el) return;
        const hasVerticalScrollbar = el.scrollHeight > el.clientHeight;
        setScrollbarGutterPx(hasVerticalScrollbar ? getScrollbarSize() : 0);
      };

      // next frame：等待 react-window 完成初次布局/测量
      const raf = requestAnimationFrame(update);
      window.addEventListener('resize', update);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', update);
      };
    }, [listRef, rows.length]);

    if (!hasAnyChanges) {
      return (
        <div className="h-full min-h-0 bg-elevated dark:bg-secondary border border-subtle rounded">
          <PanelEmptyState title="未检测到变化" description="原始请求与修改后请求完全一致。" />
        </div>
      );
    }

    if (!selectedNode) {
      return (
        <div className="h-full min-h-0 bg-elevated dark:bg-secondary border border-subtle rounded">
          <PanelEmptyState
            title="请选择一个节点进行对比"
            description="请从左侧目录树选择一个叶子节点。"
          />
        </div>
      );
    }

    if (!isLeaf) {
      return (
        <div className="h-full min-h-0 bg-elevated dark:bg-secondary border border-subtle rounded">
          <PanelEmptyState
            title="请选择叶子节点查看内容差异"
            description="当前节点为文件夹/集合节点，无法作为虚拟文件进行对比。"
          />
        </div>
      );
    }

    return (
      <div className="h-full min-h-0 bg-elevated dark:bg-secondary border border-subtle rounded overflow-hidden">
        <div className="h-full min-h-0 flex">
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div
              className="grid grid-cols-2 divide-x divide-subtle border-b border-subtle bg-canvas dark:bg-secondary"
              // 关键：内容区域的 List 有纵向滚动条时，内容宽度会被滚动条占掉；
              // 表头在滚动容器外，需要手动预留同样的 gutter，才能与内容的 50/50 分割线严格对齐。
              style={{ paddingRight: `${scrollbarGutterPx}px` }}
            >
              <div className="px-3 py-2 text-xs font-medium text-secondary">原始内容</div>
              <div className="px-3 py-2 text-xs font-medium text-secondary">修改后内容</div>
            </div>
            <div className="flex-1 min-h-0">
              <TextDiffViewer
                rows={rows}
                listRef={listRef}
                rowHeightPx={rowHeightPx}
                maxLineColumns={maxLineColumns}
              />
            </div>
          </div>

          <DiffHunkNavigator
            hunks={hunks}
            totalRows={rows.length}
            activeIndex={activeHunkIndex}
            onSelect={onSelectHunk}
          />
        </div>
      </div>
    );
  },
);

DiffContentPanel.displayName = 'DiffContentPanel';

export default DiffContentPanel;
