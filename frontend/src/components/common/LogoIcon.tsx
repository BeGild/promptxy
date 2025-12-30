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

/**
 * LogoIcon - XY 抽象设计
 *
 * 设计理念：
 * - 左侧两条曲线汇聚 → X 的拦截（拦截并处理请求）
 * - 右侧三条路径发散 → Y 的重写（重写并输出响应）
 * - 中心光晕圆点 → 核心处理节点
 */
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
      {/* 左侧：X 的拦截（柔和的聚拢感） */}
      {/* 上侧曲线 */}
      <path
        d="M35 55 C 55 55, 75 75, 90 92.5"
        stroke="currentColor"
        strokeWidth="27"
        strokeLinecap="round"
      />
      {/* 下侧曲线（略带透明度，增加层次感） */}
      <path
        d="M35 145 C 55 145, 75 125, 90 107.5"
        stroke="currentColor"
        strokeWidth="27"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />

      {/* 右侧：Y 的重写（盛开的花瓣/舒展的羽翼） */}
      {/* Y 的上部分叉：平滑的 S 曲线 */}
      <path
        d="M110 95 C 125 80, 140 50, 170 50"
        stroke="currentColor"
        strokeWidth="27"
        strokeLinecap="round"
      />
      {/* Y 的下部分叉 */}
      <path
        d="M110 105 C 125 120, 140 150, 170 150"
        stroke="currentColor"
        strokeWidth="27"
        strokeLinecap="round"
      />
      {/* Y 的中心推进：液滴穿梭而出 */}
      <path d="M110 100 H 160" stroke="currentColor" strokeWidth="27" strokeLinecap="round" />

      {/* 核心奇点：向心力的视觉锚点 */}
      {/* 外部晕染效果（深色） */}
      <circle cx="100" cy="100" r="22.5" fill="var(--color-bg-elevated)" fillOpacity="0.3" />
      {/* 核心纯白圆球 */}
      <circle cx="100" cy="100" r="14" fill="currentColor" />
    </svg>
  );
};
