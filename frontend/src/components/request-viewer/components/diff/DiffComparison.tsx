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
import { DiffStatus, NodeType, type ViewNode } from '../../types';
import NodeRenderer from '../renderers/NodeRenderer';
import type { MarkdownDiffResult } from '../../utils/diff';

export interface DiffComparisonProps {
  /** 原始节点（可能为空，代表新增） */
  originalNode?: ViewNode;
  /** 修改后的节点（可能为空，代表删除） */
  modifiedNode?: ViewNode;
  /** 当前节点差异状态 */
  diffStatus: DiffStatus;
  /** 仅显示变化（主要影响 Markdown 段落级 diff 展示） */
  showChangesOnly: boolean;
  /** 段落级 Markdown diff（可选，仅在 Markdown+MODIFIED 时提供） */
  markdownDiff?: MarkdownDiffResult;
}

function renderStatusBadge(status: DiffStatus): React.ReactNode {
  switch (status) {
    case DiffStatus.ADDED:
      return (
        <span className="px-2 py-1 bg-status-success/10 dark:bg-status-success/20 text-status-success text-xs rounded">
          🟢 新增
        </span>
      );
    case DiffStatus.REMOVED:
      return (
        <span className="px-2 py-1 bg-status-error/10 dark:bg-status-error/20 text-status-error text-xs rounded">
          🔴 删除
        </span>
      );
    case DiffStatus.MODIFIED:
      return (
        <span className="px-2 py-1 bg-status-warning/10 dark:bg-status-warning/20 text-status-warning text-xs rounded">
          🟡 修改
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 bg-canvas dark:bg-secondary text-tertiary text-xs rounded">
          🟢 无变化
        </span>
      );
  }
}

function getModifiedPanelClass(status: DiffStatus): string {
  switch (status) {
    case DiffStatus.ADDED:
      return 'border-status-success bg-status-success/10 dark:bg-status-success/20';
    case DiffStatus.REMOVED:
      return 'border-status-error bg-status-error/10 dark:bg-status-error/20';
    case DiffStatus.MODIFIED:
      return 'border-status-warning bg-status-warning/10 dark:bg-status-warning/20';
    default:
      return 'border-subtle';
  }
}

function getOriginalPanelClass(status: DiffStatus): string {
  switch (status) {
    case DiffStatus.REMOVED:
      return 'border-status-error bg-status-error/10 dark:bg-status-error/20';
    default:
      return 'border-subtle bg-elevated dark:bg-secondary';
  }
}

function SmallEmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="text-3xl">{icon}</div>
      <div className="mt-2 text-sm text-secondary">{text}</div>
    </div>
  );
}

function MarkdownParagraphDiffView({
  diff,
  showChangesOnly,
}: {
  diff: MarkdownDiffResult;
  showChangesOnly: boolean;
}) {
  const { paragraphs, totalOriginal, totalModified, changedCount } = diff;

  const visibleParagraphs = useMemo(() => {
    if (!showChangesOnly) return paragraphs;
    return paragraphs.filter(p => p.type !== 'same');
  }, [paragraphs, showChangesOnly]);

  const hiddenCount = paragraphs.length - visibleParagraphs.length;

  return (
    <div className="space-y-xs">
      <div className="text-xs text-secondary">
        段落级对比：{changedCount}/{paragraphs.length} 个段落有变化（原文 {totalOriginal} 段 →
        修改后 {totalModified} 段）
        {showChangesOnly && hiddenCount > 0 && (
          <span className="ml-2 text-tertiary">已隐藏 {hiddenCount} 个无变化段落</span>
        )}
      </div>

      {visibleParagraphs.map(para => {
        const colorClass = {
          same: 'border-subtle bg-canvas dark:bg-secondary/30',
          added: 'border-status-success bg-status-success/10 dark:bg-status-success/20',
          removed: 'border-status-error bg-status-error/10 dark:bg-status-error/20',
          modified: 'border-status-warning bg-status-warning/10 dark:bg-status-warning/20',
          moved: 'border-brand-primary bg-brand-primary/10 dark:bg-brand-primary/20',
        }[para.type];

        const label = {
          same: '无变化',
          added: '新增',
          removed: '删除',
          modified: '修改',
          moved: `移动（来自段落 ${para.movedFrom ?? '-'}）`,
        }[para.type];

        return (
          <div key={para.id} className={`border-l-2 ${colorClass} pl-3 py-2 rounded`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-secondary">{label}</span>
              <span className="text-xs text-tertiary">
                段落 {para.index + 1}
                {para.originalIndex !== undefined && `（原：${para.originalIndex + 1}）`}
              </span>
            </div>
            <div className="text-sm text-primary">
              <code className="bg-canvas dark:bg-secondary px-2 py-1 rounded block overflow-x-auto">
                {para.content}
              </code>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 左右对比面板
 * - 左：Original
 * - 右：Modified
 */
const DiffComparison: React.FC<DiffComparisonProps> = React.memo(
  ({ originalNode, modifiedNode, diffStatus, showChangesOnly, markdownDiff }) => {
    const isMarkdownModified =
      modifiedNode?.type === NodeType.MARKDOWN && diffStatus === DiffStatus.MODIFIED;

    const originalBadgeStatus =
      diffStatus === DiffStatus.REMOVED ? DiffStatus.REMOVED : originalNode ? DiffStatus.SAME : DiffStatus.ADDED;

    return (
      <div className="h-full min-h-0 grid grid-cols-2 gap-4 p-4">
        {/* Original */}
        <div
          className={[
            'h-full min-h-0 border rounded overflow-auto',
            getOriginalPanelClass(diffStatus),
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-subtle">
            <div className="text-sm font-medium text-primary">原始内容</div>
            {renderStatusBadge(originalBadgeStatus)}
          </div>
          <div className="p-3">
            {originalNode ? (
              <NodeRenderer node={originalNode} />
            ) : (
              <SmallEmptyState icon="📭" text="无内容（该节点为新增）" />
            )}
          </div>
        </div>

        {/* Modified */}
        <div
          className={[
            'h-full min-h-0 border rounded overflow-auto',
            getModifiedPanelClass(modifiedNode ? diffStatus : DiffStatus.REMOVED),
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-subtle">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-primary">修改后内容</div>
              {isMarkdownModified && <span className="text-xs text-brand-primary">段落级对比</span>}
            </div>
            {renderStatusBadge(modifiedNode ? diffStatus : DiffStatus.REMOVED)}
          </div>

          <div className="p-3">
            {modifiedNode ? (
              isMarkdownModified && markdownDiff ? (
                <MarkdownParagraphDiffView diff={markdownDiff} showChangesOnly={showChangesOnly} />
              ) : (
                <NodeRenderer node={modifiedNode} />
              )
            ) : (
              <SmallEmptyState icon="📭" text="无内容（该节点已被删除）" />
            )}
          </div>
        </div>
      </div>
    );
  },
);

DiffComparison.displayName = 'DiffComparison';

export default DiffComparison;
