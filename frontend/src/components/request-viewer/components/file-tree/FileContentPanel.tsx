import React from 'react';
import type { ViewNode } from '../../types';
import InlineNodeRenderer from './InlineNodeRenderer';

interface FileContentPanelProps {
  /** 选中的节点 */
  selectedNode: ViewNode;
  /** 是否全屏 */
  isFullScreen?: boolean;
  /** 是否显示 Markdown 预览（默认 false 显示纯文本） */
  isMarkdownPreview?: boolean;
}

/**
 * 文件内容面板组件
 * 仅渲染节点内容
 * 面包屑、预览切换和全屏按钮由父组件 FileBrowserView 控制
 */
const FileContentPanel: React.FC<FileContentPanelProps> = React.memo(({
  selectedNode,
  isFullScreen = false,
  isMarkdownPreview = false,
}) => {
  return (
    <div className="h-full flex flex-col">
      {/* 内容区域 */}
      <div className="flex-1 min-h-0 overflow-auto overscroll-contain bg-white dark:bg-gray-900">
        {isFullScreen ? (
          <div className="p-6 h-full">
            <div className="h-full max-w-5xl mx-auto">
              <InlineNodeRenderer node={selectedNode} title={selectedNode.label} isMarkdownPreview={isMarkdownPreview} />
            </div>
          </div>
        ) : (
          <div className="h-full">
            <InlineNodeRenderer node={selectedNode} isMarkdownPreview={isMarkdownPreview} />
          </div>
        )}
      </div>
    </div>
  );
});

FileContentPanel.displayName = 'FileContentPanel';

export default FileContentPanel;
