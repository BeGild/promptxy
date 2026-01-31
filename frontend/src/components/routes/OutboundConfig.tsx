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
  'anthropic': 'bg-[#D4935D]/25',
  'openai-codex': 'bg-[#2D3748]/25',
  'openai-chat': 'bg-[#10A37F]/25',
  'gemini': 'bg-[#4285F4]/25',
};

const SUPPLIER_TEXT_CLASSES: Record<string, string> = {
  'anthropic': 'text-[#D4935D]',
  'openai-codex': 'text-[#2D3748] dark:text-gray-400',
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
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${SUPPLIER_BG_CLASSES[supplier.protocol] || 'bg-default-200'} border-2 border-white dark:border-white/10 shadow-sm`}
      >
        <IconComponent size={26} className={SUPPLIER_TEXT_CLASSES[supplier.protocol] || 'text-tertiary'} />
      </div>
      <div className="flex flex-col">
        <div className="text-base font-bold text-primary">{supplier.displayName || supplier.name}</div>
        <Chip size="sm" variant="flat" className={`text-xs h-5 w-fit ${SUPPLIER_BG_CLASSES[supplier.protocol] || ''} ${SUPPLIER_TEXT_CLASSES[supplier.protocol] || ''}`}>
          {supplier.protocol}
        </Chip>
      </div>
    </div>
  );
};

interface ModelMappingRowProps {
  rule: ModelMappingRule;
  supplier: Supplier | undefined;
}

const ModelMappingRow: React.FC<ModelMappingRowProps> = ({ rule, supplier }) => {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 bg-default-50 rounded-lg border border-default-200/60">
      {/* 入站模型 */}
      <code className="text-sm font-bold text-primary font-mono bg-white dark:bg-default-100 px-2 py-1 rounded border border-default-200">
        {rule.inboundModel}
      </code>

      {/* 箭头 */}
      <ArrowRight size={16} className="text-tertiary shrink-0" />

      {/* 供应商图标 */}
      {supplier ? (
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${SUPPLIER_BG_CLASSES[supplier.protocol] || 'bg-default-200'} border border-white dark:border-white/10`}
        >
          <div className={`w-3 h-3 rounded-full ${SUPPLIER_TEXT_CLASSES[supplier.protocol]?.replace('text-', 'bg-') || 'bg-tertiary'}`} />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-default-200">
          <div className="w-3 h-3 rounded-full bg-tertiary" />
        </div>
      )}

      {/* 出站模型 */}
      {rule.outboundModel ? (
        <code className="text-sm font-bold text-primary font-mono">
          {rule.outboundModel}
        </code>
      ) : (
        <Chip size="sm" variant="flat" className="text-xs h-6 font-medium bg-default-200 text-tertiary">
          透传
        </Chip>
      )}

      {/* 供应商名称 */}
      <span className={`text-sm font-medium ml-auto ${supplier ? SUPPLIER_TEXT_CLASSES[supplier.protocol] || 'text-tertiary' : 'text-tertiary'}`}>
        @{supplier?.displayName || '未知'}
      </span>
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
