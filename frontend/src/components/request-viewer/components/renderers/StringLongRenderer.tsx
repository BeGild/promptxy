import React, { useState, useCallback } from 'react';
import type { ViewNode } from '../../types';
import { DiffStatus } from '../../types';

interface StringLongRendererProps {
  node: ViewNode;
}

/**
 * 长字符串渲染器
 * 支持折叠/展开和复制功能
 */
const StringLongRenderer: React.FC<StringLongRendererProps> = ({ node }) => {
  const { value, diffStatus, id } = node;
  const [isExpanded, setIsExpanded] = useState(!node.defaultCollapsed);
  const [copied, setCopied] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [value]);

  // 根据差异状态获取样式
  const getDiffClass = () => {
    switch (diffStatus) {
      case DiffStatus.ADDED:
        return 'border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20';
      case DiffStatus.REMOVED:
        return 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20';
      case DiffStatus.MODIFIED:
        return 'border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'border-l-4 border-transparent';
    }
  };

  const displayValue = String(value);
  const isLong = displayValue.length > 200;

  return (
    <div className={`rounded ${getDiffClass()}`}>
      {/* 头部：显示摘要和操作按钮 */}
      {(isLong || node.collapsible) && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-t">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {displayValue.length} 字符
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="复制内容"
            >
              {copied ? '✓ 已复制' : '📋 复制'}
            </button>
            {node.collapsible && (
              <button
                onClick={toggleExpanded}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {isExpanded ? '▼ 折叠' : '▶ 展开'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 内容 */}
      <div
        className={`p-3 overflow-auto ${isExpanded ? '' : 'hidden'} ${
          !isLong && !node.collapsible ? 'mt-0' : ''
        }`}
      >
        <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-mono">
          {displayValue}
        </pre>
      </div>

      {/* 折叠时显示预览 */}
      {!isExpanded && isLong && (
        <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 italic">
          {displayValue.slice(0, 100)}...
        </div>
      )}
    </div>
  );
};

export default StringLongRenderer;
