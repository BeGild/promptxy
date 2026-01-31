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
import { ArrowRight } from 'lucide-react';
import type { LocalService, Supplier } from '@/types/api';

const DEFAULT_COLOR = '#888';

interface LocalServiceConfig {
  key: LocalService;
  color: string;
}

const LOCAL_SERVICE_COLORS: LocalServiceConfig[] = [
  { key: 'claude', color: '#D4935D' },
  { key: 'codex', color: '#2D3748' },
  { key: 'gemini', color: '#4285F4' },
];

const SUPPLIER_COLORS: Record<string, string> = {
  'anthropic': '#D4935D',
  'openai-codex': '#2D3748',
  'openai-chat': '#10A37F',
  'gemini': '#4285F4',
};

interface FlowArrowProps {
  localService: LocalService;
  targetSupplier?: Supplier;
}

/**
 * 流向箭头组件
 * 展示从本地服务到目标供应商的请求流向
 * 支持显示协议转换指示
 */
export const FlowArrow: React.FC<FlowArrowProps> = ({
  localService,
  targetSupplier,
}) => {
  const localConfig = LOCAL_SERVICE_COLORS.find(s => s.key === localService);
  const inboundColor = localConfig?.color || DEFAULT_COLOR;
  const outboundColor = targetSupplier
    ? SUPPLIER_COLORS[targetSupplier.protocol] || DEFAULT_COLOR
    : DEFAULT_COLOR;

  return (
    <div className="flex flex-col items-center justify-center px-3" style={{ height: 'var(--route-row-height)' }}>
      <div
        className="flex items-center justify-center w-10 h-10 rounded-full border-2 bg-default-100 border-default-200"
        style={{
          background: `linear-gradient(135deg, ${inboundColor}25, ${outboundColor}25)`,
          borderColor: `${outboundColor}40`,
        }}
      >
        <ArrowRight
          size={20}
          style={{ color: outboundColor }}
        />
      </div>
    </div>
  );
};
