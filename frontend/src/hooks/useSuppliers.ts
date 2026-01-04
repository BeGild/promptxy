import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  toggleSupplier,
} from '@/api/config';
import type {
  Supplier,
  SupplierCreateRequest,
  SupplierUpdateRequest,
  SupplierToggleRequest,
  CommonPrefix,
  CommonPrefixOption,
} from '@/types/api';

/**
 * 前缀颜色映射（使用客户端品牌色）
 */
const PREFIX_COLORS: Record<string, string> = {
  '/claude': '🟧', // Claude (Anthropic) - 橙色 #D97757
  '/codex': '🟩', // Codex (Responses) - 绿色 #10A37F
  '/gemini': '🟦', // Gemini (Google) - 蓝色 #4285F4
  '/test': '🟫',
  '/custom': '🟥',
};

/**
 * 常用前缀选项（使用客户端品牌色）
 */
export const COMMON_PREFIX_OPTIONS: CommonPrefixOption[] = [
  { prefix: '/claude', label: '/claude', description: 'Claude API', color: '🟧' },
  { prefix: '/codex', label: '/codex', description: 'Codex API (Responses)', color: '🟩' },
  { prefix: '/gemini', label: '/gemini', description: 'Gemini API', color: '🟦' },
  { prefix: '/test', label: '/test', description: '测试用', color: '🟫' },
];

/**
 * 获取前缀颜色
 */
export function getPrefixColor(prefix: string): string {
  if (PREFIX_COLORS[prefix]) {
    return PREFIX_COLORS[prefix];
  }

  // 基于哈希生成颜色
  const colors = ['🟧', '🟩', '🟥', '🟨', '🟫', '⬛', '⬜'];
  const hash = prefix.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

/**
 * 按前缀分组供应商
 */
export function groupSuppliersByPrefix(suppliers: Supplier[]): CommonPrefix[] {
  // 新的架构中，供应商不再绑定到本地路径
  // 这里暂时返回空数组，实际应该从路由配置获取分组
  return [];
}

/**
 * 获取供应商列表的 Hook
 */
export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      return await fetchSuppliers();
    },
    staleTime: 1000 * 60 * 5, // 5分钟
    refetchOnWindowFocus: false,
  });
}

/**
 * 创建供应商的 Hook
 */
export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: SupplierCreateRequest) => {
      return await createSupplier(request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

/**
 * 更新供应商的 Hook
 */
export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { supplierId: string; supplier: Supplier }) => {
      return await updateSupplier(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

/**
 * 删除供应商的 Hook
 */
export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplierId: string) => {
      return await deleteSupplier(supplierId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

/**
 * 切换供应商状态的 Hook
 */
export function useToggleSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      supplierId,
      request,
    }: {
      supplierId: string;
      request: SupplierToggleRequest;
    }) => {
      return await toggleSupplier(supplierId, request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}
