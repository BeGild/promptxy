/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - 硬编码颜色值（如 #D97757, #10A37F）
 * - 硬编码尺寸值（如 16px, 20px）
 * - 旧 Tailwind 颜色类（如 gray-*, blue-*, slate-*）
 *
 * ✅ REQUIRED:
 * - 使用语义化变量和类名
 * - 参考 styles/tokens/colors.css 中的可用变量
 */

import React from 'react';
import { Tooltip } from '@heroui/react';
import { getClientColorStyle, formatClient } from '@/utils';
import { AnthropicIcon, OpenAIIcon, GeminiIcon, CodexIcon } from '@/components/icons/SupplierIcons';

/**
 * 客户端图标配置
 * 复用供应商图标组件
 */
const CLIENT_ICONS: Record<string, React.ReactNode> = {
  claude: <AnthropicIcon size={20} className="w-full h-full" />,
  codex: <CodexIcon size={20} className="w-full h-full" />,
  gemini: <GeminiIcon size={20} className="w-full h-full" />,
};

interface TransformFlowBadgeProps {
  /** 原始客户端类型 */
  fromClient: string;
  /** 目标客户端类型（供应商） */
  toClient?: string;
  /** 是否为供应商请求（微妙标识） */
  isSupplierRequest?: boolean;
  /** 转换链（用于 tooltip） */
  transformerChain?: string[];
  /** 供应商名称（用于 tooltip） */
  supplierName?: string;
  /** 入站/用户请求模型（用于 tooltip） */
  requestedModel?: string;
  /** 上游实际模型（用于 tooltip） */
  upstreamModel?: string;
  /** 计费模型（用于 tooltip） */
  billingModel?: string;
  /** 缓存命中 tokens（用于 tooltip） */
  cachedInputTokens?: number;
  /** 尺寸变体 */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * TransformFlowBadge - 转换流程图标组件
 *
 * 显示从原始客户端到目标客户端的转换流程
 * 格式: [源图标] → [目标图标]
 *
 * 示例:
 * - Claude → Codex (有转换和供应商)
 * - Claude → Claude (直连，无转换)
 * - Claude → Gemini → OpenAI (多步转换链)
 */
export const TransformFlowBadge: React.FC<TransformFlowBadgeProps> = ({
  fromClient,
  toClient,
  isSupplierRequest = false,
  transformerChain,
  supplierName,
  requestedModel,
  upstreamModel,
  billingModel,
  cachedInputTokens,
  size = 'md',
}) => {
  // 如果没有目标客户端，使用原始客户端（表示直连）
  const targetClient = toClient || fromClient;
  const hasTransform = toClient !== undefined && toClient !== fromClient;
  const hasTransformerChain = transformerChain && transformerChain.length > 0;

  // 尺寸配置
  const sizeConfig = {
    sm: { icon: 'w-4 h-4', arrow: 'w-3 h-3', gap: 'gap-0.5' },
    md: { icon: 'w-5 h-5', arrow: 'w-4 h-4', gap: 'gap-1' },
    lg: { icon: 'w-6 h-6', arrow: 'w-5 h-5', gap: 'gap-1.5' },
  }[size];

  // 构建 tooltip 内容
  const tooltipContent = () => {
    const parts: string[] = [];

    if (supplierName) {
      parts.push(`供应商: ${supplierName}`);
    }

    if (hasTransformerChain) {
      parts.push(`转换链: ${transformerChain.join(' → ')}`);
    }

    if (billingModel) {
      parts.push(`计费模型: ${billingModel}`);
    }
    if (requestedModel) {
      parts.push(`请求模型: ${requestedModel}`);
    }
    if (upstreamModel) {
      parts.push(`上游模型: ${upstreamModel}`);
    }
    if (typeof cachedInputTokens === 'number' && cachedInputTokens > 0) {
      parts.push(`缓存命中: ${cachedInputTokens} tokens`);
    }

    if (parts.length === 0) {
      return `直连请求 (${formatClient(fromClient)})`;
    }

    return parts.join('\n');
  };

  // 获取客户端颜色样式
  const fromColor = getClientColorStyle(fromClient);
  const toColor = getClientColorStyle(targetClient);

  return (
    <Tooltip content={tooltipContent()} placement="top" showArrow>
      <div
        className={[
          'flex items-center justify-center',
          sizeConfig.gap,
          'px-1.5 py-0.5 rounded-md',
          'transition-all duration-200',
          // 供应商请求的微妙标识：使用更浅的背景色
          isSupplierRequest
            ? 'bg-brand-primary/8 hover:bg-brand-primary/12'
            : 'bg-transparent hover:bg-secondary/50',
        ].join(' ')}
      >
        {/* 源客户端图标 */}
        <div
          className={[sizeConfig.icon, 'flex-shrink-0'].join(' ')}
          style={fromColor}
          title={formatClient(fromClient)}
        >
          {CLIENT_ICONS[fromClient] || CLIENT_ICONS.claude}
        </div>

        {/* 箭头 */}
        <div
          className={[sizeConfig.arrow, 'flex-shrink-0 text-tertiary'].join(' ')}
          style={{ fontSize: '10px' }}
        >
          →
        </div>

        {/* 目标客户端图标 */}
        <div
          className={[sizeConfig.icon, 'flex-shrink-0'].join(' ')}
          style={toColor}
          title={formatClient(targetClient)}
        >
          {CLIENT_ICONS[targetClient] || CLIENT_ICONS.claude}
        </div>

        {/* 供应商标识：微妙的小点 */}
        {isSupplierRequest && (
          <div
            className="w-1 h-1 rounded-full ml-0.5 flex-shrink-0"
            style={{
              backgroundColor: 'var(--color-accent)',
              opacity: 0.6,
            }}
            title="供应商请求"
          />
        )}
      </div>
    </Tooltip>
  );
};
