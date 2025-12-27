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

import React, { useState, useCallback, useEffect } from 'react';
import type { ViewNode } from '../../types';
import { DiffStatus } from '../../types';
import PrimitiveRenderer from './PrimitiveRenderer';

interface JsonRendererProps {
  node: ViewNode;
}

/**
 * JSON 对象渲染器
 * 树形展示，支持折叠/展开
 */
const JsonRenderer: React.FC<JsonRendererProps> = ({ node }) => {
  const { value, children, id, label, diffStatus } = node;
  const [isExpanded, setIsExpanded] = useState(!node.defaultCollapsed);

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
        return 'border-green-500 text-status-success';
      case DiffStatus.REMOVED:
        return 'border-red-500 text-status-error';
      case DiffStatus.MODIFIED:
        return 'border-yellow-500 text-status-warning';
      default:
        return 'border-subtle text-secondary';
    }
  };

  const childCount = children?.length ?? 0;
  const hasChildren = childCount > 0;

  return (
    <div className={`border-l-2 ${getDiffClass()} ml-2`}>
      {/* 头部 */}
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-secondary rounded cursor-pointer select-none"
        onClick={toggleExpanded}
      >
        <span className="text-tertiary">
          {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
        </span>
        <span className="font-semibold text-sm">{label}:</span>
        <span className="text-xs text-tertiary">
          {hasChildren ? `${childCount} 个字段` : '{}'}
        </span>
      </div>

      {/* 子节点 */}
      {hasChildren && isExpanded && (
        <div className="ml-4">
          {children!.map(child => (
            <div key={child.id} className="my-1">
              <div className="flex items-start gap-2">
                <span className="text-sm text-tertiary font-mono">
                  {child.label}:
                </span>
                <div className="flex-1">
                  <PrimitiveRenderer node={child} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JsonRenderer;
