import { apiClient } from './client';
import type {
  UpstreamsUpdateRequest,
  UpstreamsUpdateResponse,
  UpstreamsFetchResponse,
  Supplier,
  SuppliersFetchResponse,
  SupplierCreateRequest,
  SupplierCreateResponse,
  SupplierUpdateRequest,
  SupplierUpdateResponse,
  SupplierDeleteResponse,
  SupplierToggleRequest,
  SupplierToggleResponse,
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

/**
 * 获取上游配置
 */
export async function fetchUpstreams(): Promise<UpstreamsFetchResponse> {
  const response = await apiClient.get('/_promptxy/config/upstreams');
  return response.data;
}

/**
 * 更新上游配置
 */
export async function updateUpstreams(
  config: UpstreamsUpdateRequest,
): Promise<UpstreamsUpdateResponse> {
  const response = await apiClient.post('/_promptxy/config/upstreams', config);
  return response.data;
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
  const response = await apiClient.post('/_promptxy/suppliers', request);
  return response.data;
}

/**
 * 更新供应商
 */
export async function updateSupplier(
  supplierId: string,
  request: SupplierUpdateRequest,
): Promise<SupplierUpdateResponse> {
  const response = await apiClient.put(`/_promptxy/suppliers/${supplierId}`, request);
  return response.data;
}

/**
 * 删除供应商
 */
export async function deleteSupplier(
  supplierId: string,
): Promise<SupplierDeleteResponse> {
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
export async function fetchSettings(): Promise<{ success: boolean; settings: Record<string, string> }> {
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
