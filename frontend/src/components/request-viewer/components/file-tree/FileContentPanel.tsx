import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { ViewNode } from '../../types';
import InlineNodeRenderer from './InlineNodeRenderer';
import PathBreadcrumb from './PathBreadcrumb';

interface FileContentPanelProps {
  /** 选中的节点 */
  selectedNode: ViewNode;
  /** 全屏状态变化回调 */
  onFullScreenChange?: (isFullScreen: boolean) => void;
  /** 是否全屏 */
  isFullScreen?: boolean;
}

/**
 * 文件内容面板组件
 * 显示路径面包屑和节点内容，支持全屏模式
 */
const FileContentPanel: React.FC<FileContentPanelProps> = React.memo(({
  selectedNode,
  onFullScreenChange,
  isFullScreen: externalIsFullScreen = false,
}) => {
  const [internalIsFullScreen, setInternalIsFullScreen] = useState(false);
  const isFullScreen = externalIsFullScreen ?? internalIsFullScreen;

  // 处理全屏切换
  const handleToggleFullScreen = useCallback(() => {
    const newState = !isFullScreen;
    if (onFullScreenChange) {
      onFullScreenChange(newState);
    } else {
      setInternalIsFullScreen(newState);
    }

    // ESC 键退出全屏
    if (newState) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleToggleFullScreen();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isFullScreen, onFullScreenChange]);

  // 处理 ESC 键（外部全屏模式）
  useEffect(() => {
    if (isFullScreen && externalIsFullScreen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && onFullScreenChange) {
          onFullScreenChange(false);
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isFullScreen, externalIsFullScreen, onFullScreenChange]);

  // 缓存面包屑路径
  const breadcrumbPath = useMemo(() => selectedNode.path, [selectedNode.path]);

  return (
    <>
      {/* 非全屏模式 */}
      {!isFullScreen && (
        <div className="h-full flex flex-col bg-white dark:bg-gray-900">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex-1 overflow-hidden">
              <PathBreadcrumb path={breadcrumbPath} />
            </div>
            <button
              onClick={handleToggleFullScreen}
              className="flex-shrink-0 ml-2 p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="全屏"
            >
              <Maximize2 size={16} />
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto overflow-x-auto">
            <InlineNodeRenderer node={selectedNode} />
          </div>
        </div>
      )}

      {/* 全屏模式 */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
          {/* 全屏头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex-1 overflow-hidden">
              <PathBreadcrumb path={breadcrumbPath} />
            </div>
            <button
              onClick={handleToggleFullScreen}
              className="flex-shrink-0 ml-4 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
              title="退出全屏 (ESC)"
            >
              <Minimize2 size={16} />
              <span>退出全屏</span>
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto overflow-x-auto p-6">
            <div className="max-w-5xl mx-auto">
              <InlineNodeRenderer node={selectedNode} title={selectedNode.label} />
            </div>
          </div>
        </div>
      )}
    </>
  );
});

FileContentPanel.displayName = 'FileContentPanel';

export default FileContentPanel;
