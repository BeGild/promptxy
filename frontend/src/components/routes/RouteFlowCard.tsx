/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 */

import React from 'react';
import { Card, CardBody, Switch, Button } from '@heroui/react';
import { Edit2, Trash2 } from 'lucide-react';
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
      </CardBody>
    </Card>
  );
};
