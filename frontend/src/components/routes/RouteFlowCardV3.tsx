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
const LOCAL_SERVICE_CONFIG: Record<LocalService, { label: string; prefix: string; protocol: string; color: string; bgColor: string; Icon: React.ComponentType<{size?: number; className?: string}> }> = {
  'claude': {
    label: 'Claude',
    prefix: '/claude',
    protocol: 'anthropic',
    color: '#D4935D',
    bgColor: 'bg-[#D4935D]/15',
    Icon: AnthropicIcon
  },
  'codex': {
    label: 'Codex',
    prefix: '/codex',
    protocol: 'openai-codex',
    color: '#2D3748',
    bgColor: 'bg-[#2D3748]/15',
    Icon: CodexIcon
  },
  'gemini': {
    label: 'Gemini',
    prefix: '/gemini',
    protocol: 'gemini',
    color: '#4285F4',
    bgColor: 'bg-[#4285F4]/15',
    Icon: GeminiIcon
  },
};

// === 供应商样式映射 ===
const SUPPLIER_STYLES: Record<string, { bg: string; text: string; border: string; solidBg: string }> = {
  'anthropic': {
    bg: 'bg-[#D4935D]/15',
    text: 'text-[#D4935D]',
    border: 'border-[#D4935D]/40',
    solidBg: 'bg-[#D4935D]'
  },
  'openai-codex': {
    bg: 'bg-[#2D3748]/15',
    text: 'text-[#2D3748] dark:text-[#4A5568]',
    border: 'border-[#2D3748]/40',
    solidBg: 'bg-[#2D3748]'
  },
  'openai-chat': {
    bg: 'bg-[#10A37F]/15',
    text: 'text-[#10A37F]',
    border: 'border-[#10A37F]/40',
    solidBg: 'bg-[#10A37F]'
  },
  'gemini': {
    bg: 'bg-[#4285F4]/15',
    text: 'text-[#4285F4]',
    border: 'border-[#4285F4]/40',
    solidBg: 'bg-[#4285F4]'
  },
};

interface RouteFlowCardProps {
  route: Route;
  suppliers: Supplier[];
  onToggle: (route: Route) => void;
  onEdit: (route: Route) => void;
  onDelete: (routeId: string) => void;
}

/**
 * 入站端点 - 视觉强化版
 */
const InboundEndpoint: React.FC<{ localService: LocalService }> = ({ localService }) => {
  const config = LOCAL_SERVICE_CONFIG[localService];
  const { Icon } = config;

  return (
    <div className="flex items-center gap-4">
      {/* 大图标 + 强背景色 */}
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${config.bgColor} border-2 border-white/50 dark:border-white/10 shadow-sm`}>
        <Icon size={28} className={SUPPLIER_STYLES[config.protocol]?.text || 'text-tertiary'} />
      </div>

      {/* 文字信息 */}
      <div className="flex flex-col gap-0.5">
        <span className="text-lg font-bold text-primary tracking-tight">{config.label}</span>
        <span className="text-sm font-medium text-tertiary font-mono bg-default-100 px-2 py-0.5 rounded">{config.prefix}</span>
      </div>
    </div>
  );
};

/**
 * 流向指示器 - 视觉强化
 */
const FlowIndicator: React.FC<{
  localService: LocalService;
  targetSupplier?: Supplier;
}> = ({ localService, targetSupplier }) => {
  const localProtocol = LOCAL_SERVICE_CONFIG[localService].protocol;
  const targetProtocol = targetSupplier?.protocol;
  const hasConversion = targetProtocol && localProtocol !== targetProtocol;

  return (
    <div className="flex flex-col items-center justify-center px-4">
      {/* 大箭头背景 */}
      <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${
        hasConversion
          ? 'bg-warning/20 border-warning/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
          : 'bg-default-100 border-default-200'
      }`}>
        <ArrowRight size={24} className={hasConversion ? 'text-warning' : 'text-tertiary'} />
      </div>
      {hasConversion && (
        <span className="text-xs font-bold text-warning mt-1.5 uppercase tracking-wider">转换</span>
      )}
    </div>
  );
};

/**
 * 出站配置 - 视觉强化版
 */
