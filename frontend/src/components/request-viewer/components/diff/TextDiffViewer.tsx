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

import React, { type CSSProperties, type ReactElement } from 'react';
import { List, type ListImperativeAPI } from 'react-window';
import type { TextDiffRow } from '../../utils/textDiff';

interface TextDiffViewerRowProps {
  rows: TextDiffRow[];
  scrollLeft: number;
}

export interface TextDiffViewerProps {
  rows: TextDiffRow[];
  listRef: React.MutableRefObject<ListImperativeAPI | null>;
  rowHeightPx: number;
  /**
   * 横向滚动条的可滚动宽度（以 monospace “列”为单位）
   * 说明：分割线固定 50/50，因此需要额外 +50% 的可滚动范围用于把单列文本完整滚到可见区域。
   */
  maxLineColumns: number;
}

function getRowHighlightClass(type: TextDiffRow['type']): string {
  if (type === 'same') return '';
  // 需求强调“可以展示红色”，这里统一用 error（红）作为差异高亮。
  return 'bg-status-error/10 dark:bg-status-error/20';
}

function displayLine(line: string | null): string {
  // null 表示占位行；视觉上与空行一致，但类型不同（便于空白敏感 diff）。
  if (line === null) return '\u00A0';
  if (line.length === 0) return '\u00A0';
  return line;
}

const TextDiffViewer: React.FC<TextDiffViewerProps> = React.memo(
  ({ rows, listRef, rowHeightPx, maxLineColumns }) => {
    const [scrollLeft, setScrollLeft] = React.useState(0);

    const RowComponent = (
      props: {
        ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
        index: number;
        style: CSSProperties;
      } & TextDiffViewerRowProps,
    ): ReactElement => {
      const { index, style, rows, scrollLeft } = props;
      const row = rows[index];
      if (!row) return <div style={style} />;

      const highlight = getRowHighlightClass(row.type);

      return (
        <div style={style} className="min-w-0">
          {/* 固定 50/50 的分割线：严格以表头为准，不随内容最长行变化 */}
          <div className="grid h-full grid-cols-2 divide-x divide-subtle">
            <div className={['h-full px-3 py-1 overflow-hidden', highlight].join(' ')}>
              <div
                className="font-mono text-xs text-text-primary whitespace-pre"
                // 用 left 而不是 transform：避免部分平台在滚动/复用时切换文本抗锯齿策略导致“看起来变色”
                style={{ position: 'relative', left: `${-scrollLeft}px` }}
              >
                {displayLine(row.left)}
              </div>
            </div>
            <div className={['h-full px-3 py-1 overflow-hidden', highlight].join(' ')}>
              <div
                className="font-mono text-xs text-text-primary whitespace-pre"
                style={{ position: 'relative', left: `${-scrollLeft}px` }}
              >
                {displayLine(row.right)}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="h-full min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <List
            listRef={listRef}
            rowCount={rows.length}
            rowHeight={() => rowHeightPx}
            overscanCount={10}
            rowComponent={RowComponent}
            rowProps={{ rows, scrollLeft } as TextDiffViewerRowProps}
            // 说明：
            // - 这里强制一个稳定的渲染路径，避免“首次进入 vs 滚动后”出现字体抗锯齿/子像素渲染策略切换，
            //   导致取色器看到的像素色值（例如 #D78171 ↔ #DC8746）发生变化但实际上 CSS 色值没变的现象。
            // - `transform-gpu` 用于让滚动容器始终处于一致的合成策略；`antialiased` 尽量保持字体平滑一致。
            // - 同时显式设置背景，避免底层渐变/透明叠加对像素取色造成干扰。
            className="overflow-y-auto overflow-x-hidden bg-elevated dark:bg-secondary transform-gpu antialiased"
            style={{ height: '100%', width: '100%' }}
          />
        </div>

        {/* 单一横向滚动条：控制左右两列文本同步横向滚动（分割线保持不动） */}
        <div
          className="h-h4 border-t border-subtle bg-canvas dark:bg-secondary overflow-x-auto overflow-y-hidden"
          onScroll={e => setScrollLeft(e.currentTarget.scrollLeft)}
        >
          <div
            className="h-full font-mono text-xs"
            style={{
              minWidth: '100%',
              width: `calc(${Math.max(1, maxLineColumns)}ch + 50%)`,
            }}
          />
        </div>
      </div>
    );
  },
);

TextDiffViewer.displayName = 'TextDiffViewer';

export default TextDiffViewer;
