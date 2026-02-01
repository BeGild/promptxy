/**
 * 总览统计卡片组件
 * 显示 4 个关键指标：总请求数、总 Token、总费用、成功率
 */

import React from 'react';
import { Card, CardBody } from '@heroui/react';
import type { StatsTotal } from '@/types/stats';
import { Activity, DollarSign, CheckCircle, TrendingUp } from 'lucide-react';

interface StatsTotalCardProps {
  total: StatsTotal;
}

export const StatsTotalCard: React.FC<StatsTotalCardProps> = ({ total }) => {
  // 计算成功率
  const successRate = total.requestTotal > 0
    ? (total.requestSuccess / total.requestTotal) * 100
    : 0;

  const cards = [
    {
      title: '总请求数',
      value: total.requestTotal.toLocaleString(),
      icon: Activity,
      color: 'text-brand-primary',
      gradient: 'from-blue-500/20 to-brand-primary/20 dark:from-blue-500/10 dark:to-brand-primary/10',
    },
    {
      title: '总 Token 数',
      value: `${(total.totalTokens / 1000000).toFixed(2)}M`,
      icon: TrendingUp,
      color: 'text-purple-500',
      gradient: 'from-purple-500/20 to-purple-600/20 dark:from-purple-500/10 dark:to-purple-600/10',
    },
    {
      title: '总费用',
      value: `$${total.totalCost.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-500',
      gradient: 'from-green-500/20 to-emerald-600/20 dark:from-green-500/10 dark:to-emerald-600/10',
    },
    {
      title: '成功率',
      value: `${successRate.toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-emerald-500',
      gradient: 'from-emerald-500/20 to-teal-600/20 dark:from-emerald-500/10 dark:to-teal-600/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.title}
            className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5"
          >
            <CardBody className="gap-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${card.color}`}>
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${card.gradient}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <div className={`text-2xl font-bold ${card.color}`}>
                {card.value}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
};
