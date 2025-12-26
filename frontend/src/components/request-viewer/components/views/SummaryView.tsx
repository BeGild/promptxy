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
    <div className="space-y-4">
      {groups.map(group => {
        const groupNodes = getGroupNodes(group);
        const isExpanded = expandedGroups.has(group.id);

        return (
          <div
            key={group.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            {/* 分组头部 */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-blue-50/50 dark:bg-blue-900/20 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors"
              onClick={() => toggleGroup(group.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{group.icon}</span>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{group.label}</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({groupNodes.length} 个字段)
                </span>
              </div>
              <span className="text-gray-400">
                {isExpanded ? '▼' : '▶'}
              </span>
            </div>

            {/* 分组描述 */}
            {group.description && isExpanded && (
              <div className="px-4 py-2 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10 border-b border-blue-200/50 dark:border-blue-800/30">
                <p className="text-xs text-gray-600 dark:text-gray-400">{group.description}</p>
              </div>
            )}

            {/* 分组内容 */}
            {isExpanded && (
              <div className="p-4 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10 space-y-3">
                {groupNodes.map(node => (
                  <div key={node.id}>
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {node.label}:
                      </span>
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
