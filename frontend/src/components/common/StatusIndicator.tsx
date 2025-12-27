/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - style={{ color: '#007acc' }}
 * - style={{ gap: '8px' }}
 *
 * ✅ REQUIRED:
 * - className="flex-center gap-sm"
 * - style={{ gap: 'var(--spacing-sm)' }}
 */

import React from 'react';
import { Chip } from '@heroui/react';

interface StatusIndicatorProps {
  connected: boolean;
  error?: string | null;
  showText?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  connected,
  error,
  showText = true,
}) => {
  const getStatus = () => {
    if (error) {
      return { color: 'danger' as const, label: '错误', dot: '🔴' };
    }
    if (connected) {
      return { color: 'success' as const, label: '已连接', dot: '🟢' };
    }
    return { color: 'warning' as const, label: '未连接', dot: '🟡' };
  };

  const status = getStatus();

  return (
    <div className="flex items-center gap-sm">
      <span className="text-sm">{status.dot}</span>
      {showText && (
        <Chip color={status.color} size="sm" variant="flat">
          {status.label}
        </Chip>
      )}
      {error && showText && (
        <span className="text-xs text-error">{error}</span>
      )}
    </div>
  );
};
