/**
 * 统计系统相关类型定义
 */

/**
 * 统计指标基础类型
 * 所有指标均为累加值
 */
export interface StatsMetrics {
  // Token 相关
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;

  // 费用相关（美元，保留 6 位小数）
  inputCost: number;
  outputCost: number;
  totalCost: number;

  // 时间相关（毫秒）
  waitTime: number;
  durationTime: number;

  // 请求计数
  requestSuccess: number;
  requestFailed: number;
  requestTotal: number;

  // FTUT（First Token Usage Time）
  ftutCount: number;
  ftutSum: number;
  ftutAvg: number;
}

/**
 * 总览统计（所有时间）
 */
export interface StatsTotal extends StatsMetrics {
  updatedAt: number;
}

/**
 * 每日统计
 */
export interface StatsDaily extends StatsMetrics {
  date: string;
  dateKey: number;
}

/**
 * 小时统计（仅当日）
 */
export interface StatsHourly extends StatsMetrics {
  date: string;
  hour: number;
  dateHour: string;
}

/**
 * 供应商统计
 */
export interface StatsSupplier extends StatsMetrics {
  supplierId: string;
  supplierName: string;
}

/**
 * 模型统计
 */
export interface StatsModel extends StatsMetrics {
  model: string;
  supplierName?: string;
}

/**
 * 路由统计
 */
export interface StatsRoute extends StatsMetrics {
  routeId: string;
  localService: string;
}

/**
 * 今日统计（内存缓存）
 */
export interface StatsToday extends StatsMetrics {
  date: string;
  hourly: Record<number, StatsMetrics>;
}

/**
 * 完整统计数据响应
 */
export interface StatsDataResponse {
  total: StatsTotal;
  daily: StatsDaily[];
  hourly: StatsHourly[];
  supplier: StatsSupplier[];
  model: StatsModel[];
  route: StatsRoute[];
  today: StatsToday;
}

/**
 * 每日统计列表响应
 */
export interface StatsDailyListResponse {
  items: StatsDaily[];
}

/**
 * 小时统计列表响应
 */
export interface StatsHourlyListResponse {
  items: StatsHourly[];
}

/**
 * 供应商统计列表响应
 */
export interface StatsSupplierListResponse {
  items: StatsSupplier[];
}

/**
 * 模型统计列表响应
 */
export interface StatsModelListResponse {
  items: StatsModel[];
}

/**
 * 路由统计列表响应
 */
export interface StatsRouteListResponse {
  items: StatsRoute[];
}
