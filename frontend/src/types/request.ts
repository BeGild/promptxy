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
  transformedBody?: any;
  modifiedBody: any;
  requestSize?: number;
  responseSize?: number;
  matchedRules: Array<{ ruleId: string; opType: string }>;
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;

  // 供应商和转换信息
  routeId?: string;
  supplierId?: string;
  supplierName?: string;
  supplierBaseUrl?: string;
  transformerChain?: string[];
  transformTrace?: any;
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

  // 供应商和转换信息
  supplierName?: string;
  supplierClient?: string;
  transformerChain?: string[];
  transformedPath?: string;
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
