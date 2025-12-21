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
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '14px' }}>{status.dot}</span>
      {showText && (
        <Chip color={status.color} size="sm" variant="flat">
          {status.label}
        </Chip>
      )}
      {error && showText && (
        <span style={{ fontSize: '12px', color: 'var(--heroui-colors-danger)' }}>{error}</span>
      )}
    </div>
  );
};
