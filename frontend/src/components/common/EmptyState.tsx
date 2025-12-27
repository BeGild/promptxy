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

import React from 'react';
import { Button, Card, CardBody } from '@heroui/react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title,
  description,
  actionText,
  onAction,
}) => {
  return (
    <Card className="border-2 border-dashed border-subtle dark:border-subtle bg-secondary dark:bg-elevated">
      <CardBody className="p-xl text-center space-y-4">
        <div className="text-6xl">{icon}</div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-primary dark:text-primary">{title}</h3>
          <p className="text-sm text-secondary max-w-md mx-auto">{description}</p>
        </div>
        {actionText && onAction && (
          <Button
            color="primary"
            onPress={onAction}
            className="shadow-md hover:shadow-lg transition-shadow"
            radius="lg"
            size="lg"
          >
            {actionText}
          </Button>
        )}
      </CardBody>
    </Card>
  );
};
