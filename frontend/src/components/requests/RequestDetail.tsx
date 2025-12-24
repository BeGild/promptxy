import React, { useCallback } from 'react';
import { Card, CardBody, CardHeader, Chip, Button, Badge, Spinner, Divider } from '@heroui/react';
import { Copy } from 'lucide-react';
import { RequestRecord } from '@/types';
import { formatTime, formatDuration, getStatusColor, formatClient } from '@/utils';
import { DiffViewer } from './DiffViewer';

interface RequestDetailProps {
  request: RequestRecord | null;
  isLoading: boolean;
  onClose: () => void;
  onReplay?: () => void;
}

export const RequestDetail: React.FC<RequestDetailProps> = ({
  request,
  isLoading,
  onClose,
  onReplay,
}) => {
  // 复制到剪贴板
  const copyToClipboard = useCallback(async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      console.log(`${label} 已复制到剪贴板`);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner color="primary">加载详情中...</Spinner>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-lg font-medium text-gray-600">未找到请求详情</div>
        <Button onPress={onClose} radius="lg">
          关闭
        </Button>
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto space-y-4 p-2">
      {/* 基本信息 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody className="space-y-3">
          <h4 className="text-lg font-bold">基本信息</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 min-w-[60px]">ID:</span>
              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {request.id}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 min-w-[60px]">时间:</span>
              <span>{formatTime(request.timestamp)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 min-w-[60px]">客户端:</span>
              <Badge color="primary" variant="flat" size="sm" className="font-medium">
                {formatClient(request.client)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 min-w-[60px]">方法:</span>
              <Chip size="sm" variant="flat" className="uppercase text-xs">
                {request.method}
              </Chip>
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <span className="text-gray-500 min-w-[60px]">路径:</span>
              <span className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">
                {request.path}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 min-w-[60px]">状态:</span>
              <Chip
                size="sm"
                color={getStatusColor(request.responseStatus)}
                variant="flat"
                className="font-medium"
              >
                {request.responseStatus || 'N/A'}
              </Chip>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 min-w-[60px]">耗时:</span>
              <span className="font-medium">
                {request.durationMs ? formatDuration(request.durationMs) : '-'}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 匹配规则 */}
      {request.matchedRules && request.matchedRules.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardBody className="space-y-3">
            <h4 className="text-lg font-bold">匹配规则</h4>
            <div className="flex flex-wrap gap-2">
              {request.matchedRules.map((match, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900/30 px-2 py-1 rounded-lg"
                >
                  <Badge color="secondary" variant="flat" size="sm" className="text-xs">
                    {match.ruleId}
                  </Badge>
                  <Chip color="warning" variant="flat" size="sm" className="text-xs uppercase">
                    {match.opType}
                  </Chip>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Divider />

      {/* 差异对比 */}
      <div className="space-y-2">
        <h4 className="text-lg font-bold">请求差异</h4>
        <DiffViewer original={request.originalBody} modified={request.modifiedBody} />
      </div>

      {/* 错误信息 */}
      {request.error && (
        <Card className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <CardBody className="space-y-2">
            <div className="font-bold text-red-700 dark:text-red-400">错误信息</div>
            <div className="font-mono text-xs text-red-600 dark:text-red-300 bg-white/50 dark:bg-black/20 p-2 rounded">
              {request.error}
            </div>
          </CardBody>
        </Card>
      )}

      {/* 响应头 */}
      {request.responseHeaders && (
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2">
            <div className="flex items-center justify-between w-full">
              <h5 className="text-md font-bold">响应头</h5>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => copyToClipboard(JSON.stringify(request.responseHeaders, null, 2), '响应头')}
                className="min-w-6 h-6"
              >
                <Copy size={14} />
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            <pre className="font-mono text-xs bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg overflow-x-auto">
              {JSON.stringify(request.responseHeaders, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}

      {/* 响应体 */}
      {request.responseBody && (
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2">
            <div className="flex items-center justify-between w-full">
              <h5 className="text-md font-bold">响应体</h5>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => copyToClipboard(
                  typeof request.responseBody === 'string'
                    ? request.responseBody
                    : JSON.stringify(request.responseBody, null, 2),
                  '响应体'
                )}
                className="min-w-6 h-6"
              >
                <Copy size={14} />
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            <pre className="font-mono text-xs bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg overflow-x-auto max-h-[300px] overflow-y-auto">
              {typeof request.responseBody === 'string'
                ? request.responseBody
                : JSON.stringify(request.responseBody, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
        {onReplay && (
          <Button color="warning" variant="flat" onPress={onReplay} radius="lg">
            重放请求
          </Button>
        )}
        <Button onPress={onClose} radius="lg" className="shadow-md">
          关闭
        </Button>
      </div>
    </div>
  );
};
