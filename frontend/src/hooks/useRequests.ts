import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { getRequests, getRequestDetail, deleteRequest, cleanupRequests, getStats, getDatabaseInfo } from "@/api/requests";
import { RequestFilters } from "@/types";

/**
 * 获取请求列表的 Hook
 */
export function useRequests(filters: RequestFilters = {}, page: number = 1) {
  const loading = useAppStore((state) => state.loading.requests);

  const query = useQuery({
    queryKey: ["requests", filters, page],
    queryFn: async () => {
      return await getRequests(filters, page, 50);
    },
    staleTime: 1000 * 10, // 10秒
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data,
    isLoading: loading || query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 获取单个请求详情的 Hook
 */
export function useRequestDetail(id: string | null) {
  const query = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      if (!id) throw new Error("No request ID");
      return await getRequestDetail(id);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5分钟
    refetchOnWindowFocus: false,
  });

  return {
    request: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * 删除请求的 Hook
 */
export function useDeleteRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await deleteRequest(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

/**
 * 清理请求的 Hook
 */
export function useCleanupRequests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keep: number = 100) => {
      return await cleanupRequests(keep);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

/**
 * 获取统计信息的 Hook
 */
export function useStats() {
  const loading = useAppStore((state) => state.loading.stats);

  const query = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      return await getStats();
    },
    staleTime: 1000 * 30, // 30秒
    refetchOnWindowFocus: false,
  });

  return {
    stats: query.data,
    isLoading: loading || query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 获取数据库信息的 Hook
 */
export function useDatabaseInfo() {
  const query = useQuery({
    queryKey: ["database"],
    queryFn: async () => {
      return await getDatabaseInfo();
    },
    staleTime: 1000 * 60, // 1分钟
    refetchOnWindowFocus: false,
  });

  return {
    database: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
