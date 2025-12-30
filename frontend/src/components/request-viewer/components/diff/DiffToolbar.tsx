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

import React from 'react';

export interface DiffToolbarProps {
  /** 差异块（hunk）数量 */
  hunkCount: number;
  /** 当前激活差异块索引（0-based）；为 null 代表当前没有可导航的差异块 */
  activeHunkIndex: number | null;
  onPrevHunk: () => void;
  onNextHunk: () => void;
}

const DiffToolbar: React.FC<DiffToolbarProps> = React.memo(
  ({
    hunkCount,
    activeHunkIndex,
    onPrevHunk,
    onNextHunk,
  }) => {
    const displayIndex = activeHunkIndex ?? 0;

    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-subtle bg-elevated dark:bg-secondary rounded-t">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-primary">差异对比</span>
          <span className="text-xs text-secondary">{hunkCount} 个差异块</span>
        </div>

        {hunkCount > 0 && activeHunkIndex !== null && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevHunk}
              disabled={activeHunkIndex <= 0}
              className="px-3 py-1 text-sm bg-brand-primary/10 dark:bg-brand-primary/20 rounded hover:bg-brand-primary/20 dark:hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← 上一个
            </button>
            <span className="text-xs text-secondary">
              {displayIndex + 1} / {hunkCount}
            </span>
            <button
              type="button"
              onClick={onNextHunk}
              disabled={activeHunkIndex >= hunkCount - 1}
              className="px-3 py-1 text-sm bg-brand-primary/10 dark:bg-brand-primary/20 rounded hover:bg-brand-primary/20 dark:hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一个 →
            </button>
          </div>
        )}
      </div>
    );
  },
);

DiffToolbar.displayName = 'DiffToolbar';

export default DiffToolbar;
