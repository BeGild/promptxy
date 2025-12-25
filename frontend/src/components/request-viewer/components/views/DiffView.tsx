import React, { useState } from 'react';
import type { ViewNode } from '../../types';
import { DiffStatus } from '../../types';
import PrimitiveRenderer from '../renderers/PrimitiveRenderer';
import StringLongRenderer from '../renderers/StringLongRenderer';

interface DiffViewProps {
  originalTree: ViewNode;
  modifiedTree: ViewNode;
}

/**
 * 差异对比视图
 * 并排对比原始请求和修改后请求
 */
const DiffView: React.FC<DiffViewProps> = ({ originalTree, modifiedTree }) => {
  const [showChangesOnly, setShowChangesOnly] = useState(true);
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0);

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
        return <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">🟢 新增</span>;
      case DiffStatus.REMOVED:
        return <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded">🔴 删除</span>;
      case DiffStatus.MODIFIED:
        return <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded">🟡 修改</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded">🟢 无变化</span>;
    }
  };

  // 递归渲染节点
  const renderNode = (
    originalNode: ViewNode | undefined,
    modifiedNode: ViewNode,
    depth: number = 0
  ): React.ReactNode => {
    // 如果只显示变化，且当前节点无变化，则不显示
    if (showChangesOnly && modifiedNode.diffStatus === DiffStatus.SAME) {
      // 显示折叠的无变化指示器
      return (
        <div key={modifiedNode.id} className="py-1" style={{ marginLeft: `${depth * 16}px` }}>
          <div className="flex justify-between items-center text-xs text-gray-400 dark:text-gray-600 py-1 px-2 bg-gray-50 dark:bg-gray-800/50 rounded">
            <span>🟢 未变化 (已折叠)</span>
            <span className="text-gray-400">{modifiedNode.label}</span>
          </div>
        </div>
      );
    }

    const marginStyle = { marginLeft: `${depth * 16}px` };

    return (
      <div key={modifiedNode.id} className="py-1">
        <div className="grid grid-cols-2 gap-4" style={marginStyle}>
          {/* 原始值 */}
          <div className="border border-gray-200 dark:border-gray-700 rounded p-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {modifiedNode.label}
              </span>
              {renderDiffIndicator(originalNode ? DiffStatus.SAME : DiffStatus.REMOVED)}
            </div>
            {originalNode ? (
              <PrimitiveRenderer node={originalNode} />
            ) : (
              <span className="text-xs text-gray-400 italic">无</span>
            )}
          </div>

          {/* 修改后的值 */}
          <div className={`border rounded p-2 ${
            modifiedNode.diffStatus === DiffStatus.ADDED ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
            modifiedNode.diffStatus === DiffStatus.REMOVED ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
            modifiedNode.diffStatus === DiffStatus.MODIFIED ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
            'border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {modifiedNode.label}
              </span>
              {renderDiffIndicator(modifiedNode.diffStatus)}
            </div>
            <PrimitiveRenderer node={modifiedNode} />
          </div>
        </div>

        {/* 子节点 */}
        {modifiedNode.children && modifiedNode.children.length > 0 && (
          <div className="mt-2">
            {modifiedNode.children.map((child, index) => {
              const originalChild = originalNode?.children?.[index];
              return renderNode(originalChild, child, depth + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showChangesOnly}
              onChange={(e) => setShowChangesOnly(e.target.checked)}
              className="rounded"
            />
            仅显示变化
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {diffNodes.length} 个变化
          </span>
        </div>

        {diffNodes.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={prevDiff}
              disabled={currentDiffIndex === 0}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↑ 上一个
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {currentDiffIndex + 1} / {diffNodes.length}
            </span>
            <button
              onClick={nextDiff}
              disabled={currentDiffIndex >= diffNodes.length - 1}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一个 ↓
            </button>
          </div>
        )}
      </div>

      {/* 差异内容 */}
      <div className="p-4">
        {renderNode(undefined, modifiedTree)}
      </div>
    </div>
  );
};

export default DiffView;
