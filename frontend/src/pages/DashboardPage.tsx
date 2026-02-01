/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️ *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 */

import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@heroui/react';
import { getStatsData } from '@/api/stats';
import { StatsTotalCard } from '@/components/stats/StatsTotalCard';
import { StatsActivityHeatmap } from '@/components/stats/StatsActivityHeatmap';
import { StatsChart } from '@/components/stats/StatsChart';
import { StatsRankBoard } from '@/components/stats/StatsRankBoard';

const DashboardPageComponent: React.FC = () => {
  // 获取统计数据
  const {
    data: statsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['stats', 'data'],
    queryFn: getStatsData,
    refetchInterval: 30000, // 每 30 秒自动刷新
  });

  useEffect(() => {
    // 页面可见性变化时刷新数据
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-secondary">加载统计数据失败</p>
        <Button
          color="primary"
          variant="flat"
          startContent={<RefreshCw className="w-4 h-4" />}
          onPress={() => refetch()}
        >
          重试
        </Button>
      </div>
    );
  }

  if (!statsData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">暂无统计数据</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-primary to-accent bg-clip-text text-transparent">
            数据统计
          </h1>
          <p className="text-sm text-secondary mt-1">查看请求量、费用、性能等关键指标</p>
        </div>
      </div>

      {/* 总览卡片（4 个指标） */}
      <StatsTotalCard total={statsData.total} />

      {/* 活动热力图 */}
      <StatsActivityHeatmap daily={statsData.daily} />

      {/* 统计图表（2x2 网格） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatsChart
          title="Token 趋势"
          data={statsData.daily}
          dataKey="totalTokens"
          color="#8b5cf6"
          formatValue={(value) => `${(value / 1000).toFixed(1)}K`}
        />
        <StatsChart
          title="费用趋势"
          data={statsData.daily}
          dataKey="totalCost"
          color="#10b981"
          formatValue={(value) => `$${value.toFixed(2)}`}
        />
        <StatsChart
          title="请求量趋势"
          data={statsData.daily}
          dataKey="requestTotal"
          color="#3b82f6"
          formatValue={(value) => value.toString()}
        />
        <StatsChart
          title="平均响应时间"
          data={statsData.daily}
          dataKey="durationTime"
          color="#f59e0b"
          formatValue={(value) => `${(value / (statsData.daily.reduce((sum, d) => sum + d.requestTotal, 0) || 1)).toFixed(0)}ms`}
        />
      </div>

      {/* 排行榜（3 个） */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatsRankBoard
          title="模型排名"
          data={statsData.model}
          dataKey="totalTokens"
          labelKey="model"
          formatValue={(value) => `${(value / 1000).toFixed(1)}K`}
        />
        <StatsRankBoard
          title="供应商排名"
          data={statsData.supplier}
          dataKey="totalCost"
          labelKey="supplierName"
          formatValue={(value) => `$${value.toFixed(2)}`}
        />
        <StatsRankBoard
          title="路由排名"
          data={statsData.route}
          dataKey="requestTotal"
          labelKey="localService"
          formatValue={(value) => value.toString()}
        />
      </div>
    </div>
  );
};

/**
 * 使用 React.memo 包裹 DashboardPage 组件
 */
export const DashboardPage = React.memo(DashboardPageComponent);
