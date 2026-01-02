import { useMemo } from 'react';
import { useSuppliers } from './useSuppliers';
import type { Supplier } from '@/types/api';

interface ConfigStatus {
  '/claude': string | null;
  '/openai': string | null;
  '/gemini': string | null;
}

/**
 * 获取每个路径对应的供应商配置状态
 */
export function useConfigStatus(): ConfigStatus {
  const { data: suppliersData } = useSuppliers();
  const suppliers = suppliersData?.suppliers || [];

  return useMemo(() => {
    const status: ConfigStatus = {
      '/claude': null,
      '/openai': null,
      '/gemini': null,
    };

    // 新的架构中，供应商不再绑定到本地路径
    // 这里暂时返回空状态，实际应该从路由配置获取
    return status;
  }, [suppliers]);
}