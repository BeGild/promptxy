/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="text-gray-700 dark:text-gray-300"
 * - className="bg-gray-100 dark:bg-gray-800"
 *
 * ✅ REQUIRED:
 * - className="text-primary dark:text-primary"
 * - className="bg-canvas dark:bg-secondary"
 */

import React, { memo } from 'react';
import { ChevronRight, ChevronDown, File, FileText, Code, Hash, List, Folder, FolderOpen } from 'lucide-react';
import type { ViewNode } from '../../types';
import { NodeType } from '../../types';
import { isNumericArray } from '../../utils/arrayHelper';

interface FileTreeNodeProps {
  /** 节点数据 */
  node: ViewNode;
  /** 嵌套层级（用于缩进） */
  level: number;
  /** 当前选中的节点 ID */
  selectedNodeId: string | null;
  /** 展开的节点 ID 集合 */
  expandedNodes: Set<string>;
  /** 节点选中回调 */
  onNodeSelect: (nodeId: string, node: ViewNode) => void;
  /** 展开/折叠切换回调 */
  onToggleExpand: (nodeId: string) => void;
}

/**
 * 判断节点是否为"文件夹"（可展开）
 * 纯数值数组作为叶子节点，其他数组和对象作为文件夹
 */
function isFolder(node: ViewNode): boolean {
  // 纯数值数组作为叶子节点
  if (node.type === NodeType.ARRAY && Array.isArray(node.value)) {
    return !isNumericArray(node.value);
  }
  // 对象类型、有子节点的数组都是文件夹
  const hasChildren = node.children && node.children.length > 0;
  return node.type === NodeType.JSON ||
         (node.type === NodeType.ARRAY && hasChildren === true);
}

/**
 * 获取节点对应的图标组件
 */
function getNodeIcon(node: ViewNode, isExpanded: boolean): React.ComponentType<any> {
  if (isFolder(node)) {
    return isExpanded ? FolderOpen : Folder;
  }

  switch (node.type) {
    case NodeType.MARKDOWN:
    case NodeType.STRING_LONG:
      return FileText;
    case NodeType.CODE:
      return Code;
    case NodeType.ARRAY:
      return List;
    case NodeType.PRIMITIVE:
      // 数值类型使用 Hash 图标
      if (typeof node.value === 'number') {
        return Hash;
      }
      return File;
    default:
      return File;
  }
}

/**
 * 获取节点标签显示文本
 * 格式: label 或 label: preview
 */
function getNodeLabel(node: ViewNode): string {
  const folder = isFolder(node);

  if (folder) {
    // 数组显示元素数量
    if (node.type === NodeType.ARRAY) {
      const count = node.children?.length ?? 0;
      return `${node.label} (${count})`;
    }
    // 对象显示子项数量
    if (node.type === NodeType.JSON) {
      const count = node.children?.length ?? 0;
      return `${node.label} (${count} 项)`;
    }
    return node.label;
  }

  // 叶子节点：添加值预览
  const valueStr = String(node.value ?? '');
  const preview = valueStr.length > 30 ? valueStr.slice(0, 30) + '...' : valueStr;

  if (node.type === NodeType.PRIMITIVE && typeof node.value !== 'string') {
    // 非字符串简单值，不显示预览
    return node.label;
  }

  return `${node.label}: ${preview}`;
}

/**
 * 文件树节点组件
 * 支持递归渲染，根据节点类型显示不同图标
 */
const FileTreeNode: React.FC<FileTreeNodeProps> = memo(({
  node,
  level,
  selectedNodeId,
  expandedNodes,
  onNodeSelect,
  onToggleExpand,
}) => {
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const folder = isFolder(node);
  const IconComponent = getNodeIcon(node, isExpanded);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (folder) {
      // 文件夹：切换展开/折叠
      onToggleExpand(node.id);
    } else {
      // 叶子节点：选中
      onNodeSelect(node.id, node);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (folder) {
      // 双击文件夹：选中并展开
      onToggleExpand(node.id);
      onNodeSelect(node.id, node);
    }
  };

  return (
    <div>
      {/* 节点行 */}
      <div
        className={`
          flex items-center gap-1 py-1 px-2 rounded cursor-pointer select-none
          hover:bg-canvas dark:hover:bg-secondary
          transition-colors duration-150
          ${isSelected ? 'bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-primary/80' : 'text-primary'}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={node.path}
      >
        {/* 展开/折叠指示器 */}
        {folder ? (
          <span className="flex-shrink-0 text-tertiary">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-[14px] flex-shrink-0" />
        )}

        {/* 节点图标 */}
        <IconComponent size={14} className="flex-shrink-0 text-secondary" />

        {/* 节点标签 */}
        <span className="text-sm truncate flex-1">
          {getNodeLabel(node)}
        </span>
      </div>

      {/* 子节点 */}
      {folder && isExpanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map(child => (
            <FileTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedNodeId={selectedNodeId}
              expandedNodes={expandedNodes}
              onNodeSelect={onNodeSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
});

FileTreeNode.displayName = 'FileTreeNode';

export default FileTreeNode;
