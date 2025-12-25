import React from 'react';
import type { ViewNode } from '../../types';
import InlineNodeRenderer from './InlineNodeRenderer';

interface FileContentPanelProps {
  /** 选中的节点 */
  selectedNode: ViewNode;
  /** 是否全屏 */
  isFullScreen?: boolean;
}

/**
 * 文件内容面板组件
 * 仅渲染节点内容
 * 面包屑和全屏按钮由父组件 FileBrowserView 控制
 */
const FileContentPanel: React.FC<FileContentPanelProps> = React.memo(({
  selectedNode,
  isFullScreen = false,
}) => {
  return (
    <div className="h-full min-h-0 overflow-auto overscroll-contain bg-white dark:bg-gray-900">
      {isFullScreen ? (
        <div className="p-6">
          <div className="max-w-5xl mx-auto">
            <InlineNodeRenderer node={selectedNode} title={selectedNode.label} />
          </div>
        </div>
      ) : (
        <InlineNodeRenderer node={selectedNode} />
      )}
    </div>
  );
});

FileContentPanel.displayName = 'FileContentPanel';

export default FileContentPanel;
