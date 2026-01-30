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
import { AnthropicIcon, CodexIcon, GeminiIcon } from '@/components/icons/SupplierIcons';
import type { LocalService } from '@/types/api';

interface LocalServiceConfig {
  key: LocalService;
  label: string;
  prefix: string;
  protocol: string;
  color: string;
  bgColorClass: string;
  textColorClass: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const LOCAL_SERVICES: LocalServiceConfig[] = [
  {
    key: 'claude',
    label: 'Claude',
    prefix: '/claude',
    protocol: 'anthropic',
    color: '#D4935D',
    bgColorClass: 'bg-[#D4935D]/20',
    textColorClass: 'text-[#D4935D]',
    icon: AnthropicIcon,
  },
  {
    key: 'codex',
    label: 'Codex',
    prefix: '/codex',
    protocol: 'openai-codex',
    color: '#2D3748',
    bgColorClass: 'bg-[#2D3748]/20',
    textColorClass: 'text-[#2D3748]',
    icon: CodexIcon,
  },
  {
    key: 'gemini',
    label: 'Gemini',
    prefix: '/gemini',
    protocol: 'gemini',
    color: '#4285F4',
    bgColorClass: 'bg-[#4285F4]/20',
    textColorClass: 'text-[#4285F4]',
    icon: GeminiIcon,
  },
];

interface InboundEndpointProps {
  localService: LocalService;
}

/**
 * 入站端点组件
 * 显示本地服务端点的图标、名称、路径和协议信息
 */
export const InboundEndpoint: React.FC<InboundEndpointProps> = ({ localService }) => {
  const config = LOCAL_SERVICES.find(s => s.key === localService);
  if (!config) return null;

  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.bgColorClass}`}
      >
        <IconComponent size={24} className={config.textColorClass} />
      </div>
      <div>
        <div className="font-semibold text-primary">{config.label}</div>
        <div className="text-xs text-tertiary font-mono">{config.prefix}</div>
        <div className="text-xs text-tertiary opacity-70">{config.protocol}</div>
      </div>
    </div>
  );
};
