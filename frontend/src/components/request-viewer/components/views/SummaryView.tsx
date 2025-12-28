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

import React, { useState } from 'react';
import type { ViewNode, ViewGroup } from '../../types';
import NodeRenderer from '../renderers/NodeRenderer';

interface SummaryViewProps {
  viewTree: ViewNode;
  groups: ViewGroup[];
}

/**
 * 结构概览视图
 * 按分组展示关键内容
 */
const SummaryView: React.FC<SummaryViewProps> = ({ viewTree, groups }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // 获取分组对应的节点
  const getGroupNodes = (group: ViewGroup): ViewNode[] => {
    const nodes: ViewNode[] = [];
    const findNodes = (node: ViewNode, paths: string[]) => {
      if (paths.includes(node.path)) {
        nodes.push(node);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findNodes(child, paths)) {
            return true;
          }
        }
      }
      return false;
    };
    findNodes(viewTree, group.nodePaths);
    return nodes;
  };

  return (
    <div className="space-y-md">
      {groups.map(group => {
        const groupNodes = getGroupNodes(group);
        const isExpanded = expandedGroups.has(group.id);

        return (
          <div key={group.id} className="border border-subtle rounded-lg overflow-hidden">
            {/* 分组头部 */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-brand-primary/10 dark:bg-brand-primary/20 cursor-pointer hover:bg-brand-primary/20 dark:hover:bg-brand-primary/30 transition-colors"
              onClick={() => toggleGroup(group.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{group.icon}</span>
                <h3 className="font-semibold text-primary">{group.label}</h3>
                <span className="text-xs text-secondary">({groupNodes.length} 个字段)</span>
              </div>
              <span className="text-tertiary">{isExpanded ? '▼' : '▶'}</span>
            </div>

            {/* 分组描述 */}
            {group.description && isExpanded && (
              <div className="px-4 py-2 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 border-b border-brand-primary/30 dark:border-brand-primary/20">
                <p className="text-xs text-secondary">{group.description}</p>
              </div>
            )}

            {/* 分组内容 */}
            {isExpanded && (
              <div className="p-4 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 space-y-3">
                {groupNodes.map(node => (
                  <div key={node.id}>
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-sm font-medium text-primary">{node.label}:</span>
                    </div>
                    <div className="ml-4">
                      <NodeRenderer node={node} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SummaryView;
