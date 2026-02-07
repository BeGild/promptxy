/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn)
 *
 * ❌ FORBIDDEN:
 * - 硬编码颜色值（如 #007aff, #f5f5f7）
 * - 硬编码尺寸值（如 400px, 16px）
 * - 旧 Tailwind 颜色类（如 gray-*, blue-*, slate-*）
 *
 * ✅ REQUIRED:
 * - 使用语义化变量和类名
 * - 参考 styles/tokens/colors.css 中的可用变量
 */

import React from 'react';
import { Tooltip } from '@heroui/react';

interface PathCellProps {
  /** 原始请求路径 */
  originalPath: string;
  /** 转换后的请求路径 */
  transformedPath?: string;
  /** 是否路径发生变化 */
  isTransformed?: boolean;
}

/**
 * PathCell - 双行路径单元格组件
 *
 * 显示原始路径和转换后的路径
 * 格式:
 *   主行: /v1/messages (原始路径，主色)
 *   次行: /v1/chat/completions (转换后路径，次要色，较小字号)
 *
 * 当路径未转换时，只显示一行
 */
export const PathCell: React.FC<PathCellProps> = ({
  originalPath,
  transformedPath,
  isTransformed,
}) => {
  // 判断是否有转换
  const hasTransform = isTransformed || (transformedPath && transformedPath !== originalPath);

  // 主路径显示
  const mainPath = originalPath;
  const secondaryPath = hasTransform ? transformedPath : null;

  return (
    <div className="flex flex-col justify-center py-1 min-w-0">
      {/* 主路径行 */}
      <div className="flex items-center min-w-0">
        <Tooltip
            content={
              <div className="text-xs max-w-sm">
                <div className="font-medium mb-2 text-primary">请求路径</div>
                <pre className="whitespace-pre-wrap break-words font-mono text-tertiary text-[10px] leading-relaxed bg-secondary/30 dark:bg-secondary/30 p-2 rounded">
                  {mainPath}
                </pre>
              </div>
            }
            placement="top"
          >
            <span className="font-mono text-xs text-primary dark:text-primary truncate block hover:text-secondary dark:hover:text-secondary cursor-help transition-colors">
              {mainPath}
            </span>
          </Tooltip>
      </div>

      {/* 次要路径行（转换后路径） */}
      {secondaryPath && (
        <div className="flex items-center gap-1 min-w-0 mt-0.5">
          {/* 转换指示器 */}
          <span className="text-tertiary text-[10px] flex-shrink-0">→</span>

          <Tooltip
            content={
              <div className="text-xs max-w-sm">
                <div className="font-medium mb-2 text-primary">路径转换</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-tertiary font-medium flex-shrink-0">原始:</span>
                    <pre className="whitespace-pre-wrap break-words font-mono text-tertiary text-[10px] leading-relaxed bg-secondary/30 dark:bg-secondary/30 p-2 rounded flex-1">
                      {mainPath}
                    </pre>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-tertiary font-medium flex-shrink-0">转换:</span>
                    <pre className="whitespace-pre-wrap break-words font-mono text-tertiary text-[10px] leading-relaxed bg-secondary/30 dark:bg-secondary/30 p-2 rounded flex-1">
                      {secondaryPath}
                    </pre>
                  </div>
                </div>
              </div>
            }
            placement="right"
          >
            <span className="font-mono text-[10px] text-tertiary dark:text-tertiary truncate block hover:text-secondary dark:hover:text-secondary cursor-help transition-colors">
              {secondaryPath}
            </span>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
