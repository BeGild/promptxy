import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DiffStatus, NodeType, type ViewNode } from '../../types';
import FileTreeNode from './FileTreeNode';
import { isNumericArray } from '../../utils/arrayHelper';

interface FileTreeProps {
  /** 根节点 */
  rootNode: ViewNode;
  /** 节点选中回调 */
  onNodeSelect: (node: ViewNode) => void;
  /** 初始选中的节点 ID */
  initialSelectedId?: string;
  /** 默认展开的层级深度 */
  defaultExpandDepth?: number;
  /** 受控选中节点 ID（用于外部联动，如 Diff 导航条） */
  selectedNodeId?: string | null;
  /** 单击文件夹时也触发选中（默认 false，保持现有行为） */
  selectFoldersOnClick?: boolean;
}

const STORAGE_KEY_EXPANDED = 'request-viewer:file-tree-expanded';
const STORAGE_KEY_SELECTED = 'request-viewer:file-tree-selected';

/**
 * 构建节点映射与 parent 映射（用于键盘导航、展开祖先、滚动定位）
 */
function buildNodeMaps(
  node: ViewNode,
  maps: {
    nodeMap: Map<string, ViewNode>;
    parentMap: Map<string, string>;
  } = { nodeMap: new Map(), parentMap: new Map() },
  parentId?: string,
): { nodeMap: Map<string, ViewNode>; parentMap: Map<string, string> } {
  maps.nodeMap.set(node.id, node);
  if (parentId) maps.parentMap.set(node.id, parentId);
  if (node.children) {
    node.children.forEach(child => buildNodeMaps(child, maps, node.id));
  }
  return maps;
}

/**
 * 获取节点的所有可见子节点（按顺序）
 */
function getVisibleNodes(
  node: ViewNode,
  expanded: Set<string>,
  nodes: ViewNode[] = [],
): ViewNode[] {
  nodes.push(node);
  if (expanded.has(node.id) && node.children) {
    node.children.forEach(child => getVisibleNodes(child, expanded, nodes));
  }
  return nodes;
}

/**
 * 计算每个节点“变化子孙节点数量”（不包含自身）
 * - 用于 Diff 视图的树节点徽章展示（例如：📁 messages 🟡 2）
 */