const OutboundConfig: React.FC<{
  suppliers: Supplier[];
  singleSupplierId?: string;
  modelMappings?: ModelMappingRule[];
}> = ({ suppliers, singleSupplierId, modelMappings }) => {
  // 单供应商模式
  if (singleSupplierId) {
    const supplier = suppliers.find(s => s.id === singleSupplierId);
    if (!supplier) return (
      <div className="flex items-center gap-3 text-tertiary">
        <div className="w-3 h-3 rounded-full bg-default-300" />
        <span className="text-base font-medium">未配置</span>
      </div>
    );

    const styles = SUPPLIER_STYLES[supplier.protocol] || {
      bg: 'bg-default-100',
      text: 'text-tertiary',
      border: 'border-default-200',
      solidBg: 'bg-default-400'
    };

    return (
      <div className="flex items-center gap-4">
        {/* 供应商色块 */}
        <div className={`w-4 h-12 rounded-full ${styles.solidBg} shadow-sm`} />

        <div className="flex flex-col gap-1">
          <span className={`text-lg font-bold ${styles.text}`}>
            {supplier.displayName || supplier.name}
          </span>
          <Chip
            size="sm"
            variant="flat"
            className={`text-xs h-6 font-medium ${styles.bg} ${styles.text} border ${styles.border}`}
          >
            {supplier.protocol}
          </Chip>
        </div>
      </div>
    );
  }

  // 模型映射模式
  if (modelMappings && modelMappings.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        {modelMappings.slice(0, 2).map((rule, idx) => {
          const supplier = suppliers.find(s => s.id === rule.targetSupplierId);
          const styles = supplier ? SUPPLIER_STYLES[supplier.protocol] : null;

          return (
            <div
              key={rule.id || idx}
              className="flex items-center gap-3 py-2.5 px-4 bg-default-50 rounded-xl border border-default-200/60 hover:border-default-300 transition-colors"
            >
              {/* 序号指示器 */}
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-default-200 text-xs font-bold text-tertiary">
                {idx + 1}
              </span>

              {/* 入站模型 */}
              <code className="text-sm font-bold text-primary font-mono bg-white dark:bg-default-100 px-2 py-1 rounded border border-default-200">
                {rule.inboundModel}
              </code>

              {/* 箭头 */}
              <ArrowRight size={18} className="text-tertiary" />

              {/* 供应商色点 */}
              {supplier && (
                <div className={`w-3 h-3 rounded-full ${styles?.solidBg || 'bg-default-400'}`} />
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
              {supplier && (
                <span className={`text-sm font-semibold ml-auto ${styles?.text || 'text-tertiary'}`}>
                  @{supplier.displayName}
                </span>
              )}
            </div>
          );
        })}
        {modelMappings.length > 2 && (
          <div className="flex items-center gap-2 py-2 px-4 text-tertiary">
            <div className="w-6 h-6 flex items-center justify-center rounded-full bg-default-100 text-xs font-bold">
              +{modelMappings.length - 2}
            </div>
            <span className="text-sm font-medium">更多规则...</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-tertiary">
      <div className="w-3 h-3 rounded-full bg-default-300" />
      <span className="text-base font-medium">未配置</span>
    </div>
  );
};

/**
 * 路由流量卡片 V3
 * 视觉优先设计：强对比、大色块、清晰层次
 */
export const RouteFlowCardV3: React.FC<RouteFlowCardProps> = ({
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
      className={`border-2 transition-all duration-200 overflow-hidden ${
        route.enabled
          ? 'border-default-200 dark:border-default-700 bg-elevated shadow-md hover:shadow-lg hover:border-primary/30'
          : 'border-default-100 dark:border-default-800 bg-default-50/50 opacity-70 grayscale'
      }`}
    >
      <CardBody className="p-6">
        {/* 桌面端：水平布局 */}
        <div className="hidden lg:flex lg:items-stretch lg:gap-6">
          {/* 入站 - 固定宽度 */}
          <div className="w-[180px] shrink-0 flex items-center">
            <InboundEndpoint localService={route.localService} />
          </div>

          {/* 流向箭头 - 居中 */}
          <div className="w-[80px] shrink-0 flex items-center justify-center border-x-2 border-dashed border-default-200 dark:border-default-700">
            <FlowIndicator localService={route.localService} targetSupplier={targetSupplier} />
          </div>

          {/* 出站 - 自适应 */}
          <div className="flex-1 min-w-0 flex items-center">
            <OutboundConfig
              suppliers={suppliers}
              singleSupplierId={route.singleSupplierId}
              modelMappings={route.modelMappings}
            />
          </div>

          {/* 操作 - 固定宽度 */}
          <div className="w-[140px] shrink-0 flex items-center justify-end gap-2 pl-4 border-l-2 border-default-200 dark:border-default-700">
            <Button
              isIconOnly
              variant="flat"
              size="md"
              onPress={() => onEdit(route)}
              className="w-10 h-10 bg-default-100 hover:bg-default-200"
            >
              <Edit2 size={20} />
            </Button>
            <Switch
              isSelected={route.enabled}
              onValueChange={() => onToggle(route)}
              size="md"
            />
            <Button
              isIconOnly
              color="danger"
              variant="flat"
              size="md"
              onPress={() => onDelete(route.id)}
              className="w-10 h-10"
            >
              <Trash2 size={20} />
            </Button>
          </div>
        </div>

        {/* 平板端：简化布局 */}
        <div className="hidden md:flex lg:hidden md:items-center md:gap-4">
          <div className="shrink-0">
            <InboundEndpoint localService={route.localService} />
          </div>
          <div className="shrink-0 px-2">
            <FlowIndicator localService={route.localService} targetSupplier={targetSupplier} />
          </div>
          <div className="flex-1 min-w-0">
            <OutboundConfig
              suppliers={suppliers}
              singleSupplierId={route.singleSupplierId}
              modelMappings={route.modelMappings}
            />
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <Button isIconOnly variant="flat" size="sm" onPress={() => onEdit(route)} className="w-9 h-9">
              <Edit2 size={18} />
            </Button>
            <Switch isSelected={route.enabled} onValueChange={() => onToggle(route)} size="sm" />
            <Button isIconOnly color="danger" variant="flat" size="sm" onPress={() => onDelete(route.id)} className="w-9 h-9">
              <Trash2 size={18} />
            </Button>
          </div>
        </div>

        {/* 移动端：垂直布局 */}
        <div className="md:hidden space-y-5">
          {/* 第一行：入站 + 箭头 + 操作 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <InboundEndpoint localService={route.localService} />
              <FlowIndicator localService={route.localService} targetSupplier={targetSupplier} />
            </div>
            <div className="flex items-center gap-2">
              <Button isIconOnly variant="flat" size="sm" onPress={() => onEdit(route)} className="w-9 h-9">
                <Edit2 size={18} />
              </Button>
              <Switch isSelected={route.enabled} onValueChange={() => onToggle(route)} size="sm" />
              <Button isIconOnly color="danger" variant="flat" size="sm" onPress={() => onDelete(route.id)} className="w-9 h-9">
                <Trash2 size={18} />
              </Button>
            </div>
          </div>

          {/* 第二行：出站配置 */}
          <div className="pl-[72px]">
            <OutboundConfig
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
