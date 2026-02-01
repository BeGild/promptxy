/**
 * 排行榜组件
 * 显示 Top 10 排名
 */

import React, { useMemo } from 'react';
import { Card, CardBody } from '@heroui/react';
import type { StatsMetrics } from '@/types/stats';
import { Trophy, Medal, Award } from 'lucide-react';

interface StatsRankBoardProps<T extends StatsMetrics> {
  title: string;
  data: T[];
  dataKey: keyof T;
  labelKey: keyof T;
  formatValue: (value: number) => string;
  limit?: number;
}

export const StatsRankBoard = <T extends StatsMetrics>({
  title,
  data,
  dataKey,
  labelKey,
  formatValue,
  limit = 10,
}: StatsRankBoardProps<T>) => {
  // 按指定字段排序并取前 N 名
  const sortedData = useMemo(() => {
    return [...data]
      .sort((a, b) => (b[dataKey] as number) - (a[dataKey] as number))
      .slice(0, limit);
  }, [data, dataKey, limit]);

  // 获取排名图标
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-700" />;
      default:
        return <span className="text-sm text-secondary w-5 text-center">{rank}</span>;
    }
  };

  // 计算百分比
  const maxValue = sortedData[0]?.[dataKey] as number || 1;

  return (
    <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
      <CardBody>
        <h3 className="text-lg font-semibold text-brand-primary mb-4">{title}</h3>

        {sortedData.length === 0 ? (
          <p className="text-secondary text-sm">暂无数据</p>
        ) : (
          <div className="space-y-3">
            {sortedData.map((item, index) => {
              const value = item[dataKey] as number;
              const percentage = (value / maxValue) * 100;
              const label = item[labelKey] as string;

              return (
                <div key={index} className="flex items-center gap-3">
                  {/* 排名图标 */}
                  <div className="flex-shrink-0 w-6 flex justify-center">
                    {getRankIcon(index + 1)}
                  </div>

                  {/* 标签和进度条 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-brand-primary truncate" title={label}>
                        {label}
                      </span>
                      <span className="text-sm font-medium text-secondary ml-2">
                        {formatValue(value)}
                      </span>
                    </div>
                    <div className="h-2 bg-bg-tertiary dark:bg-bg-tertiary-dark rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-primary to-accent transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
