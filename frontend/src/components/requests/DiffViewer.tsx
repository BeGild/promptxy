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

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardBody, CardHeader, Button } from '@heroui/react';
import { Copy } from 'lucide-react';
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

  // 使用 useMemo 优化原始请求逐行显示（用于无改写情况）
  const originalLines = useMemo(() => {
    return originalStr.split('\n');
  }, [originalStr]);

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

  // 复制到剪贴板
  const copyToClipboard = useCallback(async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // 可选：添加复制成功提示
      console.log(`${label} 已复制到剪贴板`);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, []);

  // 无改写状态标识
  const isNoChanges = !hasChanges;

  return (
    <div className="space-y-xmd">
      <div className="flex items-center justify-between">
        <span className="text-sm text-tertiary">
          {isNoChanges
            ? viewMode === 'side-by-side'
              ? '原始请求（无改写）'
              : 'JSON 格式化视图'
            : viewMode === 'side-by-side'
              ? '左右对比视图'
              : 'JSON 格式化视图'}
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
          <Card className="border border-subtle">
            <CardHeader className="bg-secondary border-b border-subtle py-2">
              <div className="flex items-center justify-between w-full">
                <b className="text-sm">原始请求</b>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => copyToClipboard(originalStr, '原始请求')}
                  className="min-w-6 h-6"
                >
                  <Copy size={14} />
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-p0">
              <div className="font-mono text-xs leading-5 h-[400px] overflow-auto p-3 bg-canvas dark:bg-canvas">
                {(isNoChanges ? originalLines : left).map((line, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap ${
                      isNoChanges
                        ? 'text-primary dark:text-primary'
                        : line.startsWith('-')
                          ? 'text-status-error dark:text-status-error bg-status-error/10 dark:bg-status-error/10'
                          : line.startsWith('~')
                            ? 'text-status-warning dark:text-status-warning bg-status-warning/10 dark:bg-status-warning/10'
                            : 'text-primary dark:text-primary'
                    }`}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
          <Card className="border border-subtle">
            <CardHeader className="bg-secondary border-b border-subtle py-2">
              <div className="flex items-center justify-between w-full">
                <b className="text-sm">修改后请求</b>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => copyToClipboard(isNoChanges ? originalStr : modifiedStr, '修改后请求')}
                  className="min-w-6 h-6"
                >
                  <Copy size={14} />
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-p0">
              <div className="font-mono text-xs leading-5 h-[400px] overflow-auto p-3 bg-canvas dark:bg-canvas">
                {(isNoChanges ? originalLines : right).map((line, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap ${
                      isNoChanges
                        ? 'text-primary dark:text-primary'
                        : line.startsWith('+')
                          ? 'text-status-success dark:text-status-success bg-status-success/10 dark:bg-status-success/10'
                          : line.startsWith('~')
                            ? 'text-status-warning dark:text-status-warning bg-status-warning/10 dark:bg-status-warning/10'
                            : 'text-primary dark:text-primary'
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
          <Card className="border border-subtle">
            <CardHeader className="bg-secondary border-b border-subtle py-2">
              <div className="flex items-center justify-between w-full">
                <b className="text-sm">原始</b>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => copyToClipboard(originalStr, '原始请求')}
                  className="min-w-6 h-6"
                >
                  <Copy size={14} />
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-p0">
              <pre className="font-mono text-xs h-[400px] overflow-auto p-3 bg-canvas dark:bg-canvas text-primary dark:text-primary">
                {originalStr}
              </pre>
            </CardBody>
          </Card>
          <Card className="border border-subtle">
            <CardHeader className="bg-secondary border-b border-subtle py-2">
              <div className="flex items-center justify-between w-full">
                <b className="text-sm">{isNoChanges ? '原始请求' : '修改后'}</b>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => copyToClipboard(isNoChanges ? originalStr : modifiedStr, isNoChanges ? '原始请求' : '修改后请求')}
                  className="min-w-6 h-6"
                >
                  <Copy size={14} />
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-p0">
              <pre className="font-mono text-xs h-[400px] overflow-auto p-3 bg-canvas dark:bg-canvas text-primary dark:text-primary">
                {isNoChanges ? originalStr : modifiedStr}
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
