/**
 * 请求相关类型定义
 */

export interface RequestRecord {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  originalBody: any;
  modifiedBody: any;
  requestSize?: number;
  responseSize?: number;
  matchedRules: Array<{ ruleId: string; opType: string }>;
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;

  // 供应商和转换信息（新增）
  routeId?: string; // 命中的路由 ID
  supplierId?: string; // 供应商 ID
  supplierName?: string; // 供应商名称
  supplierBaseUrl?: string; // 供应商上游地址
  transformerChain?: string[]; // 转换链数组
  transformTrace?: any; // 转换追踪信息
}

export interface RequestListItem {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  matchedRules: string[];
  requestSize?: number;
  responseSize?: number;
  responseStatus?: number;
  durationMs?: number;
  error?: string;
}

export interface RequestListResponse {
  total: number;
  limit: number;
  offset: number;
  items: RequestListItem[];
}

export interface RequestFilters {
  client?: string;
  startTime?: number;
  endTime?: number;
  search?: string;
}
