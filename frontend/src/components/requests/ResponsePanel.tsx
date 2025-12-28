/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
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

import React, { useCallback } from 'react';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import { Copy } from 'lucide-react';
import { RequestRecord } from '@/types';

interface ResponsePanelProps {
  request: RequestRecord;
}

export const ResponsePanel: React.FC<ResponsePanelProps> = ({ request }) => {
  const copyToClipboard = useCallback(async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      console.log(`${label} 已复制到剪贴板`);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, []);

  const hasResponseContent = request.responseHeaders || request.responseBody;

  if (!hasResponseContent) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-sm font-medium text-secondary">暂无响应数据</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 响应状态 */}
      <Card className="rounded-lg overflow-hidden border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10">
        <CardBody className="space-y-sm">
          <h4 className="text-base font-bold">响应状态</h4>
          <div className="flex items-center gap-3">
            <Chip
              color={request.responseStatus && request.responseStatus >= 200 && request.responseStatus < 300 ? 'success' : 'warning'}
              variant="flat"
              size="lg"
            >
              {request.responseStatus || 'N/A'}
            </Chip>
            {request.durationMs && (
              <div className="text-sm text-secondary">
                耗时: {request.durationMs}ms
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 响应头 */}
      {request.responseHeaders && (
        <Card className="rounded-lg overflow-hidden border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10">
          <CardBody className="space-y-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">响应头</h4>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() =>
                  copyToClipboard(JSON.stringify(request.responseHeaders, null, 2), '响应头')
                }
                className="min-w-6 h-6"
              >
                <Copy size={14} />
              </Button>
            </div>
            <pre className="font-mono text-xs bg-secondary dark:bg-secondary p-3 rounded-lg overflow-x-auto">
              {JSON.stringify(request.responseHeaders, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}

      {/* 响应体 */}
      {request.responseBody && (
        <Card className="rounded-lg overflow-hidden border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10">
          <CardBody className="space-y-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">响应体</h4>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() =>
                  copyToClipboard(
                    typeof request.responseBody === 'string'
                      ? request.responseBody
                      : JSON.stringify(request.responseBody, null, 2),
                    '响应体',
                  )
                }
                className="min-w-6 h-6"
              >
                <Copy size={14} />
              </Button>
            </div>
            <pre className="font-mono text-xs bg-secondary dark:bg-secondary p-3 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
              {typeof request.responseBody === 'string'
                ? request.responseBody
                : JSON.stringify(request.responseBody, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}

      {/* 错误信息 */}
      {request.error && (
        <Card className="rounded-lg overflow-hidden border border-status-error/30 dark:border-status-error/20 bg-gradient-to-br from-elevated to-status-error/5 dark:from-elevated dark:to-status-error/10">
          <CardBody className="space-y-sm">
            <div className="font-bold text-status-error dark:text-status-error text-sm">错误信息</div>
            <div className="font-mono text-xs text-status-error dark:text-status-error bg-canvas/50 dark:bg-canvas/20 p-3 rounded">
              {request.error}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
