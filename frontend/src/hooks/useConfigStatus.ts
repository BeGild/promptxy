import { useMemo } from 'react';
import { useSuppliers } from './useSuppliers';
import { useRoutes } from './useRoutes';
import type { Supplier, Route } from '@/types/api';

interface ConfigStatus {
  '/claude': string | null;
  '/codex': string | null;
  '/gemini': string | null;
}

/**
 * 获取每个路径对应的供应商配置状态
 */
export function useConfigStatus(): ConfigStatus {
  const { data: suppliersData } = useSuppliers();
  const { data: routesData } = useRoutes();
  const suppliers = suppliersData?.suppliers || [];
  const routes = routesData?.routes || [];

  return useMemo(() => {
    const status: ConfigStatus = {
      '/claude': null,
      '/codex': null,
      '/gemini': null,
    };

    const byLocalService: Record<string, Route[]> = {};
    for (const r of routes) {
      if (!byLocalService[r.localService]) byLocalService[r.localService] = [];
      byLocalService[r.localService]!.push(r);
    }

    const resolveSupplierName = (supplierId: string | undefined): string | null => {
      if (!supplierId) return null;
      const s: Supplier | undefined = suppliers.find(x => x.id === supplierId);
      return s ? s.displayName || s.name : null;
    };

    const enabledRoute = (localService: 'claude' | 'codex' | 'gemini'): Route | undefined => {
      const list = byLocalService[localService] || [];
      return list.find(r => r.enabled);
    };

    status['/claude'] = resolveSupplierName(enabledRoute('claude')?.supplierId);
    status['/codex'] = resolveSupplierName(enabledRoute('codex')?.supplierId);
    status['/gemini'] = resolveSupplierName(enabledRoute('gemini')?.supplierId);

    return status;
  }, [routes, suppliers]);
}
