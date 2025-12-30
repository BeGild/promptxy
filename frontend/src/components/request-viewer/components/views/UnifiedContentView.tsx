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

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileText,
  Eye,
  GitCompare,
} from 'lucide-react';
import { Panel, Group, Separator, useDefaultLayout } from 'react-resizable-panels';
import { DiffStatus, NodeType, type ViewNode } from '../../types';
import FileTree from '../file-tree/FileTree';
import FileContentPanel from '../file-tree/FileContentPanel';
import DiffContentPanel from '../diff/DiffContentPanel';
import PathBreadcrumb from '../file-tree/PathBreadcrumb';
import { getNodeCopyContent, copyToClipboard } from '../../utils/clipboard';
import { buildHunks, diffLines } from '../../utils/textDiff';
import { isNumericArray } from '../../utils/arrayHelper';
import { MatchModeSelector } from '@/components/rules/MatchModeSelector';
import { MatchMode, type RegexResult } from '@/utils/regexGenerator';
import type { ListImperativeAPI } from 'react-window';

interface UnifiedContentViewProps {
  /** 视图树根节点（修改后请求） */
  viewTree: ViewNode;
  /** 原始请求的视图树（用于差异对比，可选） */
  originalTree?: ViewNode;
  /** 基于选中内容创建规则的回调 */
  onSelectionBasedCreate?: (
    selectedText: string,
    mode: MatchMode,
    ignoreCase: boolean,
    multiline: boolean,
    result: RegexResult,
  ) => void;
  /** 基于当前请求创建规则的回调 */
  onBasedOnRequestCreate?: () => void;
}

const STORAGE_KEY_PANEL_SIZES = 'request-viewer:panel-sizes';
const DEFAULT_LAYOUT: Record<string, number> = { tree: 30, content: 70 };
const RESIZABLE_PANELS_STORAGE_PREFIX = 'react-resizable-panels:';

// 工具函数：从 DiffView 迁移
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
  if (typeof window === 'undefined') return 24;
  const raw = globalThis
    .getComputedStyle(globalThis.document.documentElement)
    .getPropertyValue('--spacing-h6')
    .trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 24;
}

/**
 * 统一内容视图组件
 * - 左侧：文件树
 * - 右侧：内容详情面板 / 差异对比面板
 * - 支持拖拽调整面板宽度
 * - 支持差异对比模式切换
 */
