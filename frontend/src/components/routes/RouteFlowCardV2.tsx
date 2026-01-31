/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 */

import React from 'react';
import { Card, CardBody, Switch, Button, Chip } from '@heroui/react';
import { Edit2, Trash2, ArrowRight } from 'lucide-react';
import { AnthropicIcon, OpenAIIcon, GeminiIcon, CodexIcon } from '@/components/icons/SupplierIcons';
import type { Route, Supplier, ModelMappingRule, LocalService } from '@/types/api';

// === 本地服务配置 ===
const LOCAL_SERVICE_CONFIG: Record<LocalService, { label: string; prefix: string; protocol: string; color: string; Icon: React.ComponentType<{size?: number; className?: string}> }> = {
  'claude': { label: 'Claude', prefix: '/claude', protocol: 'anthropic', color: '#D4935D', Icon: AnthropicIcon },
  'codex': { label: 'Codex', prefix: '/codex', protocol: 'openai-codex', color: '#2D3748', Icon: CodexIcon },
  'gemini': { label: 'Gemini', prefix: '/gemini', protocol: 'gemini', color: '#4285F4', Icon: GeminiIcon },
};

// === 供应商样式映射 ===
const SUPPLIER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'anthropic': { bg: 'bg-[#D4935D]/10', text: 'text-[#D4935D]', border: 'border-[#D4935D]/30' },
  'openai-codex': { bg: 'bg-[#2D3748]/10', text: 'text-[#2D3748]', border: 'border-[#2D3748]/30' },
  'openai-chat': { bg: 'bg-[#10A37F]/10', text: 'text-[#10A37F]', border: 'border-[#10A37F]/30' },
  'gemini': { bg: 'bg-[#4285F4]/10', text: 'text-[#4285F4]', border: 'border-[#4285F4]/30' },
};

interface RouteFlowCardProps {
  route: Route;
  suppliers: Supplier[];
  onToggle: (route: Route) => void;
  onEdit: (route: Route) => void;
  onDelete: (routeId: string) => void;
}

/**
 * 入站端点 - 紧凑水平布局
 */
