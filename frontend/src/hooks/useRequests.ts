import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAppStore } from '@/store';
import {
  getRequests,
  getRequestDetail,
  deleteRequest,
  cleanupRequests,
  getStats,
  getDatabaseInfo,
} from '@/api/requests';
import { RequestFilters } from '@/types';

/**
 * 获取请求列表的 Hook - 优化版本
 * 使用 useMemo 优化返回值，避免不必要的对象重新创建
 */
export function useRequests(filters: RequestFilters = {}, page: number = 1) {
  const loading = useAppStore(state => state.loading.requests);

  const query = useQuery({
    queryKey: ['requests', filters, page],
    queryFn: async () => {
      return await getRequests(filters, page, 50);
    },
    staleTime: 1000 * 10, // 10秒
    refetchOnWindowFocus: false,
  });

  // 使用 useMemo 优化返回值，避免每次渲染都创建新对象
  return useMemo(
    () => ({
      data: query.data,
      isLoading: loading || query.isLoading,
      error: query.error,
      refetch: query.refetch,
    }),
    [query.data, loading, query.isLoading, query.error, query.refetch],
  );
}

/**
 * 获取单个请求详情的 Hook - 优化版本
 * 使用 useMemo 优化返回值
 */
export function useRequestDetail(id: string | null) {
  const query = useQuery({
    queryKey: ['request', id],
    queryFn: async () => {
      if (!id) throw new Error('No request ID');
      return await getRequestDetail(id);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5分钟
    refetchOnWindowFocus: false,
  });

  // 使用 useMemo 优化返回值
  return useMemo(
    () => ({
      request: query.data,
      isLoading: query.isLoading,
      error: query.error,
    }),
    [query.data, query.isLoading, query.error],
  );
}

/**
 * 删除请求的 Hook - 优化版本
 */
export function useDeleteRequest() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteRequest(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  // 使用 useCallback 优化 mutate 函数
  const mutate = useCallback(
    (id: string) => {
      mutation.mutate(id);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}

/**
 * 清理请求的 Hook - 优化版本
 */
export function useCleanupRequests() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (keep: number = 100) => {
      return await cleanupRequests(keep);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const mutate = useCallback(
    (keep: number = 100) => {
      mutation.mutate(keep);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}

/**
 * 获取统计信息的 Hook - 优化版本
 * 使用 useMemo 优化返回值
 */
export function useStats() {
  const loading = useAppStore(state => state.loading.stats);

  const query = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      return await getStats();
    },
    staleTime: 1000 * 30, // 30秒
    refetchOnWindowFocus: false,
  });

  // 使用 useMemo 优化返回值
  return useMemo(
    () => ({
      stats: query.data,
      isLoading: loading || query.isLoading,
      error: query.error,
      refetch: query.refetch,
    }),
    [query.data, loading, query.isLoading, query.error, query.refetch],
  );
}

/**
 * 获取数据库信息的 Hook - 优化版本
 * 使用 useMemo 优化返回值
 */
export function useDatabaseInfo() {
  const query = useQuery({
    queryKey: ['database'],
    queryFn: async () => {
      return await getDatabaseInfo();
    },
    staleTime: 1000 * 60, // 1分钟
    refetchOnWindowFocus: false,
  });

  // 使用 useMemo 优化返回值
  return useMemo(
    () => ({
      database: query.data,
      isLoading: query.isLoading,
      error: query.error,
    }),
    [query.data, query.isLoading, query.error],
  );
}
