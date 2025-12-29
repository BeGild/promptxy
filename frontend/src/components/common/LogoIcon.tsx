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
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* 径向渐变：从品牌色到深色背景 */}
        <radialGradient id="logoRadialGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: 'var(--color-brand-primary)', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-bg-elevated)', stopOpacity: 1 }} />
        </radialGradient>
      </defs>

      {/* 上方曲线 */}
      <path
        d="M40 60 C 70 60, 90 90, 100 100"
        stroke="currentColor"
        strokeWidth="12"
        fill="none"
      />

      {/* 下方曲线（带透明度） */}
      <path
        d="M40 140 C 70 140, 90 110, 100 100"
        stroke="currentColor"
        strokeWidth="12"
        fill="none"
        opacity="0.6"
      />

      {/* 三条放射线 */}
      <path
        d="M100 100 L150 50 M100 100 L160 100 M100 100 L150 150"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
      />

      {/* 中心圆点 */}
      <circle
        cx="100"
        cy="100"
        r="14"
        fill="currentColor"
      />
    </svg>
  );
};
