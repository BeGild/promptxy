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
  requestHeaders?: Record<string, string>;
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

  // 模型与计费口径（新增）
  requestedModel?: string;
  upstreamModel?: string;

  // 统计字段（可选）
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputCost?: number;
  outputCost?: number;
  totalCost?: number;
  usageSource?: 'actual' | 'estimated';
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

  // 模型与计费口径（新增，列表可选展示）
  requestedModel?: string;
  upstreamModel?: string;
  model?: string;

  // 统计（轻量）
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalCost?: number;
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
