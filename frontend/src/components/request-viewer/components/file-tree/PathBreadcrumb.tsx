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

import React, { useMemo, useCallback } from 'react';
import { NodeType, type ViewNode } from '../../types';
import { countTokens, formatTokenCount } from '@/utils/tokenCounter';
import type { PromptxyClient } from '@/types';
import { isNumericArray } from '../../utils/arrayHelper';

interface PathBreadcrumbProps {
  /** 节点路径（如 "messages.0.content.0.text"） */
  path: string;
  /** 当前节点（用于计算 token） */
  node?: ViewNode;
  /** 客户端类型（用于选择 tokenizer） */
  client?: PromptxyClient;
  /** 路径片段点击回调 */
  onSegmentClick?: (segment: string, index: number) => void;
}

/**
 * 判断是否为叶子节点（只显示 token 的节点）
 * 与 FileTreeNode 中的 isFolder 逻辑互补
 */
function isLeafNode(node: ViewNode): boolean {
  // 简单类型
  if (node.type === NodeType.PRIMITIVE) return true;
  if (node.type === NodeType.STRING_LONG) return true;
  if (node.type === NodeType.MARKDOWN) return true;
  if (node.type === NodeType.CODE) return true;

  // 数组类型：纯数值数组作为叶子节点
  if (node.type === NodeType.ARRAY && Array.isArray(node.value)) {
    return isNumericArray(node.value);
  }

  // 有 children 的不是叶子节点
  if (node.children && node.children.length > 0) {
    return false;
  }

  return false;
}

/**
 * 路径面包屑组件
 * 显示节点路径，支持点击跳转
 * 叶子节点显示 token 信息
 */
const PathBreadcrumb: React.FC<PathBreadcrumbProps> = React.memo(
  ({ path, node, client, onSegmentClick }) => {
    // 解析路径为片段
    const segments = useMemo(() => path.split('.'), [path]);

    // 计算 token 数量（仅叶子节点）
    const tokenCount = useMemo(() => {
      if (!node || !client || !isLeafNode(node)) return null;

      // 获取节点内容
      let content = '';
      if (typeof node.value === 'string') {
        content = node.value;
      } else if (node.value !== null && node.value !== undefined) {
        content = String(node.value);
      }

      if (!content) return null;
      return countTokens(content, client);
    }, [node, client]);

    // 处理点击事件
    const handleClick = useCallback(
      (segment: string, index: number) => {
        if (onSegmentClick) {
          onSegmentClick(segment, index);
        }
      },
      [onSegmentClick],
    );

    return (
      <div className="flex items-center gap-1 text-sm text-secondary overflow-x-auto">
        {/* 路径片段 */}
        {segments.map((segment, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="flex-shrink-0 text-tertiary">/</span>}
            <button
              onClick={() => handleClick(segment, index)}
              className="flex-shrink-0 hover:text-primary dark:hover:text-primary hover:underline transition-colors truncate max-w-[150px]"
              title={segment}
            >
              {segment}
            </button>
          </React.Fragment>
        ))}

        {/* Token 信息 - 叶子节点显示 */}
        {tokenCount !== null && (
          <>
            <span className="flex-shrink-0 text-tertiary mx-1">·</span>
            <span className="flex-shrink-0 flex items-center gap-1 text-xs text-accent">
              <span>🪙</span>
              <span>{formatTokenCount(tokenCount)}</span>
            </span>
          </>
        )}
      </div>
    );
  },
);

PathBreadcrumb.displayName = 'PathBreadcrumb';

export default PathBreadcrumb;
