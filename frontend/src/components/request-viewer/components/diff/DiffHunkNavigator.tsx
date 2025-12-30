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

import React, { useMemo } from 'react';
import type { TextDiffHunk } from '../../utils/textDiff';

export interface DiffHunkNavigatorProps {
  hunks: TextDiffHunk[];
  totalRows: number;
  activeIndex: number | null;
  onSelect: (index: number) => void;
}

function toPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0%';
  return `${(numerator / denominator) * 100}%`;
}

const DiffHunkNavigator: React.FC<DiffHunkNavigatorProps> = React.memo(
  ({ hunks, totalRows, activeIndex, onSelect }) => {
    const blocks = useMemo(() => {
      return hunks.map((hunk, index) => {
        const start = Math.max(0, Math.min(hunk.startRow, totalRows));
        const end = Math.max(0, Math.min(hunk.endRow, totalRows));
        const heightRows = Math.max(1, end - start + 1);

        return {
          index,
          top: toPercent(start, totalRows),
          height: toPercent(heightRows, totalRows),
          isActive: activeIndex === index,
          title: `第 ${index + 1} / ${hunks.length} 个差异块`,
        };
      });
    }, [activeIndex, hunks, totalRows]);

    if (hunks.length === 0) return null;

    return (
      <div
        className="relative h-full w-w4 bg-canvas dark:bg-secondary border-l border-subtle"
        aria-label="差异块导航"
      >
        {blocks.map(block => (
          <button
            key={block.index}
            type="button"
            onClick={() => onSelect(block.index)}
            title={block.title}
            aria-label={block.title}
            className={[
              'absolute left-0 right-0 rounded-sm',
              // 需求强调可展示红色：差异块用 error（红）显示，active 更深。
              block.isActive ? 'bg-status-error dark:bg-status-error/90' : 'bg-status-error/50',
              'hover:bg-status-error/70 dark:hover:bg-status-error/80',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
              'dark:focus-visible:ring-offset-secondary',
            ].join(' ')}
            style={{
              top: block.top,
              height: block.height,
              minHeight: 'var(--spacing-h2)',
            }}
          />
        ))}
      </div>
    );
  },
);

DiffHunkNavigator.displayName = 'DiffHunkNavigator';

export default DiffHunkNavigator;