const UnifiedContentView: React.FC<UnifiedContentViewProps> = React.memo(
  ({ viewTree, originalTree, onSelectionBasedCreate, onBasedOnRequestCreate }) => {
    // 状态：内容详情模式
    const [selectedNode, setSelectedNode] = useState<ViewNode>(viewTree);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
    const [copied, setCopied] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [showRuleCreator, setShowRuleCreator] = useState(false);

    // 状态：差异对比模式
    const [isDiffMode, setIsDiffMode] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [activeHunkIndex, setActiveHunkIndex] = useState<number | null>(null);

    // 当 viewTree 变化时（用户点击不同请求行），同步更新 selectedNode
    // 这确保了请求详情内容区域能正确显示新请求的数据
    useEffect(() => {
      setSelectedNode(viewTree);
    }, [viewTree]);

    // Refs
    const listRef = React.useRef<ListImperativeAPI | null>(null);
    const rowHeightPx = useMemo(() => getRowHeightPx(), []);

    // 面板布局配置
    const panelLayoutStorage = useMemo(() => {
      return {
        getItem: (key: string) => {
          const normalizedKey = key.startsWith(RESIZABLE_PANELS_STORAGE_PREFIX)
            ? key.slice(RESIZABLE_PANELS_STORAGE_PREFIX.length)
            : key;
          const value = globalThis.localStorage?.getItem(normalizedKey);
          if (!value) return null;
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

    const { defaultLayout: persistedLayout, onLayoutChange: handleLayoutChange } = useDefaultLayout(
      {
        id: STORAGE_KEY_PANEL_SIZES,
        storage: panelLayoutStorage,
      },
    );
    const defaultLayout = persistedLayout ?? DEFAULT_LAYOUT;

    // 差异计算
    const changedLeafNodes = useMemo(
      () => (originalTree ? collectChangedLeafNodes(viewTree) : []),
      [viewTree, originalTree],
    );
    const hasAnyChanges = changedLeafNodes.length > 0;

    // 根据模式选择的节点
    const originalNode = useMemo(() => {
      if (!isDiffMode || !originalTree || !selectedNodeId) return undefined;
      return findNodeByPath(originalTree, selectedNodeId);
    }, [isDiffMode, originalTree, selectedNodeId]);

    const modifiedNode = useMemo(() => {
      if (!isDiffMode || !selectedNodeId) return undefined;
      return findNodeByPath(viewTree, selectedNodeId);
    }, [isDiffMode, viewTree, selectedNodeId]);

    const diffSelectedNode = modifiedNode ?? originalNode ?? null;
    const isDiffLeaf = useMemo(
      () => (diffSelectedNode ? !isFolderNode(diffSelectedNode) : false),
      [diffSelectedNode],
    );

    const { rows, hunks } = useMemo(() => {
      if (!isDiffMode || !diffSelectedNode || !isDiffLeaf) {
        return { rows: [], hunks: [] };
      }
      const leftText = originalNode ? getNodeCopyContent(originalNode) : '';
      const rightText = modifiedNode ? getNodeCopyContent(modifiedNode) : '';
      const nextRows = diffLines(leftText, rightText);
      return { rows: nextRows, hunks: buildHunks(nextRows) };
    }, [isDiffMode, diffSelectedNode, isDiffLeaf, originalNode, modifiedNode]);

    // 初次进入差异模式或节点变化时：重置差异块焦点
    useEffect(() => {
      if (!isDiffMode) return;

      if (!selectedNodeId && hasAnyChanges) {
        setSelectedNodeId(changedLeafNodes[0].id);
        return;
      }

      if (hunks.length === 0) {
        setActiveHunkIndex(null);
      } else {
        setActiveHunkIndex(0);
      }
    }, [isDiffMode, changedLeafNodes, hasAnyChanges, selectedNodeId, hunks.length]);

    // 处理节点选中（内容详情模式）
    const handleNodeSelect = useCallback((node: ViewNode) => {
      if (isDiffMode) {
        setSelectedNodeId(node.id);
      } else {
        setSelectedNode(node);
      }
      // 切换节点时重置为纯文本模式
      setIsMarkdownPreview(false);
    }, [isDiffMode]);

    // 切换差异对比模式
    const handleToggleDiffMode = useCallback(() => {
      const newMode = !isDiffMode;
      setIsDiffMode(newMode);
      // 切换到差异模式时，如果没有选中节点且有变化节点，选中第一个
      if (newMode && !selectedNodeId && hasAnyChanges) {
        setSelectedNodeId(changedLeafNodes[0].id);
      }
    }, [isDiffMode, selectedNodeId, hasAnyChanges, changedLeafNodes]);

    // 差异导航
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

    // 全屏切换
    const handleToggleFullScreen = useCallback(() => {
      setIsFullScreen(prev => !prev);
    }, []);

    // 复制
    const handleCopy = useCallback(async () => {
      const node = isDiffMode ? diffSelectedNode : selectedNode;
      if (!node) return;
      const content = getNodeCopyContent(node);
      const success = await copyToClipboard(content);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }, [isDiffMode, diffSelectedNode, selectedNode]);

    // 选中文本变化
    const handleSelectionChange = useCallback((text: string) => {
      setSelectedText(text);
    }, []);

    // 判断当前节点是否支持快速创建
    const supportsQuickCreate = useMemo(() => {
      const node = isDiffMode ? diffSelectedNode : selectedNode;
      return (
        !isMarkdownPreview &&
        node &&
        [NodeType.STRING_LONG, NodeType.MARKDOWN].includes(node.type)
      );
    }, [isDiffMode, diffSelectedNode, selectedNode, isMarkdownPreview]);

    // 匹配模式选择确认
    const handleMatchModeConfirm = useCallback(
      (mode: MatchMode, ignoreCase: boolean, multiline: boolean, result: RegexResult) => {
        if (mode === MatchMode.BASED_ON_REQUEST) {
          onBasedOnRequestCreate?.();
        } else {
          onSelectionBasedCreate?.(selectedText, mode, ignoreCase, multiline, result);
        }
        setShowRuleCreator(false);
      },
      [selectedText, onSelectionBasedCreate, onBasedOnRequestCreate],
    );

    // ESC 键退出全屏
    useEffect(() => {
      if (isFullScreen) {
        const handleEscape = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            setIsFullScreen(false);
          }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
      }
    }, [isFullScreen]);

    // 当前显示的面包屑路径
    const currentPath = isDiffMode
      ? (diffSelectedNode?.path ?? '')
      : selectedNode.path;

    const content = (
      <div className="h-full flex flex-col">
        {/* 工具栏 */}
        <div className="flex items-center justify-between border-b border-brand-primary/30 dark:border-brand-primary/20 bg-brand-primary/10 dark:bg-brand-primary/20 px-4 py-1.5 shrink-0">
          {/* 左侧：面包屑路径 */}
          <div className="flex-1 overflow-hidden min-w-0">
            <PathBreadcrumb path={currentPath} />
          </div>

          {/* 右侧：按钮组 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* 动态按钮组：差异导航、创建规则、复制 */}
            <div className="flex items-center gap-1.5">
              {/* 差异导航按钮 - 仅差异模式显示 */}
              {isDiffMode && hunks.length > 0 && activeHunkIndex !== null && (
                <>
                  <button
                    onClick={handlePrevHunk}
                    disabled={activeHunkIndex <= 0}
                    className="px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-secondary hover:bg-canvas dark:hover:bg-secondary"
                  >
                    <ChevronLeft size={14} />
                    <span>上</span>
                  </button>
                  <span className="text-xs text-secondary min-w-[3rem] text-center">
                    {activeHunkIndex + 1} / {hunks.length}
                  </span>
                  <button
                    onClick={handleNextHunk}
                    disabled={activeHunkIndex >= hunks.length - 1}
                    className="px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-secondary hover:bg-canvas dark:hover:bg-secondary"
                  >
                    <span>下</span>
                    <ChevronRight size={14} />
                  </button>
                </>
              )}

              {/* 创建规则按钮 */}
              {supportsQuickCreate && (onSelectionBasedCreate || onBasedOnRequestCreate) && (
                <button
                  onClick={() => setShowRuleCreator(!showRuleCreator)}
                  className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                    showRuleCreator
                      ? 'text-brand-primary bg-brand-primary/20 dark:bg-brand-primary/30'
                      : 'text-secondary hover:bg-canvas dark:hover:bg-secondary'
                  }`}
                  title="快速创建规则（可选基于选中内容）"
                >
                  <Sparkles size={14} />
                  <span>{showRuleCreator ? '收起' : '创建规则'}</span>
                </button>
              )}

              {/* 复制按钮 */}
              <button
                onClick={handleCopy}
                className="flex-shrink-0 px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 text-secondary hover:bg-canvas dark:hover:bg-secondary"
                title={copied ? '已复制' : '复制'}
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>复制</span>
                  </>
                )}
              </button>
            </div>

            {/* 分隔符 */}
            <div className="w-px h-6 bg-brand-primary/20 dark:bg-brand-primary/30 mx-1" />

            {/* 视图切换按钮组 - 固定位置 */}
            <div className="flex items-center gap-1">
              {/* 文本/预览按钮 */}
              {((isDiffMode && diffSelectedNode &&
                [NodeType.MARKDOWN, NodeType.STRING_LONG].includes(diffSelectedNode.type)) ||
                (!isDiffMode &&
                  [NodeType.MARKDOWN, NodeType.STRING_LONG].includes(selectedNode.type))) && (
                <>
                  <button
                    onClick={() => {
                      setIsDiffMode(false);
                      setIsMarkdownPreview(false);
                    }}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                      !isDiffMode && !isMarkdownPreview
                        ? 'bg-brand-primary text-white'
                        : 'text-secondary hover:bg-canvas dark:hover:bg-secondary'
                    }`}
                  >
                    <FileText size={14} />
                    <span>文本</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsDiffMode(false);
                      setIsMarkdownPreview(true);
                    }}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                      !isDiffMode && isMarkdownPreview
                        ? 'bg-brand-primary text-white'
                        : 'text-secondary hover:bg-canvas dark:hover:bg-secondary'
                    }`}
                  >
                    <Eye size={14} />
                    <span>预览</span>
                  </button>
                </>
              )}

              {/* 差异按钮 */}
              {originalTree && (
                <button
                  onClick={handleToggleDiffMode}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                    isDiffMode
                      ? 'bg-brand-primary text-white'
                      : 'text-secondary hover:bg-canvas dark:hover:bg-secondary'
                  }`}
                >
                  <GitCompare size={14} />
                  <span>差异</span>
                </button>
              )}
            </div>

            {/* 分隔符 */}
            <div className="w-px h-6 bg-brand-primary/20 dark:bg-brand-primary/30 mx-1" />

            {/* 全屏按钮 - 固定位置 */}
            <button
              onClick={handleToggleFullScreen}
              className="flex-shrink-0 px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 text-secondary hover:bg-canvas dark:hover:bg-secondary"
              title={isFullScreen ? '退出全屏 (ESC)' : '全屏'}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 size={14} />
                  <span>退出全屏</span>
                </>
              ) : (
                <>
                  <Maximize2 size={14} />
                  <span>全屏</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 规则创建器 */}
        {showRuleCreator && supportsQuickCreate && (
          <div className="border-b border-brand-primary/30 dark:border-brand-primary/20 bg-elevated dark:bg-secondary px-4 py-3 shrink-0">
            <MatchModeSelector
              onConfirm={handleMatchModeConfirm}
              selectedText={selectedText}
              supportBasedOnRequest={!!onBasedOnRequestCreate}
              triggerLabel="匹配模式"
            />
          </div>
        )}

        {/* 左右分栏 */}
        <Group
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChange={handleLayoutChange}
          className="flex-1 min-h-0 w-full"
        >
          {/* 左侧：文件树 */}
          <Panel id="tree" minSize="15%" maxSize="50%" className="bg-canvas dark:bg-secondary">
            <div className="h-full pt-4 overflow-auto">
              <FileTree
                rootNode={viewTree}
                onNodeSelect={handleNodeSelect}
                selectedNodeId={isDiffMode ? selectedNodeId : selectedNode.id}
                initialSelectedId={isDiffMode ? (selectedNodeId ?? undefined) : selectedNode.id}
                defaultExpandDepth={1}
                selectFoldersOnClick={isDiffMode}
              />
            </div>
          </Panel>

          {/* 分割条 */}
          <Separator className="group relative w-4 bg-border cursor-col-resize select-none touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-secondary hover:bg-brand-primary/50 transition-colors">
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-brand-primary/40 group-data-[separator=hover]:bg-brand-primary group-data-[separator=active]:bg-brand-primary-hover transition-colors" />
          </Separator>

          {/* 右侧：内容面板（条件渲染） */}
          <Panel id="content" minSize="50%">
            {isDiffMode ? (
              <div className="h-full min-h-0 p-4">
                <DiffContentPanel
                  hasAnyChanges={hasAnyChanges}
                  selectedNode={diffSelectedNode}
                  isLeaf={isDiffLeaf}
                  rows={rows}
                  hunks={hunks}
                  activeHunkIndex={activeHunkIndex}
                  onSelectHunk={scrollToHunk}
                  listRef={listRef}
                  rowHeightPx={rowHeightPx}
                />
              </div>
            ) : (
              <FileContentPanel
                selectedNode={selectedNode}
                isFullScreen={isFullScreen}
                isMarkdownPreview={isMarkdownPreview}
                onSelectionChange={handleSelectionChange}
              />
            )}
          </Panel>
        </Group>
      </div>
    );

    return isFullScreen ? (
      createPortal(
        <div className="fixed inset-0 z-[9999] bg-canvas dark:bg-secondary">{content}</div>,
        document.body,
      )
    ) : (
      <div className="h-full min-h-0 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
        {content}
      </div>
    );
  },
);

UnifiedContentView.displayName = 'UnifiedContentView';

export default UnifiedContentView;
