import React from 'react';
import { NodeType, type ViewNode } from '../../types';
import PrimitiveRenderer from './PrimitiveRenderer';
import StringLongRenderer from './StringLongRenderer';
import MarkdownRenderer from './MarkdownRenderer';
import JsonRenderer from './JsonRenderer';
import ArrayRenderer from './ArrayRenderer';

interface NodeRendererProps {
  node: ViewNode;
}

/**
 * 节点渲染器入口组件
 * 根据节点类型选择合适的渲染器
 */
const NodeRenderer: React.FC<NodeRendererProps> = ({ node }) => {
  // 如果节点有自定义渲染器，使用自定义渲染器
  if (node.customRenderer) {
    const CustomRenderer = node.customRenderer;
    return <CustomRenderer node={node} />;
  }

  // 根据节点类型选择渲染器
  switch (node.type) {
    case NodeType.PRIMITIVE:
      return <PrimitiveRenderer node={node} />;

    case NodeType.STRING_LONG:
      return <StringLongRenderer node={node} />;

    case NodeType.JSON:
      return <JsonRenderer node={node} />;

    case NodeType.ARRAY:
      return <ArrayRenderer node={node} />;

    case NodeType.MARKDOWN:
      return <MarkdownRenderer node={node} />;

    case NodeType.CODE:
      // 代码渲染器稍后实现
      return <StringLongRenderer node={node} />;

    default:
      return <PrimitiveRenderer node={node} />;
  }
};

export default NodeRenderer;
