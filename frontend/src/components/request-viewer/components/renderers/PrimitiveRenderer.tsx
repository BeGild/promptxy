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
        return 'text-status-success dark:text-status-success/80 bg-status-success/10 dark:bg-status-success/20';
      case DiffStatus.REMOVED:
        return 'text-status-error dark:text-status-error/80 bg-status-error/10 dark:bg-status-error/20';
      case DiffStatus.MODIFIED:
        return 'text-status-warning dark:text-status-warning/80 bg-status-warning/10 dark:bg-status-warning/20';
      default:
        return 'text-secondary';
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
