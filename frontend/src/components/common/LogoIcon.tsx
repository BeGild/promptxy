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
 * - style={{ stopColor: '#007AFF' }}
 *
 * ✅ REQUIRED:
 * - className="text-brand"
 * - style={{ stopColor: 'var(--color-brand-primary)' }}
 */

import React from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
}

export const LogoIcon: React.FC<LogoIconProps> = ({ size = 32, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 定义渐变 */}
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--color-brand-primary)', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-brand-primary-hover)', stopOpacity: 1 }} />
        </linearGradient>
      </defs>

      {/* 背景圆角矩形 */}
      <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#logoGradient)" opacity="0.15" />

      {/* P 字母主体 */}
      <path
        d="M10 8 L10 24 L14 24 L14 18 L18 18 C21.3137 18 24 15.3137 24 12 C24 8.68629 21.3137 6 18 6 L10 6 L10 8 Z M14 10 L17 10 C18.6569 10 20 11.3431 20 13 C20 14.6569 18.6569 16 17 16 L14 16 L14 10 Z"
        fill="url(#logoGradient)"
        stroke="url(#logoGradient)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* 向上箭头 (代表变换/提升) */}
      <path
        d="M22 14 L26 10 L30 14"
        fill="none"
        stroke="url(#logoGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 10 L26 18"
        fill="none"
        stroke="url(#logoGradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* XY 坐标轴装饰 */}
      <path
        d="M4 28 L4 24 M4 28 L8 28"
        stroke="url(#logoGradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.6}
      />
    </svg>
  );
};
