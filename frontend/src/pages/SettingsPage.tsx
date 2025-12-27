/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="text-gray-500"
 * - className="from-gray-600 to-gray-800 dark:from-gray-400"
 *
 * ✅ REQUIRED:
 * - className="text-secondary"
 * - className="from-primary to-secondary dark:from-primary"
 */

import React from 'react';
import { SettingsPanel } from '@/components/settings';

export const SettingsPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            系统设置
          </h1>
          <p className="text-sm text-secondary mt-1">管理配置、统计数据和系统信息</p>
        </div>
      </div>

      {/* 设置面板 */}
      <SettingsPanel />
    </div>
  );
};
