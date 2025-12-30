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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { DiffStatus, NodeType, type ViewNode } from '../../types';
import FileTree from '../file-tree/FileTree';
import DiffContentPanel from '../diff/DiffContentPanel';
import DiffToolbar from '../diff/DiffToolbar';
import { getNodeCopyContent } from '../../utils/clipboard';
import { buildHunks, diffLines } from '../../utils/textDiff';
import type { ListImperativeAPI } from 'react-window';
import { isNumericArray } from '../../utils/arrayHelper';

interface DiffViewProps {
  originalTree: ViewNode;
  modifiedTree: ViewNode;
}

const STORAGE_KEY_PANEL_SIZES = 'request-viewer:panel-sizes';
const DEFAULT_LAYOUT: Record<string, number> = { tree: 30, content: 70 };
const RESIZABLE_PANELS_STORAGE_PREFIX = 'react-resizable-panels:';

function findNodeByPath(root: ViewNode, targetPath: string): ViewNode | undefined {
  if (root.path === targetPath || root.id === targetPath) return root;
  if (!root.children) return undefined;
  for (const child of root.children) {
    const found = findNodeByPath(child, targetPath);
    if (found) return found;
  }
  return undefined;
}

function isFolderNode(node: ViewNode): boolean {
  // 与 FileTreeNode 的判定保持一致：纯数值数组视为叶子节点，其余对象/数组视为文件夹
  if (node.type === NodeType.ARRAY && Array.isArray(node.value)) {
    return !isNumericArray(node.value);
  }

  const hasChildren = node.children && node.children.length > 0;
  return node.type === NodeType.JSON || (node.type === NodeType.ARRAY && hasChildren === true);
}

function collectChangedLeafNodes(node: ViewNode, diffs: ViewNode[] = []): ViewNode[] {
  const isLeaf = !isFolderNode(node);
  if (isLeaf && node.diffStatus !== DiffStatus.SAME) {
    diffs.push(node);
    return diffs;
  }

  if (node.children) {
    node.children.forEach(child => collectChangedLeafNodes(child, diffs));
  }
  return diffs;
}

function getRowHeightPx(): number {
  // rowHeight 只能是 number（px），优先使用 design token（CSS 变量）来避免硬编码。
  if (typeof window === 'undefined') return 24;
  const raw = globalThis
    .getComputedStyle(globalThis.document.documentElement)
    .getPropertyValue('--spacing-h6')
    .trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 24;
}

/**
 * 差异对比视图（左右对比布局）
 * - 左：目录树（仅 modifiedTree）
 * - 右：叶子节点=虚拟文件的行级文本 diff（两栏对齐 + 同步滚动）
 * - 支持拖拽分栏，且与 Content Detail 共享分栏比例
 */
