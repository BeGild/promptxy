import React, { useState } from 'react';
import { Card, CardBody, CardHeader, Button } from '@heroui/react';
import { generateJSONDiff, highlightDiff } from '@/utils';

interface DiffViewerProps {
  original: any;
  modified: any;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ original, modified }) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'json'>('side-by-side');

  const diff = generateJSONDiff(original, modified);
  const { left, right } = highlightDiff(diff);

  const originalStr = JSON.stringify(original, null, 2);
  const modifiedStr = JSON.stringify(modified, null, 2);

  // 检查是否有差异
  const hasChanges = diff.some(d => d.type !== 'same');

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
            onPress={() => setViewMode('side-by-side')}
            radius="lg"
            color={viewMode === 'side-by-side' ? 'primary' : 'default'}
          >
            对比
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'json' ? 'flat' : 'light'}
            onPress={() => setViewMode('json')}
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
