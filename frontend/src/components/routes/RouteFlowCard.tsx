/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 */

import React, { useState } from 'react';
import { Card, CardBody, Switch, Button, Chip } from '@heroui/react';
import { Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { InboundEndpoint } from './InboundEndpoint';
import { FlowArrow } from './FlowArrow';
import { OutboundConfig } from './OutboundConfig';
import type { Route, Supplier } from '@/types/api';

interface RouteFlowCardProps {
  route: Route;
  suppliers: Supplier[];
  onToggle: (route: Route) => void;
  onEdit: (route: Route) => void;
  onDelete: (routeId: string) => void;
}

/**
 * 路由流量卡片组件
 * 展示完整的路由流量路径：入站端点 → 流向箭头 → 出站配置
 */
export const RouteFlowCard: React.FC<RouteFlowCardProps> = ({
  route,
  suppliers,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // 获取主要目标供应商用于流向箭头
  let targetSupplier: Supplier | undefined;
  if (route.singleSupplierId) {
    targetSupplier = suppliers.find(s => s.id === route.singleSupplierId);
  } else if (route.modelMappings && route.modelMappings.length > 0) {
    targetSupplier = suppliers.find(s => s.id === route.modelMappings![0].targetSupplierId);
  }

  return (
    <Card
      className={`border transition-all ${
        route.enabled
          ? 'border-brand-primary/30 dark:border-brand-primary/20 bg-elevated'
          : 'border-subtle opacity-60'
      }`}
    >
      <CardBody className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* 左侧：入站端点 */}
          <div className="shrink-0">
            <InboundEndpoint localService={route.localService} />
          </div>

          {/* 中间：流向箭头 */}
          <div className="flex items-start justify-center lg:pt-3">
            <FlowArrow
              localService={route.localService}
              targetSupplier={targetSupplier}
              showProtocolConversion={true}
            />
          </div>

          {/* 右侧：出站配置 */}
          <div className="flex-1 min-w-0">
            <OutboundConfig
              suppliers={suppliers}
              singleSupplierId={route.singleSupplierId}
              modelMappings={route.modelMappings}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 shrink-0 lg:pt-2">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => onEdit(route)}
              title="编辑路由"
            >
              <Edit2 size={16} />
            </Button>
            <Switch
              isSelected={route.enabled}
              onValueChange={() => onToggle(route)}
              size="sm"
              aria-label="启用路由"
            />
            <Button
              isIconOnly
              color="danger"
              variant="light"
              size="sm"
              onPress={() => onDelete(route.id)}
              title="删除路由"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>

        {/* 展开详情 */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-default-200">
            <div className="text-sm font-medium mb-2">详细配置</div>
            {route.singleSupplierId ? (
              <div className="space-y-2">
                {(() => {
                  const supplier = suppliers.find(s => s.id === route.singleSupplierId);
                  if (!supplier) return <div className="text-tertiary">未找到供应商</div>;
                  return (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-tertiary">上游供应商:</span>
                      <span className="font-medium">{supplier.displayName || supplier.name}</span>
                      <Chip size="sm" variant="flat">{supplier.protocol}</Chip>
                    </div>
                  );
                })()}
              </div>
            ) : route.modelMappings && route.modelMappings.length > 0 ? (
              <div className="space-y-2">
                {route.modelMappings.map((rule, index) => {
                  const supplier = suppliers.find(s => s.id === rule.targetSupplierId);
                  return (
                    <div key={rule.id} className="flex items-center gap-3 py-2 px-3 bg-default-100/50 rounded-lg text-sm">
                      <span className="text-tertiary w-6">{index + 1}.</span>
                      <code className="bg-default-200 px-2 py-0.5 rounded text-xs">{rule.inboundModel}</code>
                      <span className="text-tertiary">→</span>
                      <span className="font-medium">{supplier?.displayName || '未知'}</span>
                      {rule.outboundModel ? (
                        <code className="bg-default-200 px-2 py-0.5 rounded text-xs">{rule.outboundModel}</code>
                      ) : (
                        <Chip size="sm" variant="flat" className="text-xs">透传</Chip>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-tertiary text-sm">未配置详细信息</div>
            )}
          </div>
        )}

        {/* 展开/收起按钮 */}
        <div className="mt-3 pt-3 border-t border-default-200 flex justify-center">
          <Button
            variant="light"
            size="sm"
            onPress={() => setIsExpanded(!isExpanded)}
            endContent={isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          >
            {isExpanded ? '收起详情' : '查看详情'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};
