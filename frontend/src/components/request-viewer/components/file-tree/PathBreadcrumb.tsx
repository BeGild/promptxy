import React, { useMemo, useCallback } from 'react';

interface PathBreadcrumbProps {
  /** 节点路径（如 "messages.0.content.0.text"） */
  path: string;
  /** 路径片段点击回调 */
  onSegmentClick?: (segment: string, index: number) => void;
}

/**
 * 路径面包屑组件
 * 显示节点路径，支持点击跳转
 */
const PathBreadcrumb: React.FC<PathBreadcrumbProps> = React.memo(({ path, onSegmentClick }) => {
  // 解析路径为片段
  const segments = useMemo(() => path.split('.'), [path]);

  // 处理点击事件
  const handleClick = useCallback((segment: string, index: number) => {
    if (onSegmentClick) {
      onSegmentClick(segment, index);
    }
  }, [onSegmentClick]);

  return (
    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 overflow-x-auto">
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="flex-shrink-0 text-gray-400 dark:text-gray-600">/</span>
          )}
          <button
            onClick={() => handleClick(segment, index)}
            className="flex-shrink-0 hover:text-gray-900 dark:hover:text-gray-200 hover:underline transition-colors truncate max-w-[150px]"
            title={segment}
          >
            {segment}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
});

PathBreadcrumb.displayName = 'PathBreadcrumb';

export default PathBreadcrumb;
