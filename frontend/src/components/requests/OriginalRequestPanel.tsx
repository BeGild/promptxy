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

import React from 'react';
import { RequestRecord } from '@/types';
import { RequestDetailPanel } from '@/components/request-viewer';
import { EmptyState } from '@/components/common';

interface OriginalRequestPanelProps {
  request: RequestRecord;
}

/**
 * 原始请求面板组件
 * - 显示原始请求的树状结构和内容详情
 * - 不支持差异对比功能（通过不传 originalRequest 实现）
 */
export const OriginalRequestPanel: React.FC<OriginalRequestPanelProps> = ({ request }) => {
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
  const originalRequest = typeof request.originalBody === 'string'
    ? JSON.parse(request.originalBody)
    : request.originalBody;

  return (
    <div
      className="border border-subtle rounded-lg overflow-hidden"
      style={{ height: 'calc(100vh - 260px)' }}
    >
      <RequestDetailPanel
        request={originalRequest}
        responseStatus={request.responseStatus}
        responseDuration={request.durationMs}
      />
    </div>
  );
};