const InboundBadge: React.FC<{ localService: LocalService }> = ({ localService }) => {
  const config = LOCAL_SERVICE_CONFIG[localService];
  const { Icon } = config;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${SUPPLIER_STYLES[config.protocol]?.bg || 'bg-default-100'}`}>
        <Icon size={18} className={SUPPLIER_STYLES[config.protocol]?.text || 'text-tertiary'} />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-primary leading-tight">{config.label}</span>
        <span className="text-[10px] text-tertiary font-mono leading-tight">{config.prefix}</span>
      </div>
    </div>
  );
};

/**
 * 流向指示器
 */
const FlowIndicator: React.FC<{
  localService: LocalService;
  targetSupplier?: Supplier;
}> = ({ localService, targetSupplier }) => {
  const localProtocol = LOCAL_SERVICE_CONFIG[localService].protocol;
  const targetProtocol = targetSupplier?.protocol;
  const hasConversion = targetProtocol && localProtocol !== targetProtocol;

  return (
    <div className="flex flex-col items-center justify-center px-2">
      <div className={`flex items-center justify-center w-6 h-6 rounded-full ${hasConversion ? 'bg-warning/10' : 'bg-default-100'}`}>
        <ArrowRight size={14} className={hasConversion ? 'text-warning' : 'text-tertiary'} />
      </div>
      {hasConversion && (
        <span className="text-[9px] text-warning font-medium mt-0.5">转换</span>
      )}
    </div>
  );
};

/**
 * 出站配置 - 紧凑列表
 */
const OutboundList: React.FC<{
  suppliers: Supplier[];
  singleSupplierId?: string;
  modelMappings?: ModelMappingRule[];
}> = ({ suppliers, singleSupplierId, modelMappings }) => {
  // 单供应商模式
  if (singleSupplierId) {
    const supplier = suppliers.find(s => s.id === singleSupplierId);
    if (!supplier) return <span className="text-sm text-tertiary">未配置</span>;

    const styles = SUPPLIER_STYLES[supplier.protocol] || { bg: 'bg-default-100', text: 'text-tertiary', border: 'border-default-200' };

    return (
      <div className="flex items-center gap-2">
        <div className={`px-2 py-1 rounded-md border ${styles.bg} ${styles.border}`}>
          <span className={`text-xs font-medium ${styles.text}`}>{supplier.displayName || supplier.name}</span>
        </div>
        <Chip size="sm" variant="flat" className="text-[10px] h-5">{supplier.protocol}</Chip>
      </div>
    );
  }

  // 模型映射模式
  if (modelMappings && modelMappings.length > 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {modelMappings.slice(0, 3).map((rule, idx) => {
          const supplier = suppliers.find(s => s.id === rule.targetSupplierId);
          const styles = supplier ? SUPPLIER_STYLES[supplier.protocol] : null;

          return (
            <div
              key={rule.id || idx}
              className="flex items-center gap-1 px-2 py-1 bg-default-100/70 rounded border border-default-200/50"
            >
              <code className="text-[10px] text-primary font-mono">{rule.inboundModel}</code>
              <ArrowRight size={10} className="text-tertiary" />
              {rule.outboundModel ? (
                <span className="text-[10px] text-primary">{rule.outboundModel}</span>
              ) : (
                <Chip size="sm" variant="flat" className="text-[9px] h-4 px-1">透传</Chip>
              )}
              {supplier && (
                <span className={`text-[9px] ${styles?.text || 'text-tertiary'}`}>@{supplier.displayName}</span>
              )}
            </div>
          );
        })}
        {modelMappings.length > 3 && (
          <Chip size="sm" variant="flat" className="text-[10px] h-5">+{modelMappings.length - 3}</Chip>
        )}
      </div>
    );
  }

  return <span className="text-sm text-tertiary">未配置</span>;
};

/**
 * 路由流量卡片 V2
 * 工业工具风格：精确对齐、紧凑布局、技术感
 */
export const RouteFlowCardV2: React.FC<RouteFlowCardProps> = ({
  route,
  suppliers,
  onToggle,
  onEdit,
  onDelete,
}) => {
  // 获取目标供应商
  let targetSupplier: Supplier | undefined;
  if (route.singleSupplierId) {
    targetSupplier = suppliers.find(s => s.id === route.singleSupplierId);
  } else if (route.modelMappings?.length) {
    targetSupplier = suppliers.find(s => s.id === route.modelMappings![0].targetSupplierId);
  }

  return (
    <Card
      className={`border transition-all duration-200 ${
        route.enabled
          ? 'border-default-300 dark:border-default-600 bg-elevated hover:border-primary/40'
          : 'border-default-200 dark:border-default-700 bg-default-100/50 opacity-60'
      }`}
    >
      <CardBody className="p-3">
        {/* 桌面端：水平网格布局 */}
        <div className="hidden md:grid md:grid-cols-[140px_40px_1fr_auto] md:items-center md:gap-3">
          {/* 入站 */}
          <InboundBadge localService={route.localService} />

          {/* 流向箭头 */}
          <FlowIndicator localService={route.localService} targetSupplier={targetSupplier} />

          {/* 出站 */}
          <div className="min-w-0">
            <OutboundList
              suppliers={suppliers}
              singleSupplierId={route.singleSupplierId}
              modelMappings={route.modelMappings}
            />
          </div>

          {/* 操作 */}
          <div className="flex items-center gap-1 justify-end">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => onEdit(route)}
              className="w-7 h-7 min-w-0"
            >
              <Edit2 size={14} />
            </Button>
            <Switch
              isSelected={route.enabled}
              onValueChange={() => onToggle(route)}
              size="sm"
              className="scale-90"
            />
            <Button
              isIconOnly
              color="danger"
              variant="light"
              size="sm"
              onPress={() => onDelete(route.id)}
              className="w-7 h-7 min-w-0"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        {/* 移动端：垂直布局 */}
        <div className="md:hidden space-y-3">
          {/* 第一行：入站 + 箭头 + 操作 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <InboundBadge localService={route.localService} />
              <FlowIndicator localService={route.localService} targetSupplier={targetSupplier} />
            </div>
            <div className="flex items-center gap-1">
              <Button isIconOnly variant="light" size="sm" onPress={() => onEdit(route)} className="w-7 h-7">
                <Edit2 size={14} />
              </Button>
              <Switch isSelected={route.enabled} onValueChange={() => onToggle(route)} size="sm" className="scale-90" />
              <Button isIconOnly color="danger" variant="light" size="sm" onPress={() => onDelete(route.id)} className="w-7 h-7">
                <Trash2 size={14} />
              </Button>
            </div>
          </div>

          {/* 第二行：出站配置 */}
          <div className="pl-10">
            <OutboundList
              suppliers={suppliers}
              singleSupplierId={route.singleSupplierId}
              modelMappings={route.modelMappings}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
