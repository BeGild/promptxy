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

import React, { useState, useEffect } from 'react';
import { DiffStatus, NodeType, type ViewNode } from '../../types';
import PrimitiveRenderer from '../renderers/PrimitiveRenderer';
import MarkdownRenderer from '../renderers/MarkdownRenderer';
import { diffMarkdown, type MarkdownDiffResult, type ParagraphDiff } from '../../utils/diff';

interface DiffViewProps {
  originalTree: ViewNode;
  modifiedTree: ViewNode;
}

/**
 * 差异对比视图
 * 并排对比原始请求和修改后请求
 * 支持 Markdown 段落级 diff
 */
const DiffView: React.FC<DiffViewProps> = ({ originalTree, modifiedTree }) => {
  const [showChangesOnly, setShowChangesOnly] = useState(true);
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0);
  const [markdownDiffs, setMarkdownDiffs] = useState<Map<string, MarkdownDiffResult>>(new Map());

  // 收集所有有变化的节点
  const collectDiffNodes = (node: ViewNode, diffs: ViewNode[] = []): ViewNode[] => {
    if (node.diffStatus !== DiffStatus.SAME) {
      diffs.push(node);
    }
    if (node.children) {
      node.children.forEach(child => collectDiffNodes(child, diffs));
    }
    return diffs;
  };

  const diffNodes = collectDiffNodes(modifiedTree);

  // 查找节点的原始值
  const findOriginalNode = (
    tree: ViewNode | undefined,
    targetPath: string,
  ): ViewNode | undefined => {
    if (!tree) return undefined;
    if (tree.path === targetPath) return tree;
    if (tree.children) {
      for (const child of tree.children) {
        const found = findOriginalNode(child, targetPath);
        if (found) return found;
      }
    }
    return undefined;
  };

  // 计算段落级 diff
  useEffect(() => {
    const computeMarkdownDiffs = async () => {
      const diffs = new Map<string, MarkdownDiffResult>();

      // 遍历所有节点，查找 Markdown 类型且状态为 MODIFIED 的节点
      const traverse = async (modNode: ViewNode, origNode: ViewNode | undefined) => {
        // 只对 Markdown 类型且修改的节点进行段落级 diff
        if (
          modNode.type === NodeType.MARKDOWN &&
          modNode.diffStatus === DiffStatus.MODIFIED &&
          origNode &&
          typeof modNode.value === 'string' &&
          typeof origNode.value === 'string'
        ) {
          try {
            const result = await diffMarkdown(origNode.value, modNode.value, { showChangesOnly });
            diffs.set(modNode.id, result);
          } catch (error) {
            console.error('Failed to compute paragraph diff:', error);
          }
        }

        // 递归处理子节点
        if (modNode.children) {
          for (const child of modNode.children) {
            const origChild = origNode?.children?.find(c => c.path === child.path);
            await traverse(child, origChild);
          }
        }
      };

      await traverse(modifiedTree, originalTree);
      setMarkdownDiffs(diffs);
    };

    computeMarkdownDiffs();
  }, [modifiedTree, originalTree, showChangesOnly]);

  const nextDiff = () => {
    if (currentDiffIndex < diffNodes.length - 1) {
      setCurrentDiffIndex(currentDiffIndex + 1);
    }
  };

  const prevDiff = () => {
    if (currentDiffIndex > 0) {
      setCurrentDiffIndex(currentDiffIndex - 1);
    }
  };

  // 渲染差异状态指示器
  const renderDiffIndicator = (status: DiffStatus) => {
    switch (status) {
      case DiffStatus.ADDED:
        return (
          <span className="px-2 py-1 bg-status-success/10 dark:bg-status-success/20 text-status-success dark:text-status-success/80 text-xs rounded">
            🟢 新增
          </span>
        );
      case DiffStatus.REMOVED:
        return (
          <span className="px-2 py-1 bg-status-error/10 dark:bg-status-error/20 text-status-error dark:text-status-error/80 text-xs rounded">
            🔴 删除
          </span>
        );
      case DiffStatus.MODIFIED:
        return (
          <span className="px-2 py-1 bg-status-warning/10 dark:bg-status-warning/20 text-status-warning dark:text-status-warning/80 text-xs rounded">
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
  };

  // 渲染段落级差异
  const renderParagraphDiff = (nodeId: string, diffResult: MarkdownDiffResult): React.ReactNode => {
    const { paragraphs, totalOriginal, totalModified, changedCount } = diffResult;

    return (
      <div className="space-y-xs">
        {/* 差异统计 */}
        <div className="text-xs text-secondary mb-2">
          段落级对比: {changedCount}/{paragraphs.length} 个段落有变化 (原文 {totalOriginal} 段 →
          修改后 {totalModified} 段)
        </div>

        {/* 段落列表 */}
        {paragraphs.map(para => {
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
            moved: `移动 (来自段落 ${para.movedFrom})`,
          }[para.type];

          if (showChangesOnly && para.type === 'same') {
            return null;
          }

          return (
            <div key={para.id} className={`border-l-2 ${colorClass} pl-3 py-2 rounded`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-secondary">{label}</span>
                <span className="text-xs text-tertiary">
                  段落 {para.index + 1}
                  {para.originalIndex !== undefined && ` (原: ${para.originalIndex + 1})`}
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
  };

  // 递归渲染节点
  const renderNode = (
    originalNode: ViewNode | undefined,
    modifiedNode: ViewNode,
    depth: number = 0,
  ): React.ReactNode => {
    // 如果只显示变化，且当前节点无变化，则不显示
    if (showChangesOnly && modifiedNode.diffStatus === DiffStatus.SAME) {
      // 显示折叠的无变化指示器
      return (
        <div key={modifiedNode.id} className="py-xs" style={{ marginLeft: `${depth * 16}px` }}>
          <div className="flex justify-between items-center text-xs text-tertiary py-1 px-2 bg-canvas dark:bg-secondary/50 rounded">
            <span>🟢 未变化 (已折叠)</span>
            <span className="text-tertiary">{modifiedNode.label}</span>
          </div>
        </div>
      );
    }

    const marginStyle = { marginLeft: `${depth * 16}px` };
    const hasMarkdownDiff = markdownDiffs.has(modifiedNode.id);

    return (
      <div key={modifiedNode.id} className="py-xs">
        <div className="grid grid-cols-2 gap-4" style={marginStyle}>
          {/* 原始值 */}
          <div className="border border-subtle rounded p-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-primary">{modifiedNode.label}</span>
              {renderDiffIndicator(originalNode ? DiffStatus.SAME : DiffStatus.REMOVED)}
            </div>
            {originalNode ? (
              <PrimitiveRenderer node={originalNode} />
            ) : (
              <span className="text-xs text-tertiary italic">无</span>
            )}
          </div>

          {/* 修改后的值 */}
          <div
            className={`border rounded p-2 ${
              modifiedNode.diffStatus === DiffStatus.ADDED
                ? 'border-status-success bg-status-success/10 dark:bg-status-success/20'
                : modifiedNode.diffStatus === DiffStatus.REMOVED
                  ? 'border-status-error bg-status-error/10 dark:bg-status-error/20'
                  : modifiedNode.diffStatus === DiffStatus.MODIFIED
                    ? 'border-status-warning bg-status-warning/10 dark:bg-status-warning/20'
                    : 'border-subtle'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-primary">{modifiedNode.label}</span>
              {renderDiffIndicator(modifiedNode.diffStatus)}
              {hasMarkdownDiff && <span className="text-xs text-brand-primary">段落级对比</span>}
            </div>

            {/* 如果有段落级 diff，显示段落对比；否则显示原始内容 */}
            {hasMarkdownDiff ? (
              renderParagraphDiff(modifiedNode.id, markdownDiffs.get(modifiedNode.id)!)
            ) : (
              <PrimitiveRenderer node={modifiedNode} />
            )}
          </div>
        </div>

        {/* 子节点 */}
        {modifiedNode.children && modifiedNode.children.length > 0 && (
          <div className="mt-mt2">
            {modifiedNode.children.map(child => {
              const originalChild = originalNode?.children?.find(c => c.path === child.path);
              return renderNode(originalChild, child, depth + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 rounded-lg">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-primary/30 dark:border-brand-primary/20">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-primary">
            <input
              type="checkbox"
              checked={showChangesOnly}
              onChange={e => setShowChangesOnly(e.target.checked)}
              className="rounded"
            />
            仅显示变化
          </label>
          <span className="text-xs text-secondary">{diffNodes.length} 个变化</span>
          {markdownDiffs.size > 0 && (
            <span className="text-xs text-brand-primary">
              {markdownDiffs.size} 个 Markdown 段落级对比
            </span>
          )}
        </div>

        {diffNodes.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={prevDiff}
              disabled={currentDiffIndex === 0}
              className="px-3 py-1 text-sm bg-brand-primary/10 dark:bg-brand-primary/20 rounded hover:bg-brand-primary/20 dark:hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↑ 上一个
            </button>
            <span className="text-xs text-secondary">
              {currentDiffIndex + 1} / {diffNodes.length}
            </span>
            <button
              onClick={nextDiff}
              disabled={currentDiffIndex >= diffNodes.length - 1}
              className="px-3 py-1 text-sm bg-brand-primary/10 dark:bg-brand-primary/20 rounded hover:bg-brand-primary/20 dark:hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一个 ↓
            </button>
          </div>
        )}
      </div>

      {/* 差异内容 */}
      <div className="p-p4">{renderNode(undefined, modifiedTree)}</div>
    </div>
  );
};

export default DiffView;
