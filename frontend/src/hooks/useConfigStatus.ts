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

    // 查找每个路径的启用供应商
    for (const supplier of suppliers) {
      if (supplier.enabled) {
        const prefix = supplier.localPrefix;
        if (prefix in status && !status[prefix as keyof ConfigStatus]) {
          status[prefix as keyof ConfigStatus] = supplier.name;
        }
      }
    }

    return status;
  }, [suppliers]);
}