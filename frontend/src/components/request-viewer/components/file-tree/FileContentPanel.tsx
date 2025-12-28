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
const FileContentPanel: React.FC<FileContentPanelProps> = React.memo(
  ({ selectedNode, isFullScreen = false, isMarkdownPreview = false }) => {
    return (
      <div className="h-full flex flex-col">
        {/* 内容区域 */}
        <div className="flex-1 min-h-0 overflow-auto overscroll-contain bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
          {isFullScreen ? (
            <div className="h-full">
              <InlineNodeRenderer
                node={selectedNode}
                title={selectedNode.label}
                isMarkdownPreview={isMarkdownPreview}
                isFullScreen={true}
              />
            </div>
          ) : (
            <div className="h-full">
              <InlineNodeRenderer
                node={selectedNode}
                isMarkdownPreview={isMarkdownPreview}
                isFullScreen={false}
              />
            </div>
          )}
        </div>
      </div>
    );
  },
);

FileContentPanel.displayName = 'FileContentPanel';

export default FileContentPanel;
