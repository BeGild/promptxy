import { apiClient } from './client';
import type {
  StatsDataResponse,
  StatsTotal,
  StatsDaily,
  StatsHourly,
  StatsSupplier,
  StatsModel,
  StatsRoute,
  StatsToday,
} from '@/types/stats';

/**
 * 获取完整统计数据
 */
export type StatsRange = '7d' | '30d' | '90d' | 'all';

export type StatsDataQuery = {
  range?: StatsRange;
  startTime?: number;
  endTime?: number;
};

export async function getStatsData(query: StatsDataQuery = {}): Promise<StatsDataResponse> {
  const params = new URLSearchParams();
  if (query.range) params.set('range', query.range);
  if (query.startTime !== undefined) params.set('startTime', String(query.startTime));
  if (query.endTime !== undefined) params.set('endTime', String(query.endTime));

  const qs = params.toString();
  const response = await apiClient.get(`/_promptxy/stats/data${qs ? `?${qs}` : ''}`);
  return response.data;
}

/**
 * 获取总览统计
 */
export async function getStatsTotal(): Promise<StatsTotal> {
  const response = await apiClient.get('/_promptxy/stats/total');
  return response.data;
}

/**
 * 获取每日统计列表
 * @param limit 返回条数，默认 30
 */
export async function getStatsDaily(limit: number = 30): Promise<StatsDaily[]> {
  const response = await apiClient.get(`/_promptxy/stats/daily?limit=${limit}`);
  return response.data;
}

/**
 * 获取小时统计列表（仅当日）
 */
export async function getStatsHourly(): Promise<StatsHourly[]> {
  const response = await apiClient.get('/_promptxy/stats/hourly');
  return response.data;
}

/**
 * 获取供应商统计列表
 */
export async function getStatsSupplier(): Promise<StatsSupplier[]> {
  const response = await apiClient.get('/_promptxy/stats/supplier');
  return response.data;
}

/**
 * 获取模型统计列表
 * @param limit 返回条数，默认 20
 * @param sortBy 排序字段，默认 totalTokens
 */
export async function getStatsModel(
  limit: number = 20,
  sortBy: keyof StatsModel = 'totalTokens'
): Promise<StatsModel[]> {
  const response = await apiClient.get(
    `/_promptxy/stats/model?limit=${limit}&sortBy=${sortBy}`
  );
  return response.data;
}

/**
 * 获取路由统计列表
 */
export async function getStatsRoute(): Promise<StatsRoute[]> {
  const response = await apiClient.get('/_promptxy/stats/route');
  return response.data;
}

/**
 * 获取今日统计
 */
export async function getStatsToday(): Promise<StatsToday> {
  const response = await apiClient.get('/_promptxy/stats/today');
  return response.data;
}