const DiffView: React.FC<DiffViewProps> = ({ originalTree, modifiedTree }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeHunkIndex, setActiveHunkIndex] = useState<number | null>(null);

  const listRef = React.useRef<ListImperativeAPI | null>(null);
  const rowHeightPx = useMemo(() => getRowHeightPx(), []);

  const changedLeafNodes = useMemo(
    () => collectChangedLeafNodes(modifiedTree),
    [modifiedTree],
  );
  const hasAnyChanges = changedLeafNodes.length > 0;

  // 初次进入时：默认选中第一个“变化的叶子节点”（避免右侧空白）
  useEffect(() => {
    if (selectedNodeId) return;
    if (!hasAnyChanges) return;
    setSelectedNodeId(changedLeafNodes[0].id);
  }, [changedLeafNodes, hasAnyChanges, selectedNodeId]);

  // 自定义 storage：与 FileBrowserView 共用同一个 localStorage key
  const panelLayoutStorage = useMemo(() => {
    return {
      getItem: (key: string) => {
        const normalizedKey = key.startsWith(RESIZABLE_PANELS_STORAGE_PREFIX)
          ? key.slice(RESIZABLE_PANELS_STORAGE_PREFIX.length)
          : key;
        const value = globalThis.localStorage?.getItem(normalizedKey);
        if (!value) return null;

        // 防御：忽略无效/不匹配的 layout（避免 Group 初始化时被库直接丢弃）
        try {
          const parsed = JSON.parse(value);
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            typeof parsed.tree === 'number' &&
            typeof parsed.content === 'number'
          ) {
            return value;
          }
        } catch (e) {
          // ignore
        }
        return null;
      },
      setItem: (key: string, value: string) => {
        const normalizedKey = key.startsWith(RESIZABLE_PANELS_STORAGE_PREFIX)
          ? key.slice(RESIZABLE_PANELS_STORAGE_PREFIX.length)
          : key;
        globalThis.localStorage?.setItem(normalizedKey, value);
      },
    };
  }, []);

  const { defaultLayout: persistedLayout, onLayoutChange: handleLayoutChange } = useDefaultLayout({
    id: STORAGE_KEY_PANEL_SIZES,
    storage: panelLayoutStorage,
  });
  const defaultLayout = persistedLayout ?? DEFAULT_LAYOUT;

  const handleNodeSelect = useCallback((node: ViewNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const originalNode = useMemo(() => {
    if (!selectedNodeId) return undefined;
    return findNodeByPath(originalTree, selectedNodeId);
  }, [originalTree, selectedNodeId]);

  const modifiedNode = useMemo(() => {
    if (!selectedNodeId) return undefined;
    return findNodeByPath(modifiedTree, selectedNodeId);
  }, [modifiedTree, selectedNodeId]);

  const selectedNode = modifiedNode ?? originalNode ?? null;
  const isLeaf = useMemo(() => (selectedNode ? !isFolderNode(selectedNode) : false), [selectedNode]);

  const { rows, hunks } = useMemo(() => {
    if (!selectedNode || !isLeaf) return { rows: [], hunks: [] };

    const leftText = originalNode ? getNodeCopyContent(originalNode) : '';
    const rightText = modifiedNode ? getNodeCopyContent(modifiedNode) : '';
    const nextRows = diffLines(leftText, rightText);
    return { rows: nextRows, hunks: buildHunks(nextRows) };
  }, [isLeaf, modifiedNode, originalNode, selectedNode]);

  // 选中文件变化时：重置差异块焦点
  useEffect(() => {
    if (hunks.length === 0) {
      setActiveHunkIndex(null);
      return;
    }
    setActiveHunkIndex(0);
  }, [selectedNodeId, hunks.length]);

  const scrollToHunk = useCallback(
    (index: number) => {
      if (hunks.length === 0) return;
      const nextIndex = Math.max(0, Math.min(index, hunks.length - 1));
      setActiveHunkIndex(nextIndex);
      listRef.current?.scrollToRow({ index: hunks[nextIndex].startRow, align: 'start' });
    },
    [hunks],
  );

  const handlePrevHunk = useCallback(() => {
    if (activeHunkIndex === null) return;
    scrollToHunk(activeHunkIndex - 1);
  }, [activeHunkIndex, scrollToHunk]);

  const handleNextHunk = useCallback(() => {
    if (activeHunkIndex === null) return;
    scrollToHunk(activeHunkIndex + 1);
  }, [activeHunkIndex, scrollToHunk]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 rounded-lg border border-subtle overflow-hidden">
      <DiffToolbar
        hunkCount={hunks.length}
        activeHunkIndex={activeHunkIndex}
        onPrevHunk={handlePrevHunk}
        onNextHunk={handleNextHunk}
      />

      <Group
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChange={handleLayoutChange}
        className="flex-1 min-h-0 w-full"
      >
        {/* 左侧：目录树（modifiedTree） */}
        <Panel id="tree" minSize="15%" maxSize="50%" className="bg-canvas dark:bg-secondary">
          <div className="h-full pt-4 overflow-auto">
            <FileTree
              rootNode={modifiedTree}
              onNodeSelect={handleNodeSelect}
              selectedNodeId={selectedNodeId}
              defaultExpandDepth={1}
              selectFoldersOnClick={true}
            />
          </div>
        </Panel>

        {/* 分割条 */}
        <Separator className="group relative w-4 bg-transparent cursor-col-resize select-none touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-secondary">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-subtle group-data-[separator=hover]:bg-brand-primary group-data-[separator=active]:bg-brand-primary-hover transition-colors" />
        </Separator>

        {/* 右侧：内容面板 */}
        <Panel id="content" minSize="50%">
          <div className="h-full min-h-0 p-4">
            <DiffContentPanel
              hasAnyChanges={hasAnyChanges}
              selectedNode={selectedNode}
              isLeaf={isLeaf}
              rows={rows}
              hunks={hunks}
              activeHunkIndex={activeHunkIndex}
              onSelectHunk={scrollToHunk}
              listRef={listRef}
              rowHeightPx={rowHeightPx}
            />
          </div>
        </Panel>
      </Group>
    </div>
  );
};

export default DiffView;
