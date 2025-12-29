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
          <stop offset="100%" style={{ stopColor: 'var(--color-accent)', stopOpacity: 1 }} />
        </linearGradient>
      </defs>

      {/* 背景圆角矩形 */}
      <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#logoGradient)" opacity="0.15" />

      {/* 方案B: 扭曲动态 - 流线型小写 p + XY */}
      {/* 扭曲的小写 p - 使用贝塞尔曲线 */}
      <path
        d="M9 7.5 Q11 7 12 8 L13 9 Q14 10 13.5 12 L12.5 15 Q12 17 12.5 19 L13 21 Q13.5 23 12.5 24 L11.5 24.5 Q10.5 24 10.5 22.5 L10.5 7.5 Z"
        fill="url(#logoGradient)"
      />
      {/* p 的圆形部分 - 负空间 */}
      <circle
        cx="12.5"
        cy="14.5"
        r="3"
        fill="url(#logoGradient)"
      />

      {/* XY 文字 - 斜向排列 */}
      <text
        x="17"
        y="20"
        fontSize="9"
        fontWeight="bold"
        fill="url(#logoGradient)"
        transform="rotate(-10, 20, 16)"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        XY
      </text>
    </svg>
  );
};
