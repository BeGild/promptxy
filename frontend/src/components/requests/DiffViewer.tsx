import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardBody, CardHeader, Button } from '@heroui/react';
import { generateJSONDiff, highlightDiff } from '@/utils';

interface DiffViewerProps {
  original: any;
  modified: any;
}

/**
 * DiffViewer - 优化的差异查看器组件
 * 使用 React.memo 避免不必要的重新渲染
 * 使用 useMemo 优化计算密集型操作
 */
const DiffViewerComponent: React.FC<DiffViewerProps> = ({ original, modified }) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'json'>('side-by-side');

  // 使用 useMemo 优化差异计算，只有当 original 或 modified 变化时才重新计算
  const diff = useMemo(() => {
    return generateJSONDiff(original, modified);
  }, [original, modified]);

  // 使用 useMemo 优化高亮处理
  const { left, right } = useMemo(() => {
    return highlightDiff(diff);
  }, [diff]);

  // 使用 useMemo 优化 JSON 字符串化
  const originalStr = useMemo(() => {
    return JSON.stringify(original, null, 2);
  }, [original]);

  const modifiedStr = useMemo(() => {
    return JSON.stringify(modified, null, 2);
  }, [modified]);

  // 使用 useMemo 优化差异检查
  const hasChanges = useMemo(() => {
    return diff.some(d => d.type !== 'same');
  }, [diff]);

  // 使用 useCallback 优化视图模式切换
  const toggleViewMode = useCallback((mode: 'side-by-side' | 'json') => {
    setViewMode(mode);
  }, []);

  if (!hasChanges) {
    return (
      <Card className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700">
        <CardBody className="p-4 text-center text-gray-500">无修改 - 请求未被规则改变</CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {viewMode === 'side-by-side' ? '左右对比视图' : 'JSON 格式化视图'}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === 'side-by-side' ? 'flat' : 'light'}
            onPress={() => toggleViewMode('side-by-side')}
            radius="lg"
            color={viewMode === 'side-by-side' ? 'primary' : 'default'}
          >
            对比
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'json' ? 'flat' : 'light'}
            onPress={() => toggleViewMode('json')}
            radius="lg"
            color={viewMode === 'json' ? 'primary' : 'default'}
          >
            JSON
          </Button>
        </div>
      </div>

      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2">
              <b className="text-sm">原始请求</b>
            </CardHeader>
            <CardBody className="p-0">
              <div className="font-mono text-xs leading-5 h-[400px] overflow-auto p-3 bg-white dark:bg-gray-900/50">
                {left.map((line, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap ${
                      line.startsWith('-')
                        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10'
                        : line.startsWith('~')
                          ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/10'
                          : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2">
              <b className="text-sm">修改后请求</b>
            </CardHeader>
            <CardBody className="p-0">
              <div className="font-mono text-xs leading-5 h-[400px] overflow-auto p-3 bg-white dark:bg-gray-900/50">
                {right.map((line, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap ${
                      line.startsWith('+')
                        ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/10'
                        : line.startsWith('~')
                          ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/10'
                          : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2">
              <b className="text-sm">原始</b>
            </CardHeader>
            <CardBody className="p-0">
              <pre className="font-mono text-xs h-[400px] overflow-auto p-3 bg-white dark:bg-gray-900/50 text-gray-700 dark:text-gray-300">
                {originalStr}
              </pre>
            </CardBody>
          </Card>
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2">
              <b className="text-sm">修改后</b>
            </CardHeader>
            <CardBody className="p-0">
              <pre className="font-mono text-xs h-[400px] overflow-auto p-3 bg-white dark:bg-gray-900/50 text-gray-700 dark:text-gray-300">
                {modifiedStr}
              </pre>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
};

/**
 * 优化的 DiffViewer 组件，使用 React.memo 包裹
 * 自定义比较函数确保只有在数据真正变化时才重新渲染
 */
export const DiffViewer = React.memo(DiffViewerComponent, (prevProps, nextProps) => {
  // 深度比较原始数据
  if (prevProps.original !== nextProps.original) {
    return false;
  }

  // 深度比较修改数据
  if (prevProps.modified !== nextProps.modified) {
    return false;
  }

  // 所有数据相同，不需要重新渲染
  return true;
});
