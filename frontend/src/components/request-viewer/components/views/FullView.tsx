import React from 'react';
import type { ViewNode } from '../../types';
import NodeRenderer from '../renderers/NodeRenderer';

interface FullViewProps {
  viewTree: ViewNode;
}

/**
 * 内容详情视图
 * 完整的树形结构展示
 */
const FullView: React.FC<FullViewProps> = ({ viewTree }) => {
  const renderNode = (node: ViewNode, depth: number = 0): React.ReactNode => {
    const marginStyle = { marginLeft: `${depth * 16}px` };

    return (
      <div key={node.id} className="my-2">
        <div className="flex items-start gap-2" style={marginStyle}>
          {/* 折叠指示器 */}
          {node.collapsible && (
            <span className="text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">
              {node.defaultCollapsed ? '▶' : '▼'}
            </span>
          )}

          {/* 节点标签 */}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            {node.label}:
          </span>

          {/* 节点内容 */}
          <div className="flex-1 min-w-0">
            <NodeRenderer node={node} />
          </div>
        </div>

        {/* 子节点 */}
        {node.children && node.children.length > 0 && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-lg">
      {renderNode(viewTree)}
    </div>
  );
};

export default FullView;
