import React from 'react';
import type { ViewNode } from '../../types';
import { DiffStatus } from '../../types';

interface PrimitiveRendererProps {
  node: ViewNode;
}

/**
 * 原始类型渲染器
 * 用于渲染简单值（string, number, boolean）
 */
const PrimitiveRenderer: React.FC<PrimitiveRendererProps> = ({ node }) => {
  const { value, diffStatus } = node;

  // 根据差异状态获取样式
  const getDiffColor = () => {
    switch (diffStatus) {
      case DiffStatus.ADDED:
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case DiffStatus.REMOVED:
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case DiffStatus.MODIFIED:
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  // 格式化值
  const formatValue = (val: any): string => {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'string') return `"${val}"`;
    if (typeof val === 'number') return String(val);
    // 对象和数组类型：格式化为 JSON 字符串（紧凑格式用于内联显示）
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return '[Invalid Object]';
      }
    }
    return String(val);
  };

  return (
    <span className={`font-mono text-xs px-1 py-0.5 rounded ${getDiffColor()}`}>
      {formatValue(value)}
    </span>
  );
};

export default PrimitiveRenderer;
