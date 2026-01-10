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

import React, { useState } from 'react';
import { Card, CardBody } from '@heroui/react';
import { RequestRecord } from '@/types';
import { RequestDetailPanel } from '@/components/request-viewer';
import { EmptyState } from '@/components/common';
import { formatHeadersAsJSON } from '@/utils';
import { Copy, ChevronDown } from 'lucide-react';

interface OriginalRequestPanelProps {
  request: RequestRecord;
}

/**
 * 请求头折叠面板组件
 */
const RequestHeadersAccordion: React.FC<{
  headers: Record<string, string> | undefined;
}> = ({ headers }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  if (!headers || Object.keys(headers).length === 0) {
    return null;
  }

  const headerCount = Object.keys(headers).length;
  const formattedJSON = formatHeadersAsJSON(headers);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedJSON);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  return (
    <Card className="rounded-lg overflow-hidden border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10">
      <CardBody className="px-3 py-2">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2 text-xs">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-brand-primary"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="font-medium text-primary">请求头</span>
            <span className="text-secondary bg-primary/50 px-2 py-0.5 rounded-full border border-subtle">
              {headerCount} 项
            </span>
          </div>
          <ChevronDown
            size={14}
            className={`text-secondary transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>

        {isExpanded && (
          <div className="relative mt-2">
            <button
              onClick={handleCopy}
              className={`absolute top-1 right-1 w-6 h-6 rounded border border-default bg-primary text-secondary hover:bg-secondary hover:text-primary transition-all flex items-center justify-center ${
                isCopied
                  ? 'bg-status-warning-bg text-status-warning border-status-warning'
                  : ''
              }`}
              title="复制 JSON"
            >
              <Copy size={12} />
            </button>
            <pre className="font-mono text-xs bg-secondary p-2 overflow-x-auto text-primary whitespace-pre">
              {formattedJSON}
            </pre>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

/**
 * 原始请求面板组件
 * - 显示请求头（折叠面板 + JSON 展示）
 * - 显示原始请求的树状结构和内容详情
 * - 不支持差异对比功能（通过不传 originalRequest 实现）
 */
export const OriginalRequestPanel: React.FC<OriginalRequestPanelProps> = ({
  request,
}) => {
  // 如果没有原始数据，显示空状态
  if (!request.originalBody) {
    return (
      <EmptyState
        icon="📭"
        title="未捕获到原始请求"
        description="该请求没有原始数据可供展示"
      />
    );
  }

  // 解析原始请求体
  const originalRequest =
    typeof request.originalBody === 'string'
      ? JSON.parse(request.originalBody)
      : request.originalBody;

  return (
    <div
      className="border border-subtle rounded-lg overflow-hidden"
      style={{ height: 'calc(100vh - 260px)' }}
    >
      {/* 请求头折叠面板 */}
      <div className="p-3 border-b border-subtle">
        <RequestHeadersAccordion headers={request.requestHeaders} />
      </div>

      {/* 请求体详情 */}
      <RequestDetailPanel
        request={originalRequest}
        responseStatus={request.responseStatus}
        responseDuration={request.durationMs}
      />
    </div>
  );
};
