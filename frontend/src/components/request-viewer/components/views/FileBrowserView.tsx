import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Maximize2, Minimize2, Copy, Check } from 'lucide-react';
import {
  Panel,
  Group,
  Separator,
  useDefaultLayout,
} from 'react-resizable-panels';
import type { ViewNode } from '../../types';
import { NodeType } from '../../types';
import FileTree from '../file-tree/FileTree';
import FileContentPanel from '../file-tree/FileContentPanel';
import PathBreadcrumb from '../file-tree/PathBreadcrumb';
import { getNodeCopyContent, copyToClipboard } from '../../utils/clipboard';

interface FileBrowserViewProps {
  /** 视图树根节点 */
  viewTree: ViewNode;
}

const STORAGE_KEY_PANEL_SIZES = 'request-viewer:panel-sizes';
const DEFAULT_LAYOUT: Record<string, number> = { tree: 30, content: 70 };
const RESIZABLE_PANELS_STORAGE_PREFIX = 'react-resizable-panels:';

/**
 * 文件浏览器风格的视图组件
 * 左侧：文件树，右侧：内容面板
 * 支持拖拽调整面板宽度
 */
const FileBrowserView: React.FC<FileBrowserViewProps> = React.memo(({ viewTree }) => {
  const [selectedNode, setSelectedNode] = useState<ViewNode>(viewTree);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  // 自定义 storage：让 useDefaultLayout 仍然写入我们既有的 localStorage key（不引入新的前缀 key）
  const panelLayoutStorage = useMemo(() => {
    return {
      getItem: (key: string) => {
        const normalizedKey = key.startsWith(RESIZABLE_PANELS_STORAGE_PREFIX)
          ? key.slice(RESIZABLE_PANELS_STORAGE_PREFIX.length)
          : key;
        const value = localStorage.getItem(normalizedKey);
        if (!value) return null;

        // 防御：忽略无效/不匹配的 layout，避免 Group 初始化时被库直接丢弃导致“恢复不生效”
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
        localStorage.setItem(normalizedKey, value);
      },
    };
  }, []);

  const { defaultLayout: persistedLayout, onLayoutChange: handleLayoutChange } = useDefaultLayout({
    id: STORAGE_KEY_PANEL_SIZES,
    storage: panelLayoutStorage,
  });
  const defaultLayout = persistedLayout ?? DEFAULT_LAYOUT;

  /**
   * 处理节点选中
   */
  const handleNodeSelect = useCallback((node: ViewNode) => {
    setSelectedNode(node);
    // 切换节点时重置为纯文本模式
    setIsMarkdownPreview(false);
  }, []);

  /**
   * 处理全屏切换
   */
  const handleToggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
  }, []);

  /**
   * 处理复制
   */
  const handleCopy = useCallback(async () => {
    const content = getNodeCopyContent(selectedNode);
    const success = await copyToClipboard(content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedNode]);

  // 处理 ESC 键退出全屏
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

  const content = (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChange={handleLayoutChange}
      className="h-full min-h-0 w-full"
    >
      {/* 左侧：文件树 */}
      <Panel
        id="tree"
        minSize="15%"
        maxSize="50%"
        className={isFullScreen ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}
      >
        <FileTree
          rootNode={viewTree}
          onNodeSelect={handleNodeSelect}
          initialSelectedId={selectedNode.id}
          defaultExpandDepth={1}
        />
      </Panel>

      {/* 分割条 */}
      <Separator
        className="group relative w-4 bg-transparent cursor-col-resize select-none touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gray-200 dark:bg-gray-700 group-data-[separator=hover]:bg-blue-500 group-data-[separator=active]:bg-blue-600 transition-colors" />
      </Separator>

      {/* 右侧：内容面板 */}
      <Panel
        id="content"
        minSize="50%"
      >
        <div className="h-full flex flex-col">
          {/* 头部：面包屑 + 预览切换 + 全屏按钮 */}
          <div className={`flex items-center justify-between border-b border-blue-200/50 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-900/20 ${isFullScreen ? 'px-6 py-4' : 'px-4 py-2'}`}>
            <div className="flex-1 overflow-hidden">
              <PathBreadcrumb path={selectedNode.path} />
            </div>
            <div className="flex items-center gap-2">
              {/* 预览切换按钮 - 仅对 MARKDOWN 和 STRING_LONG 类型显示 */}
              {[NodeType.MARKDOWN, NodeType.STRING_LONG].includes(selectedNode.type) && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMarkdownPreview(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      !isMarkdownPreview
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    纯文本
                  </button>
                  <button
                    onClick={() => setIsMarkdownPreview(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      isMarkdownPreview
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    预览
                  </button>
                </div>
              )}
              {/* 复制按钮 */}
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-1.5"
                title={copied ? '已复制' : '复制'}
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    <span className="text-xs">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span className="text-xs">复制</span>
                  </>
                )}
              </button>
              <button
                onClick={handleToggleFullScreen}
                className="flex-shrink-0 p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
                title={isFullScreen ? '退出全屏 (ESC)' : '全屏'}
              >
                {isFullScreen ? (
                  <>
                    <Minimize2 size={16} />
                    <span className="text-sm">退出全屏</span>
                  </>
                ) : (
                  <Maximize2 size={16} />
                )}
              </button>
            </div>
          </div>
          {/* 内容面板 */}
          <div className="flex-1 overflow-hidden">
            <FileContentPanel
              selectedNode={selectedNode}
              isFullScreen={isFullScreen}
              isMarkdownPreview={isMarkdownPreview}
            />
          </div>
        </div>
      </Panel>
    </Group>
  );

  return isFullScreen ? (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-800">
      {content}
    </div>
  ) : (
    <div className="h-full min-h-0 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10">
      {content}
    </div>
  );
});

FileBrowserView.displayName = 'FileBrowserView';

export default FileBrowserView;
