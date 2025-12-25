import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Panel,
  Group,
  Separator,
} from 'react-resizable-panels';
import type { ViewNode } from '../../types';
import FileTree from '../file-tree/FileTree';
import FileContentPanel from '../file-tree/FileContentPanel';

interface FileBrowserViewProps {
  /** 视图树根节点 */
  viewTree: ViewNode;
}

const STORAGE_KEY_PANEL_SIZES = 'request-viewer:panel-sizes';
const DEFAULT_LAYOUT = { 'tree-panel': 30, 'content-panel': 70 };

/**
 * 文件浏览器风格的视图组件
 * 左侧：文件树，右侧：内容面板
 * 支持拖拽调整面板宽度
 */
const FileBrowserView: React.FC<FileBrowserViewProps> = React.memo(({ viewTree }) => {
  const [selectedNode, setSelectedNode] = useState<ViewNode>(viewTree);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // 从 localStorage 恢复面板宽度
  const [defaultLayout, setDefaultLayout] = useState<typeof DEFAULT_LAYOUT>(DEFAULT_LAYOUT);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PANEL_SIZES);
    if (stored) {
      try {
        const layout = JSON.parse(stored);
        if (typeof layout === 'object' && layout !== null) {
          setDefaultLayout(layout);
        }
      } catch (e) {
        // 忽略解析错误，使用默认值
      }
    }
  }, []);

  /**
   * 处理节点选中
   */
  const handleNodeSelect = useCallback((node: ViewNode) => {
    setSelectedNode(node);
  }, []);

  /**
   * 处理面板宽度变化
   */
  const handleLayoutChange = useCallback((layout: Record<string, number>) => {
    localStorage.setItem(STORAGE_KEY_PANEL_SIZES, JSON.stringify(layout));
  }, []);

  // 缓存面板配置
  const treePanelConfig = useMemo(() => ({
    id: 'tree-panel' as const,
    minSize: 15,
    maxSize: 50,
    defaultSize: defaultLayout['tree-panel'] ?? 30,
  }), [defaultLayout]);

  const contentPanelConfig = useMemo(() => ({
    id: 'content-panel' as const,
    minSize: 50,
    defaultSize: defaultLayout['content-panel'] ?? 70,
  }), [defaultLayout]);

  return (
    <div className="h-full bg-white dark:bg-gray-900">
      {!isFullScreen ? (
        /* 正常模式：使用 Group 实现可拖拽调整宽度的分割布局 */
        <Group
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChange={handleLayoutChange}
        >
          {/* 左侧：文件树 */}
          <Panel
            {...treePanelConfig}
            className="border-r border-gray-200 dark:border-gray-700"
          >
            <FileTree
              rootNode={viewTree}
              onNodeSelect={handleNodeSelect}
              initialSelectedId={viewTree.id}
              defaultExpandDepth={1}
            />
          </Panel>

          {/* 分割条 */}
          <Separator
            className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors cursor-col-resize"
          />

          {/* 右侧：内容面板 */}
          <Panel {...contentPanelConfig}>
            <FileContentPanel
              selectedNode={selectedNode}
              onFullScreenChange={setIsFullScreen}
            />
          </Panel>
        </Group>
      ) : (
        /* 全屏模式：左右分栏但占满整个视口 */
        <div className="fixed inset-0 z-50 flex">
          <Group
            orientation="horizontal"
            defaultLayout={defaultLayout}
            onLayoutChange={handleLayoutChange}
          >
            {/* 左侧：文件树 */}
            <Panel
              {...treePanelConfig}
              className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
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
              className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors cursor-col-resize"
            />

            {/* 右侧：内容面板 */}
            <Panel {...contentPanelConfig}>
              <FileContentPanel
                selectedNode={selectedNode}
                isFullScreen={true}
                onFullScreenChange={setIsFullScreen}
              />
            </Panel>
          </Group>
        </div>
      )}
    </div>
  );
});

FileBrowserView.displayName = 'FileBrowserView';

export default FileBrowserView;
