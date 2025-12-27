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
        return 'border-l-4 border-green-500 bg-status-success/10';
      case DiffStatus.REMOVED:
        return 'border-l-4 border-red-500 bg-status-error/10';
      case DiffStatus.MODIFIED:
        return 'border-l-4 border-yellow-500 bg-status-warning/10';
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
        <div className="flex items-center justify-between px-3 py-2 bg-secondary rounded-t">
          <span className="text-xs text-tertiary">
            {displayValue.length} 字符
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-xs text-tertiary hover:text-primary px-2 py-1 rounded hover:bg-secondary transition-colors"
              title="复制内容"
            >
              {copied ? '✓ 已复制' : '📋 复制'}
            </button>
            {node.collapsible && (
              <button
                onClick={toggleExpanded}
                className="text-xs text-tertiary hover:text-primary px-2 py-1 rounded hover:bg-secondary transition-colors"
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
          !isLong && !node.collapsible ? 'mt-mt0' : ''
        }`}
      >
        <pre className="text-sm text-secondary whitespace-pre-wrap break-words font-mono">
          {displayValue}
        </pre>
      </div>

      {/* 折叠时显示预览 */}
      {!isExpanded && isLong && (
        <div className="px-3 py-2 text-sm text-tertiary italic">
          {displayValue.slice(0, 100)}...
        </div>
      )}
    </div>
  );
};

export default StringLongRenderer;
