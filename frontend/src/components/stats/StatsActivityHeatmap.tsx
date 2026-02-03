/**
 * 活动热力图组件
 * GitHub 风格，显示最近 84 天的活动
 */

import React, { useMemo } from 'react';
import { Card, CardBody } from '@heroui/react';
import type { StatsDaily } from '@/types/stats';

interface StatsActivityHeatmapProps {
  daily: StatsDaily[];
}

// 获取活动等级（0-4）
const getActivityLevel = (value: number, maxValue: number): number => {
  if (value === 0) return 0;
  const ratio = value / maxValue;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
};

// 等级对应的颜色（使用品牌色系）
const levelColors: Record<number, string> = {
  0: 'bg-bg-tertiary dark:bg-bg-tertiary-dark',
  1: 'bg-brand-primary/20 dark:bg-brand-primary/10',
  2: 'bg-brand-primary/40 dark:bg-brand-primary/30',
  3: 'bg-brand-primary/60 dark:bg-brand-primary/50',
  4: 'bg-brand-primary/80 dark:bg-brand-primary/70',
};

export const StatsActivityHeatmap: React.FC<StatsActivityHeatmapProps> = ({ daily }) => {
  // 获取最近 84 天的数据（按日期升序，保证时间轴稳定）
  const daysToShow = 84;
  const recentDaily = useMemo(() => {
    const sorted = [...daily].sort((a, b) => a.dateKey - b.dateKey);
    return sorted.slice(-daysToShow);
  }, [daily]);

  // 计算最大值用于归一化
  const maxValue = Math.max(...recentDaily.map(d => d.requestTotal), 1);

  // 生成周数据（7 天 x 12 周）
  const weeks: StatsDaily[][] = useMemo(() => {
    const result: StatsDaily[][] = [];
    for (let i = 0; i < recentDaily.length; i += 7) {
      result.push(recentDaily.slice(i, i + 7));
    }
    return result;
  }, [recentDaily]);

  // 星期标签
  const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

  // 格式化日期
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
      <CardBody>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-brand-primary">活动热力图</h3>
          <div className="flex items-center gap-2 text-xs text-secondary">
            <span>少</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(level => (
                <div
                  key={level}
                  className={`w-3 h-3 rounded-sm ${levelColors[level]}`}
                />
              ))}
            </div>
            <span>多</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {/* 星期标签 */}
            <div className="flex flex-col gap-1 mr-2 text-xs text-secondary">
              {weekdayLabels.map((label, i) => (
                <div key={i} className="h-3 flex items-center">
                  {i % 2 === 1 ? label : ''}
                </div>
              ))}
            </div>

            {/* 热力图网格 */}
            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const dayData = week[dayIndex];
                    const level = dayData
                      ? getActivityLevel(dayData.requestTotal, maxValue)
                      : 0;

                    return (
                      <div
                        key={dayIndex}
                        className={`w-3 h-3 rounded-sm ${levelColors[level]} transition-colors`}
                        title={
                          dayData
                            ? `${dayData.date}: ${dayData.requestTotal} 次请求`
                            : '无数据'
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 时间轴标签 */}
        <div className="flex justify-between mt-2 text-xs text-secondary px-14">
          <span>{recentDaily[0]?.date ? formatDate(recentDaily[0].date) : ''}</span>
          <span>{recentDaily[recentDaily.length - 1]?.date ? formatDate(recentDaily[recentDaily.length - 1].date) : ''}</span>
        </div>
      </CardBody>
    </Card>
  );
};
