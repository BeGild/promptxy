/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="bg-gray-50 dark:bg-gray-950"
 *
 * ✅ REQUIRED:
 * - className="bg-canvas dark:bg-secondary"
 */

import React from 'react';
import { Chip } from '@heroui/react';
import { Server } from 'lucide-react';
import { useConfigStatus } from '@/hooks';
import { useUIStore } from '@/store';

export const ConfigStatusIndicator: React.FC = () => {
  const configStatus = useConfigStatus();
  const setActiveTab = useUIStore(state => state.setActiveTab);

  const paths = [
    { key: '/claude', label: '/claude' },
    { key: '/openai', label: '/openai' },
    { key: '/gemini', label: '/gemini' },
  ];

  const handleClick = () => {
    setActiveTab('protocol-config');
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 bg-canvas dark:bg-secondary/50 rounded-full border border-subtle cursor-pointer hover:border-brand-primary/50 transition-colors"
      onClick={handleClick}
      title="点击跳转到协议配置页面"
    >
      <Server size={14} className="text-brand-primary" />
      {paths.map(path => {
        const supplierName = configStatus[path.key as keyof typeof configStatus];
        return (
          <React.Fragment key={path.key}>
            <div className="w-px h-3 bg-border-default" />
            <div className="flex items-center gap-1">
              <span className="text-xs text-secondary font-mono">{path.label}</span>
              {supplierName ? (
                <Chip
                  size="sm"
                  color="success"
                  variant="flat"
                  className="h-5 min-h-5"
                  classNames={{
                    base: 'min-w-0 inline-flex items-center',
                    content: 'px-1.5 py-0.5 min-w-0 inline-flex',
                  }}
                >
                  {supplierName}
                </Chip>
              ) : (
                <Chip
                  size="sm"
                  color="default"
                  variant="flat"
                  className="h-5 min-h-5"
                  classNames={{
                    base: 'min-w-0 inline-flex items-center',
                    content: 'px-1.5 py-0.5 min-w-0 inline-flex',
                  }}
                >
                  未配置
                </Chip>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};