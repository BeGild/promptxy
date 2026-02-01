/**
 * 统计图表组件
 * 显示趋势数据（使用简单的 SVG 折线图）
 */

import React, { useMemo } from 'react';
import { Card, CardBody } from '@heroui/react';
import type { StatsDaily } from '@/types/stats';

interface StatsChartProps {
  title: string;
  data: StatsDaily[];
  dataKey: keyof StatsDaily;
  color: string;
  formatValue: (value: number) => string;
}

export const StatsChart: React.FC<StatsChartProps> = ({
  title,
  data,
  dataKey,
  color,
  formatValue,
}) => {
  // 过滤出有效数据
  const validData = useMemo(() =>
    data.filter(d => typeof d[dataKey] === 'number' && (d[dataKey] as number) > 0)
  , [data, dataKey]);

  if (validData.length === 0) {
    return (
      <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
        <CardBody>
          <h3 className="text-lg font-semibold text-brand-primary mb-4">{title}</h3>
          <p className="text-secondary text-sm">暂无数据</p>
        </CardBody>
      </Card>
    );
  }

  // 计算最大值用于缩放
  const maxValue = useMemo(() =>
    Math.max(...validData.map(d => (d[dataKey] as number) || 0))
  , [validData, dataKey]);
  const minValue = useMemo(() =>
    Math.min(...validData.map(d => (d[dataKey] as number) || 0))
  , [validData, dataKey]);

  // 图表尺寸
  const width = 400;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 计算点的位置
  const points = useMemo(() =>
    validData.map((d, i) => {
      const x = padding.left + (i / (validData.length - 1)) * chartWidth;
      const value = (d[dataKey] as number) || 0;
      const y = padding.top + chartHeight - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight;
      return { x, y, value, date: d.date };
    })
  , [validData, dataKey, minValue, maxValue, chartWidth, chartHeight, padding]);

  // 生成路径
  const pathD = useMemo(() =>
    points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ')
  , [points]);

  // 生成填充区域
  const areaD = useMemo(() =>
    `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`
  , [pathD, points, padding, chartHeight]);

  // 格式化 Y 轴标签
  const formatYLabel = (value: number) => {
    if (maxValue >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (maxValue >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  return (
    <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
      <CardBody>
        <h3 className="text-lg font-semibold text-brand-primary mb-4">{title}</h3>

        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible" style={{ maxHeight: '200px' }}>
          {/* Y 轴标签 */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const value = minValue + ratio * (maxValue - minValue);
            const y = padding.top + chartHeight - ratio * chartHeight;
            return (
              <text
                key={ratio}
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="text-xs fill-secondary"
              >
                {formatYLabel(value)}
              </text>
            );
          })}

          {/* Y 轴线 */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding.top + chartHeight - ratio * chartHeight;
            return (
              <line
                key={i}
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                className="stroke-border-default dark:stroke-border-dark stroke-opacity-20"
                strokeWidth="1"
                strokeDasharray={i === 0 || i === 4 ? '0' : '4'}
              />
            );
          })}

          {/* 填充区域 */}
          <path
            d={areaD}
            fill={color}
            fillOpacity="0.1"
          />

          {/* 折线 */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 数据点 */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3"
              fill={color}
              className="hover:r-4 transition-all cursor-pointer"
            >
              <title>{`${p.date}: ${formatValue(p.value)}`}</title>
            </circle>
          ))}
        </svg>

        {/* 总计 */}
        <div className="mt-4 text-center">
          <span className="text-sm text-secondary">总计：</span>
          <span className="text-lg font-semibold text-brand-primary ml-1">
            {formatValue(validData.reduce((sum, d) => sum + (d[dataKey] as number), 0))}
          </span>
        </div>
      </CardBody>
    </Card>
  );
};
