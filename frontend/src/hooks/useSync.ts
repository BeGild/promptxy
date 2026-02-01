/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSyncConfig,
  updateSyncConfig,
  syncPrices,
  syncModels,
  triggerSync,
  getSyncStatus,
  getSyncLogs,
} from '@/api/sync';
import type { SyncConfig, SyncLogsResponse, SyncStatus } from '@/types/sync';

// 查询键
export const syncKeys = {
  all: ['sync'] as const,
  config: () => [...syncKeys.all, 'config'] as const,
  status: () => [...syncKeys.all, 'status'] as const,
  logs: (limit?: number, type?: 'price' | 'model') =>
    [...syncKeys.all, 'logs', limit, type] as const,
};

/**
 * 获取同步配置
 */
export function useSyncConfig() {
  return useQuery({
    queryKey: syncKeys.config(),
    queryFn: async () => {
      const config = await getSyncConfig();
      return config;
    },
    staleTime: 1000 * 60, // 1 分钟
  });
}

/**
 * 更新同步配置
 */
export function useUpdateSyncConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: SyncConfig) => {
      const result = await updateSyncConfig(config);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: syncKeys.config() });
      toast.success('同步配置已保存');
    },
    onError: (error: any) => {
      toast.error(`保存失败: ${error?.message || '未知错误'}`);
    },
  });
}

/**
 * 获取同步状态
 */
export function useSyncStatus() {
  return useQuery({
    queryKey: syncKeys.status(),
    queryFn: async () => {
      const status = await getSyncStatus();
      return status;
    },
    refetchInterval: 5000, // 每 5 秒刷新一次
    staleTime: 1000,
  });
}

/**
 * 获取同步日志
 */
export function useSyncLogs(limit?: number, type?: 'price' | 'model') {
  return useQuery({
    queryKey: syncKeys.logs(limit, type),
    queryFn: async () => {
      const logs = await getSyncLogs(limit, type);
      return logs;
    },
    refetchInterval: 10000, // 每 10 秒刷新一次
    staleTime: 5000,
  });
}

/**
 * 同步价格
 */
export function useSyncPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncPrices,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: syncKeys.status() });
      queryClient.invalidateQueries({ queryKey: syncKeys.logs() });
      if (data.success) {
        toast.success(`价格同步成功: ${data.result.recordsCount} 个模型`);
      } else {
        toast.error(`价格同步失败: ${data.result.errorMessage || '未知错误'}`);
      }
    },
    onError: (error: any) => {
      toast.error(`价格同步失败: ${error?.message || '未知错误'}`);
    },
  });
}

/**
 * 同步模型列表
 */
export function useSyncModels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncModels,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: syncKeys.status() });
      queryClient.invalidateQueries({ queryKey: syncKeys.logs() });
      if (data.success) {
        toast.success(`模型列表同步成功: ${data.result.recordsCount} 个模型`);
      } else {
        toast.error(`模型列表同步失败: ${data.result.errorMessage || '未知错误'}`);
      }
    },
    onError: (error: any) => {
      toast.error(`模型列表同步失败: ${error?.message || '未知错误'}`);
    },
  });
}

/**
 * 触发全部同步
 */
export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await triggerSync('all');
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: syncKeys.status() });
      queryClient.invalidateQueries({ queryKey: syncKeys.logs() });
      const successCount = data.results.filter(r => r.status === 'success').length;
      const totalCount = data.results.length;
      toast.success(`同步完成: ${successCount}/${totalCount} 成功`);
    },
    onError: (error: any) => {
      toast.error(`同步失败: ${error?.message || '未知错误'}`);
    },
  });
}
