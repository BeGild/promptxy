import { apiClient } from './client';
import type {
  Supplier,
  SuppliersFetchResponse,
  SupplierCreateRequest,
  SupplierCreateResponse,
  SupplierUpdateRequest,
  SupplierUpdateResponse,
  SupplierDeleteResponse,
  SupplierToggleRequest,
  SupplierToggleResponse,
  Route,
  RoutesFetchResponse,
  RouteCreateRequest,
  RouteCreateResponse,
  RouteUpdateRequest,
  RouteUpdateResponse,
  RouteDeleteResponse,
  RouteToggleRequest,
  RouteToggleResponse,
} from '@/types/api';

/**
 * 导出配置
 */
export async function exportConfig(): Promise<any> {
  const response = await apiClient.get('/_promptxy/config');
  return response.data;
}

/**
 * 导入配置
 */
export async function importConfig(config: any): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post('/_promptxy/config/sync', config);
  return response.data;
}

/**
 * 下载配置文件
 */
export function downloadConfig(config: any, filename: string = 'promptxy-config.json'): void {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 上传配置文件
 */
export function uploadConfig(): Promise<any> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = event => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = e => {
        try {
          const content = e.target?.result as string;
          const config = JSON.parse(content);
          resolve(config);
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };

    input.click();
  });
}

// ============================================================================
// 供应商管理 API
// ============================================================================

/**
 * 获取供应商列表
 */
export async function fetchSuppliers(): Promise<SuppliersFetchResponse> {
  const response = await apiClient.get('/_promptxy/suppliers');
  return response.data;
}

/**
 * 创建供应商
 */
export async function createSupplier(
  request: SupplierCreateRequest,
): Promise<SupplierCreateResponse> {
  // 后端期望 { supplier: Supplier } 格式
  const response = await apiClient.post('/_promptxy/suppliers', {
    supplier: request.supplier,
  });
  return response.data;
}

/**
 * 更新供应商
 */
export async function updateSupplier(
  params: { supplierId: string; supplier: Supplier },
): Promise<SupplierUpdateResponse> {
  // 后端期望 { supplier: Supplier } 格式
  const response = await apiClient.put(
    `/_promptxy/suppliers/${params.supplierId}`,
    { supplier: params.supplier },
  );
  return response.data;
}

/**
 * 删除供应商
 */
export async function deleteSupplier(supplierId: string): Promise<SupplierDeleteResponse> {
  const response = await apiClient.delete(`/_promptxy/suppliers/${supplierId}`);
  return response.data;
}

/**
 * 切换供应商启用状态
 */
export async function toggleSupplier(
  supplierId: string,
  request: SupplierToggleRequest,
): Promise<SupplierToggleResponse> {
  const response = await apiClient.post(`/_promptxy/suppliers/${supplierId}/toggle`, request);
  return response.data;
}

// ============================================================================
// 设置管理 API
// ============================================================================

/**
 * 获取所有设置
 */
export async function fetchSettings(): Promise<{
  success: boolean;
  settings: Record<string, string>;
}> {
  const response = await apiClient.get('/_promptxy/settings');
  return response.data;
}

/**
 * 更新设置
 */
export async function updateSettings(
  settings: Record<string, string>,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post('/_promptxy/settings', { settings });
  return response.data;
}

// ============================================================================
// 路由配置 API
// ============================================================================

/**
 * 获取路由列表
 */
export async function fetchRoutes(): Promise<RoutesFetchResponse> {
  const response = await apiClient.get('/_promptxy/routes');
  return response.data;
}

/**
 * 创建路由
 */
export async function createRoute(
  request: RouteCreateRequest,
): Promise<RouteCreateResponse> {
  const response = await apiClient.post('/_promptxy/routes', {
    route: request.route,
  });
  return response.data;
}

/**
 * 更新路由
 */
export async function updateRoute(
  params: { routeId: string; route: Partial<Route> },
): Promise<RouteUpdateResponse> {
  const response = await apiClient.put(
    `/_promptxy/routes/${params.routeId}`,
    { route: params.route },
  );
  return response.data;
}

/**
 * 删除路由
 */
export async function deleteRoute(routeId: string): Promise<RouteDeleteResponse> {
  const response = await apiClient.delete(`/_promptxy/routes/${routeId}`);
  return response.data;
}

/**
 * 切换路由启用状态
 */
export async function toggleRoute(
  routeId: string,
  request: RouteToggleRequest,
): Promise<RouteToggleResponse> {
  const response = await apiClient.post(`/_promptxy/routes/${routeId}/toggle`, request);
  return response.data;
}
