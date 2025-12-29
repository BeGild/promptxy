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
 * - className="from-green-600 to-blue-600"
 *
 * ✅ REQUIRED:
 * - className="text-secondary"
 * - className="from-status-success to-brand-primary"
 */

import React from 'react';
import { PreviewPanel } from '@/components/preview';

const PreviewPageComponent: React.FC = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-primary to-accent bg-clip-text text-transparent">
            实时预览
          </h1>
          <p className="text-sm text-secondary mt-1">测试规则效果，实时查看请求修改结果</p>
        </div>
      </div>

      {/* 预览面板 */}
      <PreviewPanel />
    </div>
  );
};

/**
 * 使用 React.memo 包裹 PreviewPage 组件
 * 避免父组件状态变化时不必要的重渲染
 */
export const PreviewPage = React.memo(PreviewPageComponent);
