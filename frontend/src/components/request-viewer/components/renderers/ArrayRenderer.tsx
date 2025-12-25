import React, { useState, useCallback, useEffect } from 'react';
import type { ViewNode } from '../../types';
import { DiffStatus } from '../../types';
import NodeRenderer from './NodeRenderer';

interface ArrayRendererProps {
  node: ViewNode;
}

/**
 * 数组渲染器
 * 列表展示，支持折叠/展开
 */
const ArrayRenderer: React.FC<ArrayRendererProps> = ({ node }) => {
  const { value, children, id, label, diffStatus, metadata } = node;
  const [isExpanded, setIsExpanded] = useState(!node.defaultCollapsed);
  const [showAll, setShowAll] = useState(false);

  // 从 localStorage 读取折叠状态
  useEffect(() => {
    const stored = localStorage.getItem('request-viewer:collapse-state');
    if (stored) {
      try {
        const state = JSON.parse(stored);
        if (state[id] !== undefined) {
          setIsExpanded(state[id]);
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  }, [id]);

  // 保存折叠状态到 localStorage
  const toggleExpanded = useCallback(() => {
    const newState = !isExpanded;
    setIsExpanded(newState);

    try {
      const stored = localStorage.getItem('request-viewer:collapse-state');
      const state = stored ? JSON.parse(stored) : {};
      state[id] = newState;
      localStorage.setItem('request-viewer:collapse-state', JSON.stringify(state));
    } catch (e) {
      // 忽略存储错误
    }
  }, [id, isExpanded]);

  // 根据差异状态获取样式
  const getDiffClass = () => {
    switch (diffStatus) {
      case DiffStatus.ADDED:
        return 'border-green-500';
      case DiffStatus.REMOVED:
        return 'border-red-500';
      case DiffStatus.MODIFIED:
        return 'border-yellow-500';
      default:
        return 'border-gray-200 dark:border-gray-700';
    }
  };

  const childCount = children?.length ?? 0;
  const hasChildren = childCount > 0;

  // 默认显示前 10 个，超过则分页
  const DEFAULT_VISIBLE = 10;
  const visibleCount = showAll ? childCount : Math.min(DEFAULT_VISIBLE, childCount);
  const visibleChildren = children?.slice(0, visibleCount) ?? [];
  const hasMore = childCount > DEFAULT_VISIBLE;

  return (
    <div className={`border-l-2 ${getDiffClass()} ml-2`}>
      {/* 头部 */}
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer select-none"
        onClick={toggleExpanded}
      >
        <span className="text-gray-400">
          {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
        </span>
        <span className="font-semibold text-sm">{label}:</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          [{childCount} 项]
        </span>
      </div>

      {/* 子节点列表 */}
      {hasChildren && isExpanded && (
        <div className="ml-4">
          <div className="space-y-1">
            {visibleChildren.map(child => (
              <div key={child.id} className="my-1">
                <div className="flex items-start gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    [{child.label}]:
                  </span>
                  <div className="flex-1">
                    <NodeRenderer node={child} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 显示更多按钮 */}
          {hasMore && !showAll && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(true);
              }}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              显示剩余 {childCount - DEFAULT_VISIBLE} 项...
            </button>
          )}

          {showAll && childCount > DEFAULT_VISIBLE && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(false);
              }}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              收起
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ArrayRenderer;