function buildChangedDescendantCountMap(
  node: ViewNode,
  map: Map<string, number> = new Map(),
): Map<string, number> {
  let changedChildCount = 0;
  if (node.children) {
    for (const child of node.children) {
      const childMap = buildChangedDescendantCountMap(child, map);
      const childHasChangedDescendants = (childMap.get(child.id) ?? 0) > 0;
      const childSelfChanged = child.diffStatus !== DiffStatus.SAME;
      if (childSelfChanged || childHasChangedDescendants) {
        changedChildCount += 1;
      }
    }
  }

  map.set(node.id, changedChildCount);
  return map;
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
  selectedNodeId: controlledSelectedNodeId,
  selectFoldersOnClick = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 展开的节点集合
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  // 选中的节点 ID
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(
    initialSelectedId ?? rootNode.id,
  );

  const selectedNodeId =
    controlledSelectedNodeId !== undefined ? controlledSelectedNodeId : internalSelectedNodeId;

  // 构建节点映射（用于键盘导航/展开/滚动）
  const { nodeMap, parentMap } = useMemo(() => buildNodeMaps(rootNode), [rootNode]);

  // 获取可见节点列表（用于键盘导航）
  const visibleNodes = useMemo(
    () => getVisibleNodes(rootNode, expandedNodes),
    [rootNode, expandedNodes],
  );

  // diff 子孙变化计数（非 diff 模式下通常全为 0，不影响现有视图）
  const changedDescendantCountMap = useMemo(
    () => buildChangedDescendantCountMap(rootNode),
    [rootNode],
  );

  // 初始化：从 localStorage 恢复状态
  useEffect(() => {
    const defaultExpanded = expandToDepth(rootNode, defaultExpandDepth, new Set());

    // 恢复展开状态
    const storedExpanded = globalThis.localStorage?.getItem(STORAGE_KEY_EXPANDED);
    if (storedExpanded) {
      try {
        const parsed = JSON.parse(storedExpanded);
        setExpandedNodes(new Set(parsed));
      } catch (e) {
        // 忽略解析错误，使用默认状态
        setExpandedNodes(defaultExpanded);
      }
    } else {
      setExpandedNodes(defaultExpanded);
    }

    // 恢复选中状态
    if (controlledSelectedNodeId === undefined) {
      const storedSelected = globalThis.localStorage?.getItem(STORAGE_KEY_SELECTED);
      if (storedSelected) {
        setInternalSelectedNodeId(storedSelected);
      }
    }

    // 默认展开由 defaultExpanded 负责
  }, [rootNode, defaultExpandDepth, controlledSelectedNodeId]);

  // 保存展开状态到 localStorage
  useEffect(() => {
    if (expandedNodes.size > 0) {
      globalThis.localStorage?.setItem(
        STORAGE_KEY_EXPANDED,
        JSON.stringify(Array.from(expandedNodes)),
      );
    }
  }, [expandedNodes]);

  // 保存选中状态到 localStorage
  useEffect(() => {
    if (selectedNodeId) {
      globalThis.localStorage?.setItem(STORAGE_KEY_SELECTED, selectedNodeId);
    }
  }, [selectedNodeId]);

  // 外部受控选中变更时，同步内部状态（避免键盘导航/本地缓存状态失真）
  useEffect(() => {
    if (controlledSelectedNodeId === undefined) return;
    setInternalSelectedNodeId(controlledSelectedNodeId);
  }, [controlledSelectedNodeId]);

  const expandAncestors = useCallback(
    (nodeId: string) => {
      setExpandedNodes(prev => {
        const next = new Set(prev);
        let current = parentMap.get(nodeId);
        while (current) {
          next.add(current);
          current = parentMap.get(current);
        }
        return next;
      });
    },
    [parentMap],
  );

  // 选中节点变化时：展开祖先 + 滚动到可见
  useEffect(() => {
    if (!selectedNodeId) return;

    expandAncestors(selectedNodeId);

    const container = containerRef.current;
    if (!container) return;

    const safeId = selectedNodeId.replace(/"/g, '\\"');
    let tries = 0;

    const tryScroll = () => {
      tries += 1;
      const el = container.querySelector(`[data-file-tree-node-id="${safeId}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (tries < 3) {
        requestAnimationFrame(tryScroll);
      }
    };

    requestAnimationFrame(tryScroll);
  }, [expandAncestors, selectedNodeId]);

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
            setInternalSelectedNodeId(nextNode.id);
            onNodeSelect(nextNode);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          // 选择上一个可见节点
          if (currentIndex > 0) {
            const prevNode = visibleNodes[currentIndex - 1];
            setInternalSelectedNodeId(prevNode.id);
            onNodeSelect(prevNode);
          }
          break;

        case 'ArrowRight': {
          e.preventDefault();
          // 展开（如果是文件夹）
          const currentNode = visibleNodes[currentIndex];
          if (isFolder(currentNode) && !expandedNodes.has(currentNode.id)) {
            handleToggleExpand(currentNode.id);
          }
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          // 折叠或选择父节点
          const current = visibleNodes[currentIndex];
          if (isFolder(current) && expandedNodes.has(current.id)) {
            // 如果已展开，则折叠
            handleToggleExpand(current.id);
          } else {
            const parentId = parentMap.get(current.id);
            if (parentId) {
              const parentNode = nodeMap.get(parentId);
              if (parentNode) {
                setInternalSelectedNodeId(parentNode.id);
                onNodeSelect(parentNode);
              }
            }
          }
          break;
        }

        case 'Enter': {
          e.preventDefault();
          // 切换展开/折叠或选中
          const node = visibleNodes[currentIndex];
          if (isFolder(node)) {
            handleToggleExpand(node.id);
            setInternalSelectedNodeId(node.id);
            onNodeSelect(node);
          } else {
            onNodeSelect(node);
          }
          break;
        }
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
  function expandToDepth(node: ViewNode, depth: number, expanded: Set<string>): Set<string> {
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
  const handleNodeSelect = useCallback(
    (nodeId: string, node: ViewNode) => {
      setInternalSelectedNodeId(nodeId);
      onNodeSelect(node);
    },
    [onNodeSelect],
  );

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
        changedDescendantCountMap={changedDescendantCountMap}
        selectFoldersOnClick={selectFoldersOnClick}
      />
    </div>
  );
};

/**
 * 判断节点是否为"文件夹"（可展开）
 */
function isFolder(node: ViewNode): boolean {
  if (node.type === NodeType.ARRAY && Array.isArray(node.value)) {
    return !isNumericArray(node.value);
  }
  const hasChildren = node.children && node.children.length > 0;
  return node.type === NodeType.JSON || (node.type === NodeType.ARRAY && hasChildren === true);
}

export default React.memo(FileTree);
