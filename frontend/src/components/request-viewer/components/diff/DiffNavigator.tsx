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
import type { ViewNode } from '../../types';

export interface DiffNavigatorProps {
  /** 有变化的节点列表（通常来自 modifiedTree） */
  diffNodes: ViewNode[];
  /** 当前高亮的差异索引；为 null 时不高亮任何点 */
  activeIndex: number | null;
  /** 点击某个差异点时回调 */
  onSelectDiff: (index: number) => void;
}

function getDotLeft(index: number, total: number): string {
  if (total <= 1) return '50%';
  return `${(index / (total - 1)) * 100}%`;
}

/**
 * 差异导航条
 * - 顶部横线 + 差异点（●）
 * - 支持 hover tooltip 与当前选中高亮
 */
const DiffNavigator: React.FC<DiffNavigatorProps> = React.memo(
  ({ diffNodes, activeIndex, onSelectDiff }) => {
    const dots = useMemo(() => {
      return diffNodes.map((node, index) => {
        const isActive = activeIndex === index;
        const label = node.path || node.label;
        const title = `${label}（第 ${index + 1} / ${diffNodes.length} 个变化）`;
        return { node, index, isActive, title, left: getDotLeft(index, diffNodes.length) };
      });
    }, [activeIndex, diffNodes]);

    if (diffNodes.length === 0) return null;

    return (
      <div className="px-4 py-3 border-b border-subtle bg-elevated dark:bg-secondary">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-secondary">差异导航</div>
          <div className="text-xs text-tertiary">{diffNodes.length} 个变化</div>
        </div>

        <div className="relative mt-2 h-h2 rounded-full bg-border-subtle dark:bg-border-subtle">
          {dots.map(({ node, index, isActive, title, left }) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectDiff(index)}
              className={[
                'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all',
                isActive
                  ? 'w-w4 h-w4 bg-brand-primary shadow-sm'
                  : 'w-w3 h-w3 bg-status-warning/20 hover:bg-status-warning/30',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
                'dark:focus-visible:ring-offset-secondary',
              ].join(' ')}
              style={{ left }}
              title={title}
              aria-label={title}
            />
          ))}
        </div>
      </div>
    );
  },
);

DiffNavigator.displayName = 'DiffNavigator';

export default DiffNavigator;
