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

    const resolveRouteSupplierId = (route: Route | undefined): string | undefined => {
      if (!route) return undefined;
      if (route.localService === 'claude') {
        // Claude: 使用第一个映射规则的供应商
        return route.modelMappings?.[0]?.targetSupplierId;
      } else {
        // Codex/Gemini: 使用单一供应商
        return route.singleSupplierId;
      }
    };

    status['/claude'] = resolveSupplierName(resolveRouteSupplierId(enabledRoute('claude')));
    status['/codex'] = resolveSupplierName(resolveRouteSupplierId(enabledRoute('codex')));
    status['/gemini'] = resolveSupplierName(resolveRouteSupplierId(enabledRoute('gemini')));

    return status;
  }, [routes, suppliers]);
}
