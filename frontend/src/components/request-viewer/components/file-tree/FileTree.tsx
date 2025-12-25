import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ViewNode } from '../../types';
import FileTreeNode from './FileTreeNode';

interface FileTreeProps {
  /** 根节点 */
  rootNode: ViewNode;
  /** 节点选中回调 */
  onNodeSelect: (node: ViewNode) => void;
  /** 初始选中的节点 ID */
  initialSelectedId?: string;
  /** 默认展开的层级深度 */
  defaultExpandDepth?: number;
}

const STORAGE_KEY_EXPANDED = 'request-viewer:file-tree-expanded';
const STORAGE_KEY_SELECTED = 'request-viewer:file-tree-selected';

/**
 * 构建节点 ID 到节点的映射（用于键盘导航）
 */
function buildNodeMap(node: ViewNode, map: Map<string, ViewNode> = new Map()): Map<string, ViewNode> {
  map.set(node.id, node);
  if (node.children) {
    node.children.forEach(child => buildNodeMap(child, map));
  }
  return map;
}

/**
 * 获取节点的所有可见子节点（按顺序）
 */
function getVisibleNodes(node: ViewNode, expanded: Set<string>, nodes: ViewNode[] = []): ViewNode[] {
  nodes.push(node);
  if (expanded.has(node.id) && node.children) {
    node.children.forEach(child => getVisibleNodes(child, expanded, nodes));
  }
  return nodes;
}

/**
 * 文件树组件
 * 管理展开/选中状态，支持 localStorage 持久化和键盘导航
 */
const FileTree: React.FC<FileTreeProps> = ({
  rootNode,
  onNodeSelect,
  initialSelectedId,
  defaultExpandDepth = 1,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 展开的节点集合
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  // 选中的节点 ID
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialSelectedId ?? rootNode.id);

  // 构建节点映射（用于键盘导航）
  const nodeMap = useMemo(() => buildNodeMap(rootNode), [rootNode]);

  // 获取可见节点列表（用于键盘导航）
  const visibleNodes = useMemo(() => getVisibleNodes(rootNode, expandedNodes), [rootNode, expandedNodes]);

  // 初始化：从 localStorage 恢复状态
  useEffect(() => {
    // 恢复展开状态
    const storedExpanded = localStorage.getItem(STORAGE_KEY_EXPANDED);
    if (storedExpanded) {
      try {
        const parsed = JSON.parse(storedExpanded);
        setExpandedNodes(new Set(parsed));
      } catch (e) {
        // 忽略解析错误，使用默认状态
      }
    }

    // 恢复选中状态
    const storedSelected = localStorage.getItem(STORAGE_KEY_SELECTED);
    if (storedSelected) {
      setSelectedNodeId(storedSelected);
    }

    // 默认展开第一层
    expandToDepth(rootNode, defaultExpandDepth, new Set());
  }, [rootNode, defaultExpandDepth]);

  // 保存展开状态到 localStorage
  useEffect(() => {
    if (expandedNodes.size > 0) {
      localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify(Array.from(expandedNodes)));
    }
  }, [expandedNodes]);

  // 保存选中状态到 localStorage
  useEffect(() => {
    if (selectedNodeId) {
      localStorage.setItem(STORAGE_KEY_SELECTED, selectedNodeId);
    }
  }, [selectedNodeId]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedNodeId) return;

      const currentIndex = visibleNodes.findIndex(n => n.id === selectedNodeId);
      if (currentIndex === -1) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          // 选择下一个可见节点
          if (currentIndex < visibleNodes.length - 1) {
            const nextNode = visibleNodes[currentIndex + 1];
            setSelectedNodeId(nextNode.id);
            onNodeSelect(nextNode);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          // 选择上一个可见节点
          if (currentIndex > 0) {
            const prevNode = visibleNodes[currentIndex - 1];
            setSelectedNodeId(prevNode.id);
            onNodeSelect(prevNode);
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          // 展开（如果是文件夹）
          const currentNode = visibleNodes[currentIndex];
          if (isFolder(currentNode) && !expandedNodes.has(currentNode.id)) {
            handleToggleExpand(currentNode.id);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          // 折叠或选择父节点
          const current = visibleNodes[currentIndex];
          if (isFolder(current) && expandedNodes.has(current.id)) {
            // 如果已展开，则折叠
            handleToggleExpand(current.id);
          } else {
            // 否则选择父节点
            const parentPath = current.path.split('.').slice(0, -1).join('.');
            const parentNode = nodeMap.get(parentPath + `.${current.label.split(' ')[0]}`);
            if (parentNode) {
              // 尝试通过路径查找父节点
              const parentId = Object.keys(Object.fromEntries(nodeMap)).find(id => {
                const n = nodeMap.get(id);
                return n && n.children && n.children.some(c => c.id === current.id);
              });
              if (parentId) {
                const p = nodeMap.get(parentId);
                if (p) {
                  setSelectedNodeId(p.id);
                  onNodeSelect(p);
                }
              }
            }
          }
          break;

        case 'Enter':
          e.preventDefault();
          // 切换展开/折叠或选中
          const node = visibleNodes[currentIndex];
          if (isFolder(node)) {
            handleToggleExpand(node.id);
            setSelectedNodeId(node.id);
            onNodeSelect(node);
          } else {
            onNodeSelect(node);
          }
          break;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedNodeId, visibleNodes, nodeMap, expandedNodes, onNodeSelect]);

  /**
   * 递归展开到指定深度
   */
  function expandToDepth(
    node: ViewNode,
    depth: number,
    expanded: Set<string>
  ): Set<string> {
    if (depth <= 0) return expanded;

    const newExpanded = new Set(expanded);

    // 如果节点有子节点，展开当前节点
    if (node.children && node.children.length > 0) {
      newExpanded.add(node.id);

      // 递归展开子节点
      node.children.forEach(child => {
        const childExpanded = expandToDepth(child, depth - 1, newExpanded);
        childExpanded.forEach(id => newExpanded.add(id));
      });
    }

    return newExpanded;
  }

  /**
   * 切换节点展开/折叠状态
   */
  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  /**
   * 处理节点选中
   */
  const handleNodeSelect = useCallback((nodeId: string, node: ViewNode) => {
    setSelectedNodeId(nodeId);
    onNodeSelect(node);
  }, [onNodeSelect]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-0 overflow-auto overscroll-contain focus-outline-none"
      tabIndex={0}
    >
      <FileTreeNode
        node={rootNode}
        level={0}
        selectedNodeId={selectedNodeId}
        expandedNodes={expandedNodes}
        onNodeSelect={handleNodeSelect}
        onToggleExpand={handleToggleExpand}
      />
    </div>
  );
};

/**
 * 判断节点是否为"文件夹"（可展开）
 */
function isFolder(node: ViewNode): boolean {
  const { NodeType } = require('../../types');
  const { isNumericArray } = require('../../utils/arrayHelper');

  if (node.type === NodeType.ARRAY && Array.isArray(node.value)) {
    return !isNumericArray(node.value);
  }
  const hasChildren = node.children && node.children.length > 0;
  return node.type === NodeType.JSON ||
         (node.type === NodeType.ARRAY && hasChildren === true);
}

export default React.memo(FileTree);
