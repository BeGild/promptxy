import { useQuery } from '@tanstack/react-query';
import { fetchRoutes } from '@/api/config';

/**
 * 获取路由列表的 Hook
 */
export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      return await fetchRoutes();
    },
    staleTime: 1000 * 60 * 5, // 5分钟
    refetchOnWindowFocus: false,
  });
}

