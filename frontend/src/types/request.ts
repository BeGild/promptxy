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
  matchedRules: Array<{ ruleId: string; opType: string }>;
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;
}

export interface RequestListItem {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  matchedRules: string[];
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
