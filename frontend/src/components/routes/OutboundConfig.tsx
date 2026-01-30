/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 */

import React from 'react';
import { Chip } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import { AnthropicIcon, OpenAIIcon, GeminiIcon, CodexIcon } from '@/components/icons/SupplierIcons';
import type { Supplier, ModelMappingRule } from '@/types/api';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const SUPPLIER_ICONS: Record<string, React.ComponentType<IconProps>> = {
  'anthropic': AnthropicIcon,
  'openai-codex': CodexIcon,
  'openai-chat': OpenAIIcon,
  'gemini': GeminiIcon,
};

const SUPPLIER_BG_CLASSES: Record<string, string> = {
  'anthropic': 'bg-[#D4935D]/20',
  'openai-codex': 'bg-[#2D3748]/20',
  'openai-chat': 'bg-[#10A37F]/20',
  'gemini': 'bg-[#4285F4]/20',
};

const SUPPLIER_TEXT_CLASSES: Record<string, string> = {
  'anthropic': 'text-[#D4935D]',
  'openai-codex': 'text-[#2D3748]',
  'openai-chat': 'text-[#10A37F]',
  'gemini': 'text-[#4285F4]',
};

interface OutboundConfigProps {
  suppliers: Supplier[];
  singleSupplierId?: string;
  modelMappings?: ModelMappingRule[];
}

interface SingleSupplierProps {
  supplier: Supplier;
}

const SingleSupplier: React.FC<SingleSupplierProps> = ({ supplier }) => {
  const IconComponent = SUPPLIER_ICONS[supplier.protocol] || OpenAIIcon;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${SUPPLIER_BG_CLASSES[supplier.protocol] || 'bg-default-200'}`}
      >
        <IconComponent size={24} className={SUPPLIER_TEXT_CLASSES[supplier.protocol] || 'text-tertiary'} />
      </div>
      <div>
        <div className="font-semibold text-primary">{supplier.displayName || supplier.name}</div>
        <div className="text-xs text-tertiary">{supplier.protocol}</div>
      </div>
    </div>
  );
};

interface ModelMappingRowProps {
  rule: ModelMappingRule;
  supplier: Supplier | undefined;
}

const ModelMappingRow: React.FC<ModelMappingRowProps> = ({ rule, supplier }) => {
  const IconComponent = supplier ? SUPPLIER_ICONS[supplier.protocol] || OpenAIIcon : OpenAIIcon;

  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-default-100/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate text-primary">{rule.inboundModel}</div>
      </div>
      <ArrowRight size={14} className="text-tertiary shrink-0" />
      <div
        className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${supplier ? SUPPLIER_BG_CLASSES[supplier.protocol] || 'bg-default-200' : 'bg-default-200'}`}
      >
        <IconComponent size={14} className={supplier ? SUPPLIER_TEXT_CLASSES[supplier.protocol] || 'text-tertiary' : 'text-tertiary'} />
      </div>
      <div className="flex-1 min-w-0">
        {rule.outboundModel ? (
          <div className="text-sm truncate text-primary">{rule.outboundModel}</div>
        ) : (
          <Chip size="sm" variant="flat" className="text-xs">透传</Chip>
        )}
        <div className="text-xs text-tertiary truncate">{supplier?.displayName || '未知供应商'}</div>
      </div>
    </div>
  );
};

/**
 * 出站配置组件
 * 支持单供应商显示和模型映射规则列表
 */
export const OutboundConfig: React.FC<OutboundConfigProps> = ({
  suppliers,
  singleSupplierId,
  modelMappings,
}) => {
  if (singleSupplierId) {
    const supplier = suppliers.find(s => s.id === singleSupplierId);
    if (!supplier) {
      return <div className="text-tertiary text-sm">未选择供应商</div>;
    }
    return <SingleSupplier supplier={supplier} />;
  }

  if (modelMappings && modelMappings.length > 0) {
    return (
      <div className="space-y-2">
        {modelMappings.map((rule, index) => {
          const supplier = suppliers.find(s => s.id === rule.targetSupplierId);
          return (
            <ModelMappingRow
              key={rule.id || index}
              rule={rule}
              supplier={supplier}
            />
          );
        })}
      </div>
    );
  }

  return <div className="text-tertiary text-sm">未配置</div>;
};
